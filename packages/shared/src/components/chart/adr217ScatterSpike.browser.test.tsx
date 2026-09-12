/**
 * ADR-217 P0 / G0 — pinned Recharts 3.10.1 `ScatterChart` spike.
 *
 * 질문 하나: **`ScatterChart` 안에서 (a) `XAxis`/`YAxis` `type="number"` + 명시 domain +
 * `hide`, (b) `Customized` 그룹 (backdrop/foreground), (c) custom `shape` 가 line/area 분기
 * (`RechartsChart.tsx:633-648`) 와 같은 어법으로 동작해 점 중심 `cx/cy` 가 우리 선형 사상과
 * ≤ 1px 로 같은가.** 같으면 산점도 DOM 은 새 기하가 아니라 scene 좌표를 그리기만 하는 분기다.
 *
 * 제품 코드는 건드리지 않는다 (Recharts 직접 mount).
 */
import React, { type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Customized, Scatter, ScatterChart, XAxis, YAxis } from "recharts";
import { linearScale, r2 } from "@composition/specs";

const size = { width: 320, height: 240 };
const margin = { top: 12, right: 12, bottom: 12, left: 12 };
const xDomain: [number, number] = [0, 10];
const yDomain: [number, number] = [0, 50];
/** 중복 x (1,10)·(1,30) 와 겹친 점 (4,40)×2 — 행 = 점. */
const points = [
  { x: 1, y: 10 },
  { x: 1, y: 30 },
  { x: 2, y: 20 },
  { x: 4, y: 40 },
  { x: 4, y: 40 },
];

let root: Root | undefined;
let host: HTMLDivElement;
afterEach(() => {
  root?.unmount();
  host?.remove();
});

function mount(element: ReactElement): void {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  root.render(element);
}

/** 우리 사상 — plot = size − margin, x 는 왼→오, y 는 아래→위 (`linearScale` 그대로). */
function expected(): Array<{ cx: number; cy: number }> {
  const plot = {
    x: margin.left,
    y: margin.top,
    w: size.width - margin.left - margin.right,
    h: size.height - margin.top - margin.bottom,
  };
  const sx = linearScale(xDomain, [plot.x, plot.x + plot.w]);
  const sy = linearScale(yDomain, [plot.y + plot.h, plot.y]);
  return points.map((p) => ({ cx: r2(sx(p.x)), cy: r2(sy(p.y)) }));
}

describe("ADR-217 G0 — ScatterChart 어법 spike", () => {
  it("명시 domain · hide 축 · custom shape · Customized 두 그룹이 line/area 분기와 같이 동작한다", async () => {
    mount(
      <ScatterChart width={size.width} height={size.height} margin={margin}>
        <XAxis
          hide
          type="number"
          dataKey="x"
          domain={xDomain}
          allowDataOverflow
        />
        <YAxis
          hide
          type="number"
          dataKey="y"
          domain={yDomain}
          allowDataOverflow
        />
        <Customized key="grid" component={() => <g data-spike-backdrop="" />} />
        <Scatter
          data={points}
          isAnimationActive={false}
          fill="rgb(0,0,0)"
          shape={(entry: { cx?: number; cy?: number }) => (
            <circle
              data-spike-dot=""
              cx={entry.cx}
              cy={entry.cy}
              r={3}
              fill="rgb(0,0,0)"
            />
          )}
        />
        <Customized
          key="decoration"
          component={() => <g data-spike-foreground="" />}
        />
      </ScatterChart>,
    );
    await vi.waitFor(() =>
      expect(host.querySelectorAll("[data-spike-dot]").length).toBe(
        points.length,
      ),
    );
    const dots = Array.from(
      host.querySelectorAll<SVGCircleElement>("[data-spike-dot]"),
    ).map((c) => ({
      cx: Number(c.getAttribute("cx")),
      cy: Number(c.getAttribute("cy")),
    }));
    const want = expected();
    const deltas = dots.map((d, i) =>
      Math.max(Math.abs(d.cx - want[i].cx), Math.abs(d.cy - want[i].cy)),
    );
    console.log(
      JSON.stringify({ spike: "adr217-scatter", dots, want, deltas }),
    );
    expect(Math.max(...deltas)).toBeLessThanOrEqual(1);
    // pinned 3.10.1 사실: `Customized` 는 자식 순서와 무관하게 **그래픽 항목보다 먼저** 렌더된다
    //   (LineChart 도 같다 — 아래 대조). 그래서 기준선 `layer:"front"` 는 Customized 가 아니라
    //   Recharts svg 위의 overlay svg (형제, pointer-events none) 로 그린다 (breakdown §2.2).
    const svg = host.querySelector("svg")!;
    const order = Array.from(
      svg.querySelectorAll(
        "[data-spike-backdrop],[data-spike-dot],[data-spike-foreground]",
      ),
    ).map((el) =>
      el.getAttribute("data-spike-backdrop") !== null
        ? "back"
        : el.getAttribute("data-spike-foreground") !== null
          ? "front"
          : "dot",
    );
    console.log(JSON.stringify({ spikeOrder: order }));
    expect(order.slice(0, 2)).toEqual(["back", "front"]);
    expect(order.filter((o) => o === "dot").length).toBe(points.length);
  });
});

describe("ADR-217 G0 — Customized 그룹의 DOM 순서 (LineChart 대조)", () => {
  it("LineChart 도 Customized 를 그래픽 항목보다 먼저 렌더한다 (production foreground 도 마크 아래)", async () => {
    const { Line, LineChart } = await import("recharts");
    mount(
      <LineChart
        width={size.width}
        height={size.height}
        margin={margin}
        data={points}
      >
        <XAxis
          hide
          type="number"
          dataKey="x"
          domain={xDomain}
          allowDataOverflow
        />
        <YAxis
          hide
          type="number"
          dataKey="y"
          domain={yDomain}
          allowDataOverflow
        />
        <Customized key="grid" component={() => <g data-spike-backdrop="" />} />
        <Line dataKey="y" isAnimationActive={false} dot={false} />
        <Customized
          key="decoration"
          component={() => <g data-spike-foreground="" />}
        />
      </LineChart>,
    );
    await vi.waitFor(() =>
      expect(host.querySelectorAll(".recharts-line-curve").length).toBe(1),
    );
    const order = Array.from(
      host
        .querySelector("svg")!
        .querySelectorAll(
          "[data-spike-backdrop],.recharts-line-curve,[data-spike-foreground]",
        ),
    ).map((el) =>
      el.hasAttribute("data-spike-backdrop")
        ? "back"
        : el.hasAttribute("data-spike-foreground")
          ? "front"
          : "line",
    );
    console.log(JSON.stringify({ spikeOrderLine: order }));
    expect(order).toEqual(["back", "front", "line"]);
  });
});

/**
 * ADR-306 G3 (network family · 기존 종류 보강, Phase 5) — DOM host 가 scene 을 「복사만」 하는가 (breakdown §7.2). 외부
 * oracle = 브라우저가 실제로 놓은 요소의 `getBoundingClientRect` · 속성. 같은 입력의 scene
 * (`computeChartScene`) 과 mark 수 · 좌표 (≤ 0.5 px) · paint 역할 변수를 대조한다. 상자 320×240 ·
 * 640×360, 입력은 표본 · 음수 · 0 · 결측 · 항목 1 (긴 한국어 라벨) — 표본에서 숫자 칸만 바꿔 만든다.
 */
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Chart } from "../Chart";
import {
  CHART_DEFAULT_PROPS,
  CHART_DESCRIPTORS,
  chartPaintVar,
  computeChartScene,
  createChartInitialProps,
  loadChartFamily,
  resolveChartMetrics,
  type ChartFamily,
  type ChartProps,
  type ChartRow,
  type ChartScene,
  type FamilyChartType,
} from "@composition/rendering";
import { resolveComponentRule } from "../../catalog/resolvers/resolveComponentRule";

let root: Root | undefined;
let host: HTMLDivElement | undefined;
afterEach(() => {
  root?.unmount();
  host?.remove();
  root = undefined;
  host = undefined;
});

const families = new Map<string, ChartFamily>();
beforeAll(async () => {
  for (const id of ["network"] as const)
    families.set(id, await loadChartFamily(id));
});
const familyOf = (type: FamilyChartType) =>
  families.get(CHART_DESCRIPTORS.find((d) => d.chartType === type)!.family!)!;

const TYPES = CHART_DESCRIPTORS.filter((d) => d.family === "network").map(
  (d) => d.chartType as FamilyChartType,
);

/** 표본의 숫자 칸을 바꾼 입력 — 문자 칸은 그대로 (범주 · 시리즈 이름). */
function variant(rows: readonly ChartRow[], name: string): ChartRow[] {
  const mapNumbers = (
    row: ChartRow,
    fn: (v: number, i: number) => unknown,
    i: number,
  ) => {
    const out: Record<string, unknown> = { ...row };
    for (const [k, v] of Object.entries(row))
      if (typeof v === "number") out[k] = fn(v, i);
    return out as ChartRow;
  };
  switch (name) {
    case "negative":
      return rows.map((r, i) => mapNumbers(r, (v) => (i % 2 ? -v : v), i));
    case "zero":
      return rows.map((r, i) => mapNumbers(r, () => 0, i));
    case "missing":
      return rows.map((r, i) =>
        mapNumbers(r, (v) => (i % 3 === 1 ? null : v), i),
      );
    case "single": {
      const first: Record<string, unknown> = { ...rows[0] };
      const text = Object.keys(first).find((k) => typeof first[k] === "string");
      if (text) first[text] = "아주 긴 한국어 항목 이름";
      return [first as ChartRow];
    }
    default:
      return [...rows];
  }
}
const INPUTS = ["sample", "negative", "zero", "missing", "single"];
const SIZES = [
  { width: 320, height: 240 },
  { width: 640, height: 360 },
];

function propsOf(
  type: FamilyChartType,
  extra: Partial<ChartProps> = {},
): ChartProps {
  return {
    ...CHART_DEFAULT_PROPS,
    ...createChartInitialProps(type),
    ...familyOf(type).sampleProps(type),
    isAnimationActive: false,
    showTooltip: true,
    ...extra,
  } as ChartProps;
}

function mount(
  type: FamilyChartType,
  rows: ChartRow[],
  size: { width: number; height: number },
  extra: Partial<ChartProps> = {},
) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const props = propsOf(type, extra);
  root.render(
    <Chart
      {...(props as object)}
      data={rows}
      style={{
        width: size.width,
        height: size.height,
        boxSizing: "border-box",
      }}
    />,
  );
}

/** The chart box the scene sees (the Chart measures its border box — `useBoxSize`). */
function boxOf(): { width: number; height: number } {
  const el = host!.querySelector<HTMLElement>(".react-aria-Chart")!;
  const r = el.getBoundingClientRect();
  return { width: r.width, height: r.height };
}

function compare(scene: ChartScene) {
  const g = host!.querySelector<SVGGElement>("[data-chart-family]")!;
  expect(Number(g.dataset.chartMarkCount)).toBe(scene.marks.length);
  const svg = g.ownerSVGElement!;
  const origin = svg.getBoundingClientRect();
  // DOM 은 scene 순서 그대로 (grid → marks → axes → legend) — 같은 종류끼리 차례로 맞춘다.
  const ordered = [
    ...scene.axes.flatMap((a) => a.grid),
    ...scene.marks,
    ...scene.axes.flatMap((a) => [...(a.line ? [a.line] : []), ...a.ticks]),
    ...(scene.legend?.items.flatMap((i) => [i.swatch, i.text]) ?? []),
  ];
  const elements = Array.from(g.children) as SVGGraphicsElement[];
  expect(elements).toHaveLength(ordered.length);
  ordered.forEach((mark, i) => {
    const el = elements[i];
    const box = el.getBoundingClientRect();
    const at = (n: number) => n;
    switch (mark.kind) {
      case "rect":
        expect(el.tagName).toBe("rect");
        expect(box.left - origin.left).toBeCloseTo(at(mark.x), 0);
        expect(Math.abs(box.left - origin.left - mark.x)).toBeLessThanOrEqual(
          0.5,
        );
        expect(Math.abs(box.top - origin.top - mark.y)).toBeLessThanOrEqual(
          0.5,
        );
        expect(Math.abs(box.width - mark.w)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(box.height - mark.h)).toBeLessThanOrEqual(0.5);
        if (mark.fillPaint)
          expect(el.getAttribute("fill")).toBe(chartPaintVar(mark.fillPaint));
        break;
      case "path":
        expect(el.tagName).toBe("path");
        expect(el.getAttribute("d")).toBe(mark.d);
        if (mark.fillPaint)
          expect(el.getAttribute("fill")).toBe(chartPaintVar(mark.fillPaint));
        break;
      case "line":
        expect(el.tagName).toBe("line");
        expect(Number(el.getAttribute("x1"))).toBe(mark.x1);
        expect(Number(el.getAttribute("y2"))).toBe(mark.y2);
        if (mark.paint)
          expect(el.getAttribute("stroke")).toBe(chartPaintVar(mark.paint));
        expect(Number(el.getAttribute("stroke-width"))).toBe(mark.width ?? 1);
        break;
      case "text":
        expect(el.tagName).toBe("text");
        expect(el.textContent).toBe(mark.text);
        expect(Number(el.getAttribute("x"))).toBe(mark.x);
        // Phase 5 — 칸 안 글자는 paint 역할 색 (`on-fill`).
        if (mark.paint)
          expect(el.getAttribute("fill")).toBe(chartPaintVar(mark.paint));
        break;
    }
  });
}

describe("ADR-306 G3 — network DOM host = scene", () => {
  for (const type of TYPES)
    for (const size of SIZES)
      for (const name of INPUTS)
        it(`${type} ${size.width}×${size.height} ${name}`, async () => {
          const rows = variant(familyOf(type).sample(type), name);
          mount(type, rows, size);
          await vi.waitFor(
            () =>
              expect(host!.querySelector("[data-chart-family]")).not.toBeNull(),
            { timeout: 5000 },
          );
          const metrics = resolveChartMetrics(
            resolveComponentRule("Chart")?.chart,
          );
          const scene = computeChartScene(
            propsOf(type),
            rows,
            boxOf(),
            metrics,
          );
          expect(scene.pending).toBeUndefined();
          compare(scene);
        });

  it("hover — 고리 조각은 가운데 점에서 먼 자리도 그 조각 (sunburst 호 영역, live 에서 발견)", async () => {
    const rows = [...familyOf("sunburst").sample("sunburst")];
    mount("sunburst", rows, SIZES[1]);
    await vi.waitFor(
      () => expect(host!.querySelector("[data-chart-targets]")).not.toBeNull(),
      { timeout: 5000 },
    );
    const scene = computeChartScene(
      { ...propsOf("sunburst"), showTooltip: true },
      rows,
      boxOf(),
      resolveChartMetrics(resolveComponentRule("Chart")?.chart),
    );
    // 가장 넓은 바깥 조각 — 시작 각 쪽 10 % · 바깥 반지름 바로 안 (가운데 점에서 멀다).
    const target = [...(scene.targets ?? [])]
      .filter((t) => t.arc)
      .sort((a, b) => b.arc!.a1 - b.arc!.a0 - (a.arc!.a1 - a.arc!.a0))[0]!;
    const { cx, cy, r1, a0, a1 } = target.arc!;
    const angle = a0 + (a1 - a0) * 0.1;
    const px = cx + (r1 - 2) * Math.sin(angle);
    const py = cy - (r1 - 2) * Math.cos(angle);
    expect(Math.hypot(px - target.x, py - target.y)).toBeGreaterThan(
      (target.r ?? 0) + 12,
    );
    const surface = host!.querySelector<HTMLElement>("[data-chart-targets]")!;
    const origin = surface.getBoundingClientRect();
    surface.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: origin.left + px,
        clientY: origin.top + py,
        bubbles: true,
      }),
    );
    await vi.waitFor(() =>
      expect(host!.querySelector("[data-chart-target]")!.textContent).toContain(
        target.title,
      ),
    );
  });

  it("hover · 키보드 — targets 순서로 툴팁 (treemap 잎 이름)", async () => {
    mount("treemap", [...familyOf("treemap").sample("treemap")], SIZES[1]);
    await vi.waitFor(
      () => expect(host!.querySelector("[data-chart-targets]")).not.toBeNull(),
      { timeout: 5000 },
    );
    const surface = host!.querySelector<HTMLElement>("[data-chart-targets]")!;
    surface.focus();
    surface.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    await vi.waitFor(() =>
      expect(host!.querySelector("[data-chart-target]")!.textContent).toContain(
        "Running shoes",
      ),
    );
  });
});

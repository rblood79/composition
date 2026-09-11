/**
 * ADR-211 P3 (G3) — DOM leg 창 트랙: RechartsChart 안의 뷰 상태 Slider.
 *
 * 계약 (breakdown §2.5 → ADR-216 §2.3 개정): thumb **둘** (`[start, end]`) · `0 … n` · step 1 —
 * 시작 thumb 화살표 = 창 1 슬롯 이동 (최소 창이 end 를 민다, 211 과 같은 화면) · 끝 thumb End = 창을
 * n 까지 넓힘 (집계 재추출) · 데이터 identity 가 바뀌면 `[0, fitEff]` 로 reset · 같은 rows 재전송은
 * 창 유지 · 축 범위 (domain) 는 창과 무관 · 트랙은 layout 이 예약한 자리 (플롯 아래) 에 놓인다.
 * canonical write 0 은 구조로 성립한다 — Slider 는 컴포넌트 state 만 바꾼다 (live 하니스가
 * 실제 빌더에서 element props 불변을 다시 확인한다).
 */
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { Chart } from "../Chart";
import {
  CHART_DEFAULT_PROPS,
  createChartInitialProps,
  resolveChartData,
  resolveChartMetrics,
} from "@composition/specs";
import { resolveComponentRule } from "../../catalog/resolvers/resolveComponentRule";

let root: Root;
let host: HTMLDivElement;
afterEach(() => {
  root?.unmount();
  host?.remove();
  host = undefined!;
});
const SIZE = { width: 400, height: 300 };
const rowsOf = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ category: `c${i}`, value: i % 11 }));
const slider = () =>
  host.querySelector<HTMLElement>(".react-aria-Chart .chart-window-track-host");
const thumbs = () =>
  Array.from(
    host.querySelectorAll<HTMLInputElement>(
      ".react-aria-Chart .react-aria-SliderThumb input",
    ),
  );
const thumb = () => thumbs()[0];
const barCount = () => host.querySelectorAll(".recharts-bar-rectangle").length;
const tickTexts = () =>
  Array.from(host.querySelectorAll("[data-chart-decoration] text")).map(
    (node) => node.textContent,
  );
function mount(rows: ReturnType<typeof rowsOf>) {
  if (!host) {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  }
  root.render(
    <Chart
      {...createChartInitialProps("bar")}
      size="md"
      data={rows}
      dimension="category"
      metric="value"
      showLegend={false}
      isAnimationActive={false}
      style={{ width: SIZE.width, height: SIZE.height }}
    />,
  );
}

describe("ADR-211 P3 — Preview 창 Slider", () => {
  it("1,000 범주 bar: thumb 2 · 시작 thumb 화살표로 창 이동 (길이 보존) · 끝 thumb End 로 넓힘 · domain 불변 · 트랙 자리 = layout", async () => {
    const rows = rowsOf(1000);
    const metrics = resolveChartMetrics(
      resolveComponentRule("Chart")?.chart,
      "md",
    );
    const expected = resolveChartData(
      rows,
      {
        ...CHART_DEFAULT_PROPS,
        dimension: "category",
        metric: "value",
        showLegend: false,
      },
      metrics.seriesCount,
      { size: SIZE, metrics, windowStart: 0 },
    );
    const fitEff = expected.budget.fitEff;
    const max = expected.budget.n - fitEff;
    expect(max).toBeGreaterThan(0);
    mount(rows);
    await vi.waitFor(() => expect(slider()).toBeTruthy());
    const track = slider()!;
    expect(
      track.querySelector(".react-aria-Slider")!.getAttribute("aria-label"),
    ).toBe("Visible range");
    expect(track.dataset.chartWindowStart).toBe("0");
    expect(track.dataset.chartWindowEnd).toBe(String(fitEff));
    expect(track.dataset.chartWindowN).toBe("1000");
    expect(thumbs()).toHaveLength(2);
    // 트랙은 layout 이 예약한 자리 (플롯 아래) — 상자 좌표가 layout.windowTrack 과 같다.
    const box = expected.layout.windowTrack!;
    const chartRect = host
      .querySelector(".react-aria-Chart")!
      .getBoundingClientRect();
    const rect = track.getBoundingClientRect();
    expect(rect.left - chartRect.left).toBeCloseTo(box.x, 0);
    expect(rect.top - chartRect.top).toBeCloseTo(box.y, 0);
    expect(rect.width).toBeCloseTo(box.w, 0);
    expect(rect.height).toBeCloseTo(box.h, 0);
    // thumb (18) 이 예약 높이 (24) 안에 든다.
    const thumbRect = host
      .querySelector(".react-aria-SliderThumb")!
      .getBoundingClientRect();
    expect(thumbRect.top).toBeGreaterThanOrEqual(rect.top - 0.5);
    expect(thumbRect.bottom).toBeLessThanOrEqual(rect.bottom + 0.5);
    await vi.waitFor(() => expect(barCount()).toBe(fitEff));
    const ticks0 = tickTexts();
    // 범주 눈금은 stride 로 솎아지지만 첫 눈금은 창의 첫 범주다.
    expect(ticks0[0]).toBe("c0");

    const [input, endInput] = thumbs();
    expect(input.min).toBe("0");
    expect(input.step).toBe("1");
    expect(endInput.max).toBe("1000");
    input.focus();
    // 시작 thumb 화살표 — 최소 창이 end 를 밀어 창이 통째로 1 슬롯 이동 (211 과 같은 화면).
    await userEvent.keyboard("{ArrowRight}");
    await vi.waitFor(() =>
      expect(slider()!.dataset.chartWindowStart).toBe("1"),
    );
    expect(slider()!.dataset.chartWindowEnd).toBe(String(fitEff + 1));
    expect(barCount()).toBe(fitEff);
    await userEvent.keyboard("{Home}");
    await vi.waitFor(() =>
      expect(slider()!.dataset.chartWindowStart).toBe("0"),
    );
    // 끝 thumb End — 창을 n 까지 넓힌다: 조각 [0, 1000) 이 fitEff bucket 으로 집계된다 (마크 = fitEff).
    endInput.focus();
    await userEvent.keyboard("{End}");
    await vi.waitFor(() =>
      expect(slider()!.dataset.chartWindowEnd).toBe("1000"),
    );
    expect(slider()!.dataset.chartWindowStart).toBe("0");
    await vi.waitFor(() => expect(barCount()).toBe(fitEff));
    const ticksEnd = tickTexts();
    expect(ticksEnd.some((t) => t?.includes("~"))).toBe(true);
    // 값 축 눈금 (domain) 은 창과 무관 — 눈금 문자열 집합에서 범주 라벨을 뺀 나머지가 같다.
    const numeric = (list: (string | null)[]) =>
      list.filter((t) => t && !t.startsWith("c")).join("|");
    expect(numeric(ticksEnd)).toBe(numeric(ticks0));
    // 끝 thumb 은 최소 창보다 좁아지지 않는다 — Home 은 end = start + fitEff 로 멈춘다.
    await userEvent.keyboard("{Home}");
    await vi.waitFor(() =>
      expect(slider()!.dataset.chartWindowEnd).toBe(String(fitEff)),
    );

    // 같은 rows 재전송 (postMessage 동형) 은 창을 지키고, 다른 데이터는 [0, fitEff] 로 reset.
    await userEvent.keyboard("{End}");
    await vi.waitFor(() =>
      expect(slider()!.dataset.chartWindowEnd).toBe("1000"),
    );
    mount(structuredClone(rows));
    await new Promise((r) => requestAnimationFrame(r));
    expect(slider()!.dataset.chartWindowEnd).toBe("1000");
    mount(rowsOf(800));
    await vi.waitFor(() =>
      expect(slider()!.dataset.chartWindowN).toBe("800"),
    );
    expect(slider()!.dataset.chartWindowStart).toBe("0");
    expect(slider()!.dataset.chartWindowEnd).toBe(String(fitEff));
  });

  it("본체 (채움) 드래그 = 창 이동 (길이 보존, d3 MODE_DRAG) · [−start, n − end] clamp", async () => {
    const rows = rowsOf(1000);
    mount(rows);
    await vi.waitFor(() => expect(slider()).toBeTruthy());
    const track = slider()!;
    const fitEff = Number(track.dataset.chartWindowEnd);
    const fill = track.querySelector<HTMLElement>(".slider-fill")!;
    const rect = fill.getBoundingClientRect();
    const slot = track.getBoundingClientRect().width / 1000;
    const down = (x: number) =>
      fill.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerId: 7,
          clientX: x,
          clientY: rect.top + rect.height / 2,
          button: 0,
        }),
      );
    const move = (x: number) =>
      track.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerId: 7,
          clientX: x,
          clientY: rect.top + rect.height / 2,
        }),
      );
    const up = (x: number) =>
      track.dispatchEvent(
        new PointerEvent("pointerup", { bubbles: true, pointerId: 7, clientX: x }),
      );
    const x0 = rect.left + rect.width / 2;
    down(x0);
    move(x0 + slot * 300);
    await vi.waitFor(() =>
      expect(track.dataset.chartWindowStart).toBe("300"),
    );
    expect(track.dataset.chartWindowEnd).toBe(String(300 + fitEff));
    // n − end 를 넘는 dx 는 마지막 창에서 멈춘다.
    move(x0 + slot * 5000);
    await vi.waitFor(() =>
      expect(track.dataset.chartWindowEnd).toBe("1000"),
    );
    expect(track.dataset.chartWindowStart).toBe(String(1000 - fitEff));
    up(x0 + slot * 5000);
    expect(barCount()).toBe(fitEff);
  });

  it("넘치지 않으면 Slider 가 없다", async () => {
    mount(rowsOf(10));
    await vi.waitFor(() => expect(barCount()).toBe(10));
    expect(slider()).toBeNull();
  });
});

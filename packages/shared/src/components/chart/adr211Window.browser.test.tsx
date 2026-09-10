/**
 * ADR-211 P3 (G3) — DOM leg 창 트랙: RechartsChart 안의 뷰 상태 Slider.
 *
 * 계약 (breakdown §2.5): thumb 하나 · `0 … n − fitEff` · step 1 — 화살표 1 슬롯, End 로 마지막
 * 창 (창 길이 불변) · 데이터 identity 가 바뀌면 0 으로 reset · 같은 rows 재전송은 창 유지 ·
 * 축 범위 (domain) 는 창과 무관 · 트랙은 layout 이 예약한 자리 (플롯 아래) 에 놓인다.
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
  host.querySelector<HTMLElement>(".react-aria-Chart .react-aria-Slider");
const thumb = () =>
  host.querySelector<HTMLInputElement>(
    ".react-aria-Chart .react-aria-SliderThumb input",
  );
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
  it("1,000 범주 bar: 창 0 부터 End 로 마지막 창까지, 창 길이 불변 · domain 불변 · 트랙 자리 = layout", async () => {
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
    expect(track.getAttribute("aria-label")).toBe("Visible range");
    expect(track.dataset.chartWindowStart).toBe("0");
    expect(track.dataset.chartWindowMax).toBe(String(max));
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

    const input = thumb()!;
    expect(input.min).toBe("0");
    expect(input.max).toBe(String(max));
    expect(input.step).toBe("1");
    input.focus();
    await userEvent.keyboard("{ArrowRight}");
    await vi.waitFor(() =>
      expect(slider()!.dataset.chartWindowStart).toBe("1"),
    );
    expect(barCount()).toBe(fitEff);
    await userEvent.keyboard("{End}");
    await vi.waitFor(() =>
      expect(slider()!.dataset.chartWindowStart).toBe(String(max)),
    );
    expect(barCount()).toBe(fitEff);
    const ticksEnd = tickTexts();
    expect(ticksEnd[0]).toBe(`c${max}`);
    expect(ticksEnd).not.toContain("c0");
    // 값 축 눈금 (domain) 은 창과 무관 — 눈금 문자열 집합에서 범주 라벨을 뺀 나머지가 같다.
    const numeric = (list: (string | null)[]) =>
      list.filter((t) => t && !t.startsWith("c")).join("|");
    expect(numeric(ticksEnd)).toBe(numeric(ticks0));
    await userEvent.keyboard("{ArrowRight}");
    expect(slider()!.dataset.chartWindowStart).toBe(String(max));
    await userEvent.keyboard("{Home}");
    await vi.waitFor(() =>
      expect(slider()!.dataset.chartWindowStart).toBe("0"),
    );

    // 같은 rows 재전송 (postMessage 동형) 은 창을 지키고, 다른 데이터는 0 으로 reset.
    await userEvent.keyboard("{End}");
    await vi.waitFor(() =>
      expect(slider()!.dataset.chartWindowStart).toBe(String(max)),
    );
    mount(structuredClone(rows));
    await new Promise((r) => requestAnimationFrame(r));
    expect(slider()!.dataset.chartWindowStart).toBe(String(max));
    mount(rowsOf(800));
    await vi.waitFor(() =>
      expect(slider()!.dataset.chartWindowMax).toBe(String(800 - fitEff)),
    );
    expect(slider()!.dataset.chartWindowStart).toBe("0");
  });

  it("넘치지 않으면 Slider 가 없다", async () => {
    mount(rowsOf(10));
    await vi.waitFor(() => expect(barCount()).toBe(10));
    expect(slider()).toBeNull();
  });
});

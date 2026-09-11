/**
 * ADR-210 P3 / G3 — DOM(Recharts) leg 가 새 표시 설정을 **Canvas scene 과 같은 문자열·색·기하**
 * 로 소비하는가 (R4 · R6). T10 (light/dark · 크기 · 긴 한글 이름/통화 · padding) 과 T11
 * (UI 언어 ≠ 값 locale · 렌더/키보드 canonical write 0 · publish 와 같은 컨테이너 경로).
 *
 * 오라클은 `computeChartScene` 의 text mark (축 눈금 · 범례 · 값 라벨) 와 `formatChartNumber`
 * 손계산이다 — Recharts 가 만든 문자열을 Recharts 로 검증하지 않는다.
 */
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import {
  CHART_DEFAULT_METRICS,
  CHART_DEFAULT_PROPS,
  CHART_INVALID_SETTINGS_TEXT,
  computeChartScene,
  createChartInitialProps,
  formatChartNumber,
  resolveChartPresentation,
  resolveToken,
  seriesIdentity,
  type ChartProps,
  type ChartRow,
  type PathMark,
  type RectMark,
  type SizeSpec,
  type TextMark,
  type TokenRef,
} from "@composition/specs";
import { SKIA_PRIMITIVES } from "@composition/specs/renderers";
import { COMPONENT_RULES_TABLE } from "../../catalog/generated/componentRulesTable";
import { Chart } from "../Chart";
import { RechartsChart } from "./RechartsChart";
import { renderChartWindowTrack } from "./windowTrack";
import { compareBoundaries } from "./chartBoundaryOracle";
import "../styles/theme/preview-system.css";
import "../styles/theme/shared-tokens.css";
import "../styles/theme/generated/tailwind-palette.css";
import "../styles/theme/generated/semantic-palette.css";
import "../styles/theme/generated/chart-palette.css";
import "../styles/generated/Chart.css";

let root: Root | undefined;
let host: HTMLDivElement;
afterEach(() => {
  root?.unmount();
  host?.remove();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("lang");
});

/** 원본 wide 행 — 저장 변환 0. 긴 한글 범주 + 통화 단위 값 (T10 "긴 한글 이름/통화"). */
const wide: ChartRow[] = [
  { month: "1분기 누적", desktop: 1234.5, mobile: 812 },
  { month: "2분기 누적", desktop: 640, mobile: 1010.25 },
  { month: "3분기 누적", desktop: 905, mobile: 300 },
];
const MOBILE_TOKEN = "--chart-series-5";
const LABEL_DESKTOP = "데스크톱 방문자 (월간 합계)";
const LABEL_MOBILE = "모바일 방문자 (월간 합계)";

/** columns + 시리즈 설정 + 통화 — P2 패널이 저장하는 형태 그대로. */
function columnsProps(patch: Partial<ChartProps> = {}): ChartProps {
  return {
    ...CHART_DEFAULT_PROPS,
    dimension: "month",
    dataMode: "columns",
    valueFields: ["desktop", "mobile"],
    seriesConfig: [
      { key: seriesIdentity("field", "desktop"), label: LABEL_DESKTOP },
      {
        key: seriesIdentity("field", "mobile"),
        label: LABEL_MOBILE,
        colorToken: MOBILE_TOKEN,
      },
    ],
    valueFormat: "currency",
    valueCurrency: "KRW",
    valueLocale: "ko-KR",
    showAxis: true,
    showGrid: true,
    showLegend: true,
    showValueLabels: true,
    showTooltip: true,
    isAnimationActive: false,
    ...patch,
  };
}

const palette = Array.from(
  { length: 12 },
  (_, i) => `rgb(${20 + i * 15}, ${30 + i * 10}, ${180 - i * 10})`,
);

function mountRuntime(
  props: ChartProps,
  rows: readonly ChartRow[],
  size: { width: number; height: number },
  metrics = CHART_DEFAULT_METRICS,
): void {
  host = document.createElement("div");
  palette.forEach((paint, i) =>
    host.style.setProperty(`--chart-series-${i + 1}`, paint),
  );
  document.body.append(host);
  root = createRoot(host);
  root.render(
    <RechartsChart
      renderWindowTrack={renderChartWindowTrack}
      props={props}
      rows={rows}
      size={size}
      metrics={metrics}
      label="ADR-210 chart"
    />,
  );
}

/** DOM 의 text 노드 하나를 scene text mark 목록에서 찾아 소거한다 (문자열 + 좌표 ≤1px). */
function consumeText(
  remaining: TextMark[],
  text: SVGTextElement,
  context: string,
): void {
  const at = remaining.findIndex(
    (mark) =>
      mark.text === text.textContent &&
      Math.abs(mark.x - Number(text.getAttribute("x"))) <= 1 &&
      Math.abs(mark.y - Number(text.getAttribute("y"))) <= 1,
  );
  expect(
    at,
    `${context}: ${text.outerHTML} not in ${JSON.stringify(remaining)}`,
  ).toBeGreaterThanOrEqual(0);
  remaining.splice(at, 1);
}

const MARK_SELECTOR = {
  bar: ".recharts-bar-rectangle path",
  line: ".recharts-line-curve",
  area: ".recharts-area-area",
  radar: ".recharts-radar-polygon path",
} as const;

/**
 * DOM leg 전체를 scene 과 대조한다 — 축 눈금·범례 (장식 텍스트) · 값 라벨 · 마크 경계 ≤1px ·
 * 시리즈 색 (palette index). 반환값은 scene (호출자가 추가 판정에 쓴다).
 */
async function expectDomMatchesScene(
  props: ChartProps,
  rows: readonly ChartRow[],
  size: { width: number; height: number },
  metrics = CHART_DEFAULT_METRICS,
) {
  const scene = computeChartScene(props, rows, size, metrics);
  expect(scene.empty).toBe(false);
  const type = props.chartType as keyof typeof MARK_SELECTOR;
  const expectedMarks = scene.marks.filter(
    (mark): mark is PathMark | RectMark =>
      (mark.kind === "path" || mark.kind === "rect") &&
      !(mark.kind === "path" && mark.d.includes(" A ") && props.showDots),
  );
  await vi.waitFor(() =>
    expect(host.querySelectorAll(MARK_SELECTOR[type]).length).toBe(
      expectedMarks.length,
    ),
  );

  // 장식 텍스트 (축 눈금 + 범례) — 문자열이 scene 과 같아야 한다 (R6 "한 renderer 에만").
  const decorationTexts = Array.from(
    host.querySelectorAll<SVGTextElement>("[data-chart-decoration] text"),
  );
  const expectedDecoration: TextMark[] = [
    ...scene.axes.flatMap((axis) => axis.ticks),
    ...(scene.legend?.items.map((item) => item.text) ?? []),
  ];
  expect(decorationTexts.length, `${type} decoration count`).toBe(
    expectedDecoration.length,
  );
  const remainingDecoration = [...expectedDecoration];
  for (const text of decorationTexts)
    consumeText(remainingDecoration, text, `${type} decoration`);

  // 값 라벨 — raw 통화 문자열 (expand 여도 정규화하지 않는다).
  const valueTexts = Array.from(
    host.querySelectorAll<SVGTextElement>("svg text"),
  ).filter((text) => !text.closest("[data-chart-decoration]"));
  const remainingValues = scene.marks.filter(
    (mark): mark is TextMark => mark.kind === "text",
  );
  expect(valueTexts.length, `${type} value label count`).toBe(
    remainingValues.length,
  );
  for (const text of valueTexts)
    consumeText(remainingValues, text, `${type} value`);

  // 마크 경계와 시리즈 색.
  const remainingMarks = [...expectedMarks];
  for (const path of Array.from(
    host.querySelectorAll<SVGPathElement>(MARK_SELECTOR[type]),
  )) {
    const distances = remainingMarks.map((mark) =>
      compareBoundaries(path, mark),
    );
    const best = Math.min(...distances);
    const [mark] = remainingMarks.splice(distances.indexOf(best), 1);
    expect(best, `${type} boundary`).toBeLessThanOrEqual(1);
    const paint = getComputedStyle(path);
    const fillSeries =
      mark.kind === "rect" ? mark.seriesIndex : mark.fillSeries;
    if (fillSeries !== undefined)
      expect(paint.fill, `${type} fill`).toBe(palette[fillSeries]);
    if (mark.kind === "path" && mark.strokeSeries !== undefined)
      expect(paint.stroke, `${type} stroke`).toBe(palette[mark.strokeSeries]);
  }
  return scene;
}

describe("ADR-210 P3 · T10 — columns + 시리즈 설정 + 통화의 DOM/scene 문자열·색·기하", () => {
  for (const chartType of ["bar", "line", "area", "radar"] as const)
    for (const stackType of ["dodged", "stacked", "expand"] as const)
      for (const size of [
        { width: 320, height: 240 },
        { width: 640, height: 360 },
      ]) {
        if (chartType === "radar" && stackType !== "dodged") continue;
        it(`${chartType} ${stackType} ${size.width}×${size.height}`, async () => {
          const props = columnsProps({ chartType, stackType });
          mountRuntime(props, wide, size);
          const scene = await expectDomMatchesScene(props, wide, size);
          // 범례는 표시 이름이고 (원본 key 아님), mobile 은 지정 토큰의 palette index 4.
          const legend = scene.legend!.items.map((item) => item.text.text);
          expect(legend).toEqual([LABEL_DESKTOP, LABEL_MOBILE]);
          const mobile = scene.marks.find(
            (mark) =>
              (mark.kind === "rect" && mark.seriesIndex === 4) ||
              (mark.kind === "path" &&
                (mark.fillSeries === 4 || mark.strokeSeries === 4)),
          );
          expect(mobile, "mobile series uses --chart-series-5").toBeTruthy();
          if (chartType !== "radar") {
            const ticks = scene.axes[1].ticks.map((tick) => tick.text);
            if (stackType === "expand")
              // expand 축만 정규화 % — 통화 형식이어도 축은 %다 (R4 2500% 금지).
              expect(ticks.every((tick) => /%$/.test(tick))).toBe(true);
            else
              // raw 축은 KRW 통화 문자열 (ko-KR).
              expect(ticks.every((tick) => tick.startsWith("₩"))).toBe(true);
          }
        });
      }

  it("사용자 padding 은 두 leg 가 같은 metrics 로 읽는다 (plot 이동, 문자열 불변)", async () => {
    const size = { width: 480, height: 320 };
    const padded = {
      ...CHART_DEFAULT_METRICS,
      padding: { top: 8, right: 16, bottom: 24, left: 40 },
    };
    const props = columnsProps({ chartType: "bar", stackType: "stacked" });
    mountRuntime(props, wide, size, padded);
    const scene = await expectDomMatchesScene(props, wide, size, padded);
    const flat = computeChartScene(props, wide, size);
    expect(scene.plot.x).toBeGreaterThan(flat.plot.x);
    expect(scene.axes[1].ticks.map((t) => t.text)).toEqual(
      flat.axes[1].ticks.map((t) => t.text),
    );
  });

  for (const theme of ["light", "dark"] as const)
    it(`${theme}: 지정 토큰 --chart-series-5 를 실제 CSS 와 Skia 가 같은 색으로 푼다`, async () => {
      document.documentElement.setAttribute("data-theme", theme);
      const rule = COMPONENT_RULES_TABLE.Chart;
      const props = columnsProps({ chartType: "bar" });
      const size = { width: 480, height: 300 };
      const shapes = SKIA_PRIMITIVES.chart_scene({
        props: {
          ...props,
          data: wide,
          _chartRule: rule.chart,
          _containerWidth: size.width,
          _containerHeight: size.height,
        },
        size: rule.sizes.md as SizeSpec,
        visual: undefined,
        paint: {
          backgroundColor: "{color.layer-1}",
          color: "{color.neutral}",
          borderColor: "{color.border}",
          backgroundAlpha: 1,
          staticTrackWash: false,
          hasVisibleBoxPaint: true,
          hasOpaqueCatalogBackground: true,
        },
        style: undefined,
      })!;
      const skiaTokens = shapes
        .filter((shape) => shape.type === "rect")
        .map((shape) => (shape as { fill?: string }).fill);
      expect(new Set(skiaTokens)).toEqual(
        new Set([rule.chart!.series[0], rule.chart!.series[4]]),
      );
      // Skia 는 표시 이름·통화 문자열을 text shape 로 낸다 (Canvas leg 의 문자열).
      const skiaTexts = shapes
        .filter((shape) => shape.type === "text")
        .map((shape) => (shape as { text: string }).text);
      expect(skiaTexts).toContain(LABEL_MOBILE);
      expect(skiaTexts.some((text) => text.startsWith("₩"))).toBe(true);

      host = document.createElement("div");
      document.body.append(host);
      root = createRoot(host);
      root.render(<Chart {...props} data={wide} size="md" style={size} />);
      await vi.waitFor(() =>
        expect(
          host.querySelectorAll(".recharts-bar-rectangle path").length,
        ).toBe(6),
      );
      const rgba = (paint: string): number[] => {
        const ctx = document.createElement("canvas").getContext("2d")!;
        ctx.fillStyle = paint;
        ctx.fillRect(0, 0, 1, 1);
        return Array.from(ctx.getImageData(0, 0, 1, 1).data);
      };
      const fills = new Set(
        Array.from(
          host.querySelectorAll<SVGPathElement>(".recharts-bar-rectangle path"),
        ).map((path) => getComputedStyle(path).fill),
      );
      const expected = [0, 4].map((i) =>
        rgba(String(resolveToken(rule.chart!.series[i] as TokenRef, theme))),
      );
      expect(fills.size).toBe(2);
      for (const fill of fills) {
        const actual = rgba(fill);
        expect(
          expected.some((candidate) =>
            candidate.every(
              (channel, index) => Math.abs(channel - actual[index]) <= 1,
            ),
          ),
          `${theme} fill ${fill}`,
        ).toBe(true);
      }
      const domTexts = Array.from(host.querySelectorAll("svg text")).map(
        (text) => text.textContent,
      );
      // 두 leg 의 문자열 집합이 같다.
      expect(new Set(domTexts)).toEqual(new Set(skiaTexts));
    });
});

describe("ADR-210 P3 · T11 — UI 언어 ≠ 값 locale · 키보드 tooltip · write 0", () => {
  for (const [lang, valueLocale, prefix] of [
    ["ko", "en-US", "$"],
    ["en", "ko-KR", "US$"],
  ] as const)
    it(`document lang=${lang} 이어도 값은 valueLocale=${valueLocale} (${prefix}) 를 따른다`, async () => {
      document.documentElement.setAttribute("lang", lang);
      const props = columnsProps({
        chartType: "bar",
        valueCurrency: "USD",
        valueLocale,
        valueFractionDigits: 0,
      });
      const rows = wide.map((row) => Object.freeze({ ...row }));
      Object.freeze(rows);
      Object.freeze(props);
      const before = JSON.stringify({ props, rows });
      host = document.createElement("div");
      document.body.append(host);
      root = createRoot(host);
      root.render(
        <Chart
          {...props}
          data={rows}
          size="md"
          style={{ width: 480, height: 300 }}
        />,
      );
      await vi.waitFor(() =>
        expect(
          host.querySelectorAll(".recharts-bar-rectangle path").length,
        ).toBe(6),
      );
      // 값 축 눈금만 — 범주 라벨 ("1분기 누적") 도 숫자를 품으므로 scene 의 값 축으로 고른다.
      const valueTicks = computeChartScene(props, rows, {
        width: 480,
        height: 300,
      }).axes[1].ticks.map((tick) => tick.text);
      const domTexts = Array.from(
        host.querySelectorAll("[data-chart-decoration] text"),
      ).map((text) => text.textContent ?? "");
      expect(valueTicks.length).toBeGreaterThan(0);
      for (const tick of valueTicks) expect(domTexts).toContain(tick);
      expect(valueTicks.every((tick) => tick.startsWith(prefix))).toBe(true);
      const ticks = valueTicks;
      const presentation = resolveChartPresentation(
        props,
        CHART_DEFAULT_METRICS.seriesCount,
      );
      expect(ticks).toContain(
        formatChartNumber(0, presentation.numberFormat, "raw"),
      );

      // 키보드 tooltip — 표시 이름 + 같은 formatter 의 raw 문자열 (Recharts accessibilityLayer).
      const application = host.querySelector<SVGSVGElement>(
        'svg[role="application"]',
      )!;
      application.focus();
      await userEvent.keyboard("{ArrowRight}");
      await vi.waitFor(() =>
        expect(
          host.querySelector(".react-aria-Chart-tooltip")?.textContent,
        ).toContain(LABEL_MOBILE),
      );
      const tooltip =
        host.querySelector(".react-aria-Chart-tooltip")!.textContent ?? "";
      expect(tooltip).toContain(LABEL_DESKTOP);
      // 어느 범주에 멈췄든 raw 값 문자열은 formatter 출력 중 하나다.
      const rawStrings = wide.flatMap((row) => [
        formatChartNumber(
          Number(row.desktop),
          presentation.numberFormat,
          "raw",
        ),
        formatChartNumber(Number(row.mobile), presentation.numberFormat, "raw"),
      ]);
      expect(rawStrings.some((text) => tooltip.includes(text))).toBe(true);
      expect(tooltip).not.toContain("desktop");
      await userEvent.hover(application);
      // 렌더·키보드·hover 가 props/rows 를 쓰지 않는다 (canonical write 0 의 컨테이너 측 근거).
      expect(JSON.stringify({ props, rows })).toBe(before);
    });

  it("설정 오류 (columns + pie) 는 DOM 도 Canvas 와 같은 안내 텍스트를 내고 데이터를 보존한다", async () => {
    const props = columnsProps({ chartType: "pie", showValueLabels: false });
    const rows = wide.map((row) => Object.freeze({ ...row }));
    const before = JSON.stringify(rows);
    const scene = computeChartScene(props, rows, { width: 320, height: 240 });
    expect(scene.empty).toBe(true);
    expect(
      scene.marks.some(
        (mark) =>
          mark.kind === "text" && mark.text === CHART_INVALID_SETTINGS_TEXT,
      ),
    ).toBe(true);
    expect(scene.diagnostics?.map((d) => d.code)).toContain(
      "columns.unsupportedChartType",
    );
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    root.render(
      <Chart
        {...props}
        data={rows}
        size="md"
        style={{ width: 320, height: 240 }}
      />,
    );
    await vi.waitFor(() =>
      expect(host.querySelector('[role="status"]')?.textContent).toBe(
        CHART_INVALID_SETTINGS_TEXT,
      ),
    );
    expect(
      host
        .querySelector('[role="status"]')
        ?.getAttribute("data-chart-diagnostics"),
    ).toContain("columns.unsupportedChartType");
    expect(host.querySelector(".recharts-surface")).toBeNull();
    expect(
      host
        .querySelector(".react-aria-Chart")
        ?.getAttribute("data-chart-row-count"),
    ).toBe("3");
    expect(JSON.stringify(rows)).toBe(before);
  });
});

describe("ADR-210 P3 — legacy 6종의 장식 문자열은 auto 그대로 (기존 경로 보존)", () => {
  for (const chartType of [
    "bar",
    "line",
    "area",
    "pie",
    "radar",
    "radial",
  ] as const)
    it(`${chartType} 축 눈금·범례 문자열이 scene 과 같다`, async () => {
      const initial = createChartInitialProps(chartType);
      const props: ChartProps = {
        ...initial,
        isAnimationActive: false,
        showAxis: true,
      };
      const size = { width: 320, height: 240 };
      mountRuntime(props, initial.data, size);
      const scene = computeChartScene(props, initial.data, size);
      await vi.waitFor(() =>
        expect(host.querySelector(".recharts-surface")).toBeTruthy(),
      );
      const expected: TextMark[] = [
        ...scene.axes.flatMap((axis) => axis.ticks),
        ...(scene.legend?.items.map((item) => item.text) ?? []),
      ];
      await vi.waitFor(() =>
        expect(
          host.querySelectorAll("[data-chart-decoration] text").length,
        ).toBe(expected.length),
      );
      const remaining = [...expected];
      for (const text of Array.from(
        host.querySelectorAll<SVGTextElement>("[data-chart-decoration] text"),
      ))
        consumeText(remaining, text, `${chartType} legacy decoration`);
      expect(remaining).toEqual([]);
    });
});

/**
 * ADR-194 Phase 4 G3 — DOM SVG leg ↔ Skia Shape leg 좌표 대칭.
 *
 * **무엇을 재는가**: 같은 props/rows/size 에서 두 consumer 가 낸 좌표가 **문자·숫자 단위로
 * 같은지**. path 는 `d` 문자열 byte 동일, rect 는 x/y/w/h 동일, line 은 양 끝점 동일,
 * text 는 위치·문자열 동일.
 *
 * **왜 이 형태인가**: 스크린샷 비교는 폰트 래스터화 차이 때문에 항상 Δ가 있어 임계값
 * 논쟁이 되고, 그 임계값 아래로 진짜 좌표 오차가 숨는다. 두 leg 이 같은 기하 함수를
 * 쓴다는 것이 본 ADR 의 구조적 주장이므로, 그 주장을 **숫자 동일성** 으로 직접 검증한다.
 * (픽셀 층은 Phase 1 의 CanvasKit 테스트와 ADR-198 visual-parity 게이트가 본다.)
 *
 * 두 leg 이 같은 `computeChartScene` 을 부르므로 "당연히 같다" 로 보일 수 있지만, 이
 * 테스트가 잡는 것은 그 다음 단계다 — **scene → 화면 표현으로 옮기는 과정에서 좌표를
 * 흘리거나 재계산하는 것**. 실제로 두 파일 모두 offset/bbox/순서를 각자 다루므로
 * 여기서 갈릴 수 있다.
 *
 * **측정 조건 (중요)**: shared 는 `@composition/specs` 를 **dist** 로 해석한다. 그래서 이
 * 테스트는 src 가 아니라 **빌드된 specs** 를 잰다 — production 이 쓰는 것과 같은 산출물이라
 * 옳은 대상이지만, dist 가 stale 하면 이 테스트는 조용히 vacuous 해진다. 실제로 falsify
 * 시도(Skia leg 좌표 +1)를 rebuild 없이 돌렸을 때 28건이 그대로 통과했고, rebuild 후에야
 * 4건이 RED 로 반응했다(2026-09-08). specs 를 고쳤으면 `pnpm -F @composition/specs build`
 * 를 먼저 돌린다 (cross-check skill §5.0 dist 신선도 게이트와 같은 규율).
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CHART_DEFAULT_PROPS,
  computeChartScene,
  resolveChartMetrics,
  skiaTextAnchorX,
} from "@composition/specs";
import type { ChartProps, ChartRow, Shape } from "@composition/specs";
import { SKIA_PRIMITIVES } from "@composition/specs/renderers";
import { renderChartScene } from "../Chart";
import { COMPONENT_RULES_TABLE } from "../../catalog/generated/componentRulesTable";

const ROWS: ChartRow[] = [
  { category: "Mon", value: 12, series: "A" },
  { category: "Tue", value: 30, series: "A" },
  { category: "Wed", value: 18, series: "A" },
  { category: "Mon", value: 20, series: "B" },
  { category: "Tue", value: 8, series: "B" },
  { category: "Wed", value: 25, series: "B" },
];

const SIZE = { width: 360, height: 260 };
const CHART_RULE = COMPONENT_RULES_TABLE.Chart;

function props(overrides: Partial<ChartProps> = {}): ChartProps {
  return { ...CHART_DEFAULT_PROPS, color: "series", ...overrides };
}

/** Skia leg — `chart_scene` primitive 를 실제 dispatch 계약대로 부른다. */
function skiaShapes(chartProps: ChartProps): Shape[] {
  const draw = SKIA_PRIMITIVES.chart_scene;
  expect(draw, "chart_scene primitive 가 등록돼 있다").toBeTypeOf("function");
  const shapes = draw({
    props: {
      ...chartProps,
      size: "md",
      data: ROWS,
      _containerWidth: SIZE.width,
      _containerHeight: SIZE.height,
      _chartRule: CHART_RULE.chart,
    },
    size: CHART_RULE.sizes.md as never,
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
  });
  expect(shapes, "chart_scene 은 null 을 반환하지 않는다").not.toBeNull();
  return shapes!;
}

/** DOM leg — 서버 렌더한 SVG 마크업에서 좌표를 뽑는다. */
function domMarkup(chartProps: ChartProps): string {
  const metrics = resolveChartMetrics(CHART_RULE.chart, "md");
  const scene = computeChartScene(chartProps, ROWS, SIZE, metrics);
  return renderToStaticMarkup(<svg>{renderChartScene(scene)}</svg>);
}

function attr(markup: string, tag: string, name: string): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${name}="([^"]*)"`, "g");
  return [...markup.matchAll(re)].map((m) => m[1]);
}

const CASES: Array<[string, ChartProps]> = [
  ["bar / vertical / dodged", props()],
  [
    "bar / horizontal / stacked",
    props({ orientation: "horizontal", stackType: "stacked" }),
  ],
  ["line / grid + legend", props({ chartType: "line", showGrid: true, showLegend: true })],
  ["area / vertical", props({ chartType: "area" })],
  [
    "line / monotone + dots",
    props({ chartType: "line", curve: "monotone", showDots: true }),
  ],
  [
    "area / stacked 100% + step",
    props({ chartType: "area", stackType: "expand", curve: "step" }),
  ],
  [
    "bar / mixed + value labels",
    props({ colorBy: "category", showValueLabels: true }),
  ],
  [
    "pie / value labels + legend",
    props({ chartType: "pie", showValueLabels: true, showLegend: true }),
  ],
  [
    "pie / donut + total",
    props({ chartType: "pie", innerRadius: 60, showTotal: true }),
  ],
  [
    "pie / stacked rings",
    props({ chartType: "pie", stackType: "stacked", innerRadius: 30 }),
  ],
  // 툴팁은 DOM 전용 축이다 (Skia 는 showTooltip=false 로 고정). 이 케이스가
  //   GREEN 이라는 것은 툴팁이 **정적 마크를 건드리지 않는다**는 뜻이다.
  ["bar / tooltip on", props({ showTooltip: true })],
  ["pie / legend right", props({ chartType: "pie", showLegend: true, legendPosition: "right" })],
  // ADR-207 극좌표 — 격자가 `PathMark` 로 오는 유일한 자리다 (`AxisScene.grid` 유니온
  //   확장이 두 leg 을 실제로 지나는지 여기서 확인한다).
  [
    "radar / polygon grid",
    props({ chartType: "radar", showGrid: true, gridType: "polygon" }),
  ],
  [
    "radar / circle grid + legend",
    props({
      chartType: "radar",
      showGrid: true,
      gridType: "circle",
      showLegend: true,
    }),
  ],
  ["radial / 단일 시리즈", props({ chartType: "radial", color: "" })],
  [
    "radial / 누적 + 값 레이블",
    props({ chartType: "radial", stackType: "stacked", showValueLabels: true }),
  ],
  // shadcn 대조 후속 #1 — radar 격자·선 제어. 격자 링에 `fillRole` 이 실리는
  //   유일한 자리이고, `fillArea:false` 는 `fillSeries` 자체를 빼는 자리다.
  [
    "radar / lines-only (fillArea off, 스포크 off)",
    props({
      chartType: "radar",
      showGrid: true,
      showSpokes: false,
      fillArea: false,
    }),
  ],
  [
    "radar / 격자 채우기 + 링 1개",
    props({
      chartType: "radar",
      showGrid: true,
      fillGrid: true,
      gridRings: 1,
      gridType: "circle",
    }),
  ],
  // 후속 #5 — 극좌표 각도 범위. 트랙·값 호가 같은 부분 범위만 도는지, 중앙 합계가
  //   두 leg 에 같은 자리로 오는지 (fontScale 1.8 채널 포함).
  [
    "radial / 반원 게이지 + 중앙 합계",
    props({
      chartType: "radial",
      color: "",
      startAngle: 0,
      endAngle: 180,
      innerRadius: 60,
      showTotal: true,
    }),
  ],
  // 후속 #7 — 레이블 내용 축. 좌표는 그대로고 **글자만** 바뀌는 자리라, text 대칭
  //   검사가 내용까지 보는지 여기서 확인된다.
  [
    "pie / 조각 안 범주명 (label-list)",
    props({ chartType: "pie", showValueLabels: true, labelKey: "category" }),
  ],
  [
    "bar / 막대 위 범주명 (negative 계열)",
    props({ showValueLabels: true, labelKey: "category" }),
  ],
];

describe("ADR-194 G3 — DOM SVG ↔ Skia Shape 좌표 대칭", () => {
  for (const [name, chartProps] of CASES) {
    describe(name, () => {
      it("path `d` 문자열이 byte 동일하다", () => {
        const markup = domMarkup(chartProps);
        const domPaths = attr(markup, "path", "d");
        const skiaPaths = skiaShapes(chartProps)
          .filter((s): s is Extract<Shape, { type: "path" }> => s.type === "path")
          .map((s) => s.d);
        expect(skiaPaths).toEqual(domPaths);
      });

      it("rect 좌표가 동일하다 (컨테이너 box 제외 — DOM 은 CSS 가 그린다)", () => {
        const markup = domMarkup(chartProps);
        const domRects = attr(markup, "rect", "x").map((x, i) => [
          x,
          attr(markup, "rect", "y")[i],
          attr(markup, "rect", "width")[i],
          attr(markup, "rect", "height")[i],
        ]);
        const skiaRects = skiaShapes(chartProps)
          .filter((s): s is Extract<Shape, { type: "rect" }> => s.type === "rect")
          .map((s) => [
            String(s.x),
            String(s.y),
            String(s.width),
            String(s.height),
          ]);
        expect(skiaRects).toEqual(domRects);
      });

      it("line 양 끝점이 동일하다", () => {
        const markup = domMarkup(chartProps);
        const x1 = attr(markup, "line", "x1");
        const domLines = x1.map((v, i) => [
          v,
          attr(markup, "line", "y1")[i],
          attr(markup, "line", "x2")[i],
          attr(markup, "line", "y2")[i],
        ]);
        const skiaLines = skiaShapes(chartProps)
          .filter((s): s is Extract<Shape, { type: "line" }> => s.type === "line")
          .map((s) => [
            String(s.x1),
            String(s.y1),
            String(s.x2),
            String(s.y2),
          ]);
        expect(skiaLines).toEqual(domLines);
      });

      it("text 앵커 점·문자열이 동일하다 (좌표 raw 비교 금지 — 앵커 의미가 다르다)", () => {
        const markup = domMarkup(chartProps);
        const domX = attr(markup, "text", "x");
        const domY = attr(markup, "text", "y");
        const domContent = [...markup.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map(
          (m) => m[1],
        );
        const skiaTexts = skiaShapes(chartProps).filter(
          (s): s is Extract<Shape, { type: "text" }> => s.type === "text",
        );
        // Skia 의 x 는 문단 **박스 좌측**, DOM 의 x 는 **앵커 점** 이다. 같은 숫자를 비교하면
        //   중앙 정렬 레이블이 상자 한가운데로 몰리는 결함이 통과한다 (2026-09-08 live 실측).
        //   박스에서 앵커를 되돌려 비교한다.
        expect(
          skiaTexts.map((s) =>
            String(
              skiaTextAnchorX({
                x: s.x,
                align: s.align as "left" | "center" | "right",
                maxWidth: s.maxWidth,
              }),
            ),
          ),
        ).toEqual(domX);
        expect(skiaTexts.map((s) => String(s.y))).toEqual(domY);
        expect(skiaTexts.map((s) => s.text)).toEqual(domContent);
      });

      /**
       * **색 채널 대칭** — 좌표만 비교하면 "같은 자리에 다른 색" 이 통과한다.
       * ADR-207 P5 live 1차가 잡은 radial 트랙 결함이 정확히 그 형태였다 (좌표는
       * 옳고 채우기만 빠짐 — 두꺼운 링 하나가 동심원 둘로 읽혔다). 토큰 표현이 leg
       * 마다 달라(`var(--chart-grid)` vs `{color.border}`) 문자열을 직접 못 대므로
       * **역할로 분류해 개수를 맞춘다**.
       */
      it("축 토큰으로 칠/그은 path 개수가 두 leg 에서 같다", () => {
        const markup = domMarkup(chartProps);
        const domPaths = [...markup.matchAll(/<path\b[^>]*>/g)].map((m) => m[0]);
        const domGridFilled = domPaths.filter((p) =>
          /fill="var\(--chart-(grid|axis)/.test(p),
        ).length;
        const domGridStroked = domPaths.filter((p) =>
          /stroke="var\(--chart-(grid|axis)/.test(p),
        ).length;

        const axisTokens = new Set([CHART_RULE.chart?.grid, CHART_RULE.chart?.axis]);
        const skiaPaths = skiaShapes(chartProps).filter(
          (s): s is Extract<Shape, { type: "path" }> => s.type === "path",
        );
        const skiaGridFilled = skiaPaths.filter(
          (s) => s.fill !== undefined && axisTokens.has(s.fill as string),
        ).length;
        const skiaGridStroked = skiaPaths.filter(
          (s) => s.stroke !== undefined && axisTokens.has(s.stroke as string),
        ).length;

        expect({ filled: skiaGridFilled, stroked: skiaGridStroked }).toEqual({
          filled: domGridFilled,
          stroked: domGridStroked,
        });
      });

      it("시리즈 팔레트로 칠한 path 개수가 두 leg 에서 같다", () => {
        const markup = domMarkup(chartProps);
        const domPaths = [...markup.matchAll(/<path\b[^>]*>/g)].map((m) => m[0]);
        const domSeriesFilled = domPaths.filter((p) =>
          /fill="var\(--chart-series-/.test(p),
        ).length;
        const seriesTokens = new Set(CHART_RULE.chart?.series ?? []);
        const skiaSeriesFilled = skiaShapes(chartProps)
          .filter((s): s is Extract<Shape, { type: "path" }> => s.type === "path")
          .filter((s) => s.fill !== undefined && seriesTokens.has(s.fill as string))
          .length;
        expect(skiaSeriesFilled).toBe(domSeriesFilled);
      });

      it("마크 개수가 0 이 아니다 (빈 비교로 통과하는 것 차단)", () => {
        const shapes = skiaShapes(chartProps);
        const drawn = shapes.filter(
          (s) => s.type !== "roundRect" && s.type !== "border",
        );
        expect(drawn.length).toBeGreaterThan(0);
      });
    });
  }

  it("Skia leg 만 컨테이너 box 를 그린다 (DOM 은 .react-aria-Chart CSS 가 그린다)", () => {
    const shapes = skiaShapes(props());
    expect(shapes[0]).toMatchObject({ type: "roundRect", id: "chart-bg" });
    expect(shapes[1]).toMatchObject({ type: "border", target: "chart-bg" });
    // DOM SVG 에는 컨테이너 배경이 없다 — 있으면 이중으로 칠해진다.
    expect(domMarkup(props())).not.toContain('id="chart-bg"');
  });

  it("fontScale 은 DOM em 배율과 Skia fontSize 곱이 같은 값이다", () => {
    const chartProps = props({
      chartType: "pie",
      innerRadius: 60,
      showTotal: true,
    });
    const metrics = resolveChartMetrics(CHART_RULE.chart, "md");
    const scene = computeChartScene(chartProps, ROWS, SIZE, metrics);
    const scaled = scene.marks.filter(
      (m) => m.kind === "text" && m.fontScale !== undefined,
    );
    expect(scaled.length, "배율 텍스트가 실제로 있다").toBeGreaterThan(0);
    const scale = (scaled[0] as { fontScale: number }).fontScale;

    // DOM: 부모 svg 의 font-size 기준 em
    expect(domMarkup(chartProps)).toContain(`font-size="${scale}em"`);
    // Skia: 같은 기준 크기의 곱
    const skiaSizes = skiaShapes(chartProps)
      .filter((s): s is Extract<Shape, { type: "text" }> => s.type === "text")
      .map((s) => s.fontSize);
    expect(skiaSizes).toContain(metrics.fontSize * scale);
    expect(skiaSizes).toContain(metrics.fontSize);
  });

  it("색은 양쪽 다 인덱스로 해소된다 — scene 에 hex 가 없다", () => {
    const skiaFills = skiaShapes(props())
      .filter((s): s is Extract<Shape, { type: "rect" }> => s.type === "rect")
      .map((s) => s.fill);
    // Skia 는 TokenRef 를 싣는다 (converter 가 theme 과 함께 푼다).
    for (const fill of skiaFills) {
      expect(String(fill)).toMatch(/^\{color\./);
    }
    // DOM 은 CSS 변수를 싣는다 (같은 rule 이 emit 한 --chart-series-N).
    expect(domMarkup(props())).toContain("var(--chart-series-1");
  });

  it("팔레트 순서가 rule 과 같다 — 시리즈 1·2 = Spectrum categorical 1·2 (ADR-215)", () => {
    const skiaFills = skiaShapes(props())
      .filter((s): s is Extract<Shape, { type: "rect" }> => s.type === "rect")
      .map((s) => String(s.fill));
    expect(new Set(skiaFills)).toEqual(
      new Set(["{color.chart-categorical-1}", "{color.chart-categorical-2}"]),
    );
  });

  it("palette=mono — Skia 는 accent 사다리 토큰, DOM 은 data-palette 로 같은 CSS 블록을 고른다 (ADR-215)", () => {
    const mono = { ...props(), palette: "mono" as const };
    const skiaFills = skiaShapes(mono)
      .filter((s): s is Extract<Shape, { type: "rect" }> => s.type === "rect")
      .map((s) => String(s.fill));
    expect(new Set(skiaFills)).toEqual(
      new Set(["{color.chart-accent-1}", "{color.chart-accent-2}"]),
    );
    // DOM 은 scene 이 아니라 wrapper 의 `data-palette` 로 블록을 고른다 — scene markup 은 팔레트 무관
    //   (`var(--chart-series-N)` 그대로). wrapper 속성은 chartPalette.browser.test 가 본다.
    expect(domMarkup(mono)).toBe(domMarkup(props()));
  });
});

describe("ADR-216 — 시간 스케일 두 leg (Skia allowlist · 2단 라벨 · 시간 간격)", () => {
  const TIME_ROWS: ChartRow[] = [1, 2, 3, 4, 5, 7, 8, 9, 10].map((d, i) => ({
    date: `2026-01-${String(d).padStart(2, "0")}`,
    value: [1, 5, 2, 9, 3, 4, 8, 1, 6][i],
  }));
  const timeProps = (extra: Partial<ChartProps> = {}): ChartProps => ({
    ...CHART_DEFAULT_PROPS,
    chartType: "line",
    dimension: "date",
    metric: "value",
    dimensionScale: "time",
    ...extra,
  });
  const skiaTime = (chartProps: ChartProps): Shape[] =>
    SKIA_PRIMITIVES.chart_scene!({
      props: {
        ...chartProps,
        size: "md",
        data: TIME_ROWS,
        _containerWidth: SIZE.width,
        _containerHeight: SIZE.height,
        _chartRule: CHART_RULE.chart,
      },
      size: CHART_RULE.sizes.md as never,
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
  const texts = (shapes: Shape[]): string[] =>
    shapes
      .filter((s): s is Extract<Shape, { type: "text" }> => s.type === "text")
      .map((s) => s.text);

  it("Skia chart_scene 이 dimensionScale 을 읽는다 (allowlist) — 2단 라벨 'Jan' 이 나오고 미설정이면 ISO 문자열", () => {
    const metrics = resolveChartMetrics(CHART_RULE.chart, "md");
    const scene = computeChartScene(timeProps(), TIME_ROWS, SIZE, metrics);
    const skia = texts(skiaTime(timeProps()));
    expect(skia).toEqual(scene.axes.flatMap((a) => a.ticks.map((t) => t.text)));
    expect(skia).toContain("Jan");
    const category = texts(skiaTime({ ...timeProps(), dimensionScale: undefined }));
    expect(category).not.toContain("Jan");
    expect(category).toContain("2026-01-01");
  });

  it("두 leg path `d` byte 동일 · dimensionLabelFormat 한 줄 · 결측 Jan 6 은 빈 자리", () => {
    for (const p of [timeProps(), timeProps({ dimensionLabelFormat: "%m/%d" }), timeProps({ chartType: "area" })]) {
      const metrics = resolveChartMetrics(CHART_RULE.chart, "md");
      const scene = computeChartScene(p, TIME_ROWS, SIZE, metrics);
      const skiaD = skiaTime(p)
        .filter((s): s is Extract<Shape, { type: "path" }> => s.type === "path")
        .map((s) => s.d);
      const domD = attr(renderToStaticMarkup(<svg>{renderChartScene(scene)}</svg>), "path", "d");
      expect(skiaD.length).toBeGreaterThan(0);
      expect(skiaD).toEqual(domD);
    }
    const metrics = resolveChartMetrics(CHART_RULE.chart, "md");
    const one = computeChartScene(timeProps({ dimensionLabelFormat: "%m/%d" }), TIME_ROWS, SIZE, metrics);
    expect(one.axes[0].ticks.map((t) => t.text)).not.toContain("Jan");
    expect(one.axes[0].ticks[0].text).toBe("01/01");
  });
});


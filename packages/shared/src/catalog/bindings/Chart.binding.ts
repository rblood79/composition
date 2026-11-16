import {
  CHART_FAMILY_PROP_KEYS,
  CHART_ZERO_BY_DEFAULT_TYPES,
  SERIES_CHART_TYPES,
  chartTypesReading,
} from "@composition/rendering";
import type { PrimitiveBinding } from "../types";

/** ADR-306 — 필드 역할을 읽는 종류 (조건은 `computeChartScene` · family 의 실제 소비 — R2). */
const SERIES_TYPES: string[] = [...SERIES_CHART_TYPES];
/** ADR-306 — descriptor 역할 · 옵션 표에서 그 prop 을 읽는 family 종류 (손으로 적은 목록을 두지 않는다). */
const reading = (prop: Parameters<typeof chartTypesReading>[0]): string[] =>
  chartTypesReading(prop);
const readingIs = (prop: Parameters<typeof chartTypesReading>[0]) => ({
  key: "chartType",
  oneOf: reading(prop),
});
const GAUGE = { key: "chartType", equals: "gauge" };
const SEGMENTED = { key: "chartType", equals: "segmented" };
const SPARKLINE = { key: "chartType", equals: "sparkline" };
const HISTOGRAM = { key: "chartType", equals: "histogram" };
const BOX = { key: "chartType", equals: "box" };

/**
 * Chart — 데이터 시각화 leaf (ADR-194).
 *
 * **D1 = internal source**: RAC 에 chart primitive 가 없다. `kind:"internal"` 탈출구는
 *   옛 표 컨테이너(@tanstack/react-table)·Icon(Lucide) 선례와 같은 자리다. ARIA 부여처가
 *   없으므로 `staticAttrs.role = "img"` 로 D1 을 데이터로 메운다 (InlineAlert 선례 —
 *   본 ADR 의 유일한 ARIA 수동 작성 1건).
 *
 * **D2 = React Spectrum Charts prop 명 참조**: RSP v3 자체에는 chart 가 없어 RSC 를
 *   참조 원천으로 둔다. RSC 는 `<Chart><Bar/><Axis/><Legend/></Chart>` 조합 모델인데
 *   본 binding 은 노코드 팔레트용 **단일 leaf 로 평탄화** 했다 (`chartType` enum +
 *   `showAxis`/`showLegend` boolean). prop 명은 RSC 를 그대로 쓴다 —
 *   `dimension`/`metric`/`color`/`orientation`, `stackType`←`Bar.type`,
 *   `legendPosition`←`Legend.position`.
 *
 *   평탄화 근거 (ADR-194 R5): 팔레트에서 끌어다 놓는 노코드 사용자에게 "Chart 를 놓고
 *   그 안에 Bar 를 놓고 Axis 를 놓는다" 는 조합은 3단계 조작이고, 조합 트리를 canonical
 *   에 실으면 자식 순서가 시각 의미를 갖는 새 계약이 생긴다. chartType 추가 비용은 마크
 *   파일 1개(`packages/rendering/src/chart/marks/*`)이므로 평탄화가 확장을 막지 않는다.
 *   scatter/이중 축처럼 조합이 정말 필요해지면 reusable(조합) 경로로 승격 판정.
 *
 * **D3 = catalog rule**: `COMPONENT_RULES_TABLE.Chart` (variant default 하나 · size 축 없음 —
 *   ADR-306, 상자 크기는 Layout · `chart` 채널의 시리즈 팔레트·축·grid·기하 metric). generate-css 가
 *   `.react-aria-Chart { --chart-series-N; --chart-axis; --chart-grid }` 를 emit 하고
 *   Skia 는 같은 rule 을 읽는다 — scene 에는 색 인덱스만 실린다.
 *
 * **propPassthrough 전량**: 차트 prop 은 SVG 기하의 **입력**이지 CSS selector 부가속성이
 *   아니다. 기본 라우팅(`data-orientation` 등)으로는 렌더러가 값을 못 받아 전부 기본값
 *   차트가 그려진다 (StatusLight 선례 — `feedback-boolean-visual-prop-falls-through-toracprops`).
 */
export const chartBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "chart",
  },
  props: {
    accepts: {
      // ── content — 차트 종류. 데이터 (원천 · 축에 쓸 필드 · 모드 · 표본 행) 는 collection — 목록과 같은
      //   Collection 섹션 (사용자 결정 2026-11-12 「Property 탭 섹션 병합」 5단계: Data 섹션 없음) ──
      chartType: {
        kind: "enum",
        label: "Chart Type",
        editorHidden: true,
        section: "content",
        default: "bar",
        options: [
          { value: "bar", label: "Bar" },
          { value: "line", label: "Line" },
          { value: "area", label: "Area" },
          { value: "pie", label: "Pie" },
          { value: "radar", label: "Radar" },
          { value: "radial", label: "Radial" },
          { value: "scatter", label: "Scatter" },
          // ADR-306 kpi family (Phase 2).
          { value: "gauge", label: "Gauge" },
          { value: "bullet", label: "Bullet" },
          { value: "dumbbell", label: "Dumbbell" },
          // ADR-306 category family (Phase 3).
          { value: "lollipop", label: "Lollipop" },
          { value: "segmented", label: "Segmented Bar" },
          { value: "waffle", label: "Waffle" },
          { value: "funnel", label: "Funnel" },
          { value: "pareto", label: "Pareto" },
          { value: "waterfall", label: "Waterfall" },
          { value: "sparkline", label: "Sparkline" },
          { value: "marimekko", label: "Marimekko" },
          { value: "stream", label: "Streamgraph" },
          { value: "bump", label: "Bump" },
          { value: "slope", label: "Slope" },
          { value: "skyline", label: "Skyline" },
          // ADR-306 distribution · matrix family (Phase 4).
          { value: "histogram", label: "Histogram" },
          { value: "box", label: "Box Plot" },
          { value: "beeswarm", label: "Beeswarm" },
          { value: "ridgeline", label: "Ridgeline" },
          { value: "heatmap", label: "Heatmap" },
          { value: "calendar", label: "Calendar Heatmap" },
          { value: "candlestick", label: "Candlestick" },
          { value: "parallel", label: "Parallel Coordinates" },
          // ADR-306 network family (Phase 5).
          { value: "treemap", label: "Treemap" },
          { value: "sunburst", label: "Sunburst" },
          { value: "sankey", label: "Sankey" },
          { value: "chord", label: "Chord" },
        ],
      },
      dimension: {
        kind: "string",
        label: "Category",
        section: "collection",
        default: "category",
        // ADR-306 — gauge 는 범주가 없다 (첫 행의 값 하나).
        visibleWhen: {
          key: "chartType",
          oneOf: [...SERIES_TYPES, ...reading("dimension")],
        },
      },
      metric: {
        kind: "string",
        label: "Value",
        section: "collection",
        default: "value",
        // ADR-210 — columns 모드는 값 필드 목록(`valueFields`)이 값 축이다. legacy metric
        //   은 휴면 보존되지만 편집 화면에서는 숨긴다 (breakdown §4.1). ADR-306 — dumbbell 은
        //   값 하나가 아니라 이전 · 이후 두 필드다.
        visibleWhen: {
          all: [
            { key: "dataMode", equals: "group" },
            {
              key: "chartType",
              oneOf: [...SERIES_TYPES, ...reading("metric")],
            },
          ],
        },
      },
      color: {
        kind: "string",
        label: "Series",
        section: "collection",
        visibleWhen: {
          all: [
            { key: "dataMode", equals: "group" },
            {
              key: "chartType",
              oneOf: [...SERIES_TYPES, ...reading("color")],
            },
          ],
        },
      },
      /**
       * ── ADR-306 — family 종류의 데이터 역할 (descriptor `roles` — 패널은 역할 필드를 컬럼 Select 로
       *   승격한다, `CHART_FIELD_ROLE_KEYS`) · 모양 옵션 (Content). 전부 선택적 — 기존 문서에는 없다.
       *   새 key 는 `accepts` 가산이라 contract 를 올리지 않는다 (breakdown §6).
       */
      goalField: {
        kind: "string",
        label: "Goal",
        section: "collection",
        visibleWhen: readingIs("goalField"),
      },
      rangeFields: {
        kind: "string-array",
        label: "Range Fields",
        section: "collection",
        visibleWhen: readingIs("rangeFields"),
      },
      startField: {
        kind: "string",
        label: "Start",
        section: "collection",
        visibleWhen: readingIs("startField"),
      },
      endField: {
        kind: "string",
        label: "End",
        section: "collection",
        visibleWhen: readingIs("endField"),
      },
      // 기본값을 두지 않는다 — gauge 는 비면 0 (`kpi.ts`), candlestick 은 비면 자동 범위다. 0 을 기본값으로
      //   적으면 Library 표본 · 패널이 candlestick 가격 축을 0 부터 그린다 (ADR-306 Phase 4 live).
      valueMin: {
        kind: "number",
        label: "Min Value",
        section: "appearance",
        visibleWhen: readingIs("valueMin"),
      },
      valueMax: {
        kind: "number",
        label: "Max Value",
        section: "appearance",
        visibleWhen: readingIs("valueMax"),
      },
      centerLabel: {
        kind: "string",
        label: "Center Label",
        section: "appearance",
        visibleWhen: readingIs("centerLabel"),
      },
      shape: {
        kind: "enum",
        label: "Shape",
        section: "appearance",
        // 값 집합은 종류마다 다르다 (breakdown §2.2) — 항목마다 `visibleWhen` 으로 그 종류의 값만 패널에
        //   낸다 (ADR-306 Phase 3 — PropContract option 조건). 기본값은 종류의 descriptor defaults.
        options: [
          { value: "arc", label: "Arc", visibleWhen: GAUGE },
          { value: "semi", label: "Semicircle", visibleWhen: GAUGE },
          { value: "ring", label: "Ring", visibleWhen: GAUGE },
          { value: "ticks", label: "Ticks", visibleWhen: GAUGE },
          { value: "tall", label: "Tall", visibleWhen: SEGMENTED },
          { value: "thin", label: "Thin", visibleWhen: SEGMENTED },
          { value: "area", label: "Area", visibleWhen: SPARKLINE },
          { value: "line", label: "Line", visibleWhen: SPARKLINE },
          {
            value: "bar",
            label: "Bar",
            visibleWhen: {
              key: "chartType",
              oneOf: ["sparkline", "histogram"],
            },
          },
          { value: "dots", label: "Dots", visibleWhen: HISTOGRAM },
          { value: "step", label: "Step", visibleWhen: HISTOGRAM },
          { value: "box", label: "Box", visibleWhen: BOX },
          { value: "violin", label: "Violin", visibleWhen: BOX },
          { value: "both", label: "Box + Violin", visibleWhen: BOX },
        ],
        visibleWhen: readingIs("shape"),
      },
      bands: {
        kind: "string-array",
        label: "Bands",
        section: "appearance",
        visibleWhen: readingIs("bands"),
      },
      independent: {
        kind: "boolean",
        label: "Independent Scale",
        section: "appearance",
        default: true,
        visibleWhen: readingIs("independent"),
      },
      // 기본값을 두지 않는다 — 정의 기본값은 모든 종류의 해석 props 에 들어간다 (ADR-306 Phase 5 부터
      //   bar · pie 도 읽는다: 기본값 descending 이면 기존 막대 · 원이 전부 정렬된다). 종류마다 비었을 때의
      //   순서는 코드가 정한다 (`sortOf(props, fallback)` — dumbbell · lollipop · treemap 큰 순서 …).
      sort: {
        kind: "enum",
        label: "Sort",
        section: "appearance",
        options: [
          { value: "none", label: "Data Order" },
          { value: "descending", label: "Descending" },
          { value: "ascending", label: "Ascending" },
        ],
        visibleWhen: readingIs("sort"),
      },
      // 해석 기본값 없음 — line · area · scatter 는 비면 0 포함 (Phase 5 전의 축), dumbbell · box 는 비면 0
      //   미포함. 패널 기준값은 그 뜻을 따른다 (`defaultWhen`) — 칩이 그림과 같게 보이고 끄면 `false` 를 쓴다.
      includeZero: {
        kind: "boolean",
        label: "Include Zero",
        section: "appearance",
        defaultWhen: [
          {
            when: { key: "chartType", oneOf: [...CHART_ZERO_BY_DEFAULT_TYPES] },
            value: true,
          },
        ],
        visibleWhen: readingIs("includeZero"),
      },
      // ── ADR-306 Phase 3 — category family 의 역할 · 옵션 ──
      kindField: {
        kind: "string",
        label: "Kind",
        section: "collection",
        visibleWhen: readingIs("kindField"),
      },
      rankField: {
        kind: "string",
        label: "Rank",
        section: "collection",
        visibleWhen: readingIs("rankField"),
      },
      frontFields: {
        kind: "string-array",
        label: "Front Fields",
        section: "collection",
        visibleWhen: readingIs("frontFields"),
      },
      cells: {
        kind: "number",
        label: "Cells",
        section: "appearance",
        default: 100,
        min: 1,
        max: 400,
        step: 1,
        visibleWhen: readingIs("cells"),
      },
      columns: {
        kind: "number",
        label: "Columns",
        section: "appearance",
        default: 10,
        min: 1,
        max: 40,
        step: 1,
        visibleWhen: readingIs("columns"),
      },
      showRates: {
        kind: "boolean",
        label: "Show Rates",
        section: "appearance",
        default: true,
        visibleWhen: readingIs("showRates"),
      },
      rateBase: {
        kind: "enum",
        label: "Rate Base",
        section: "appearance",
        default: "previous",
        options: [
          { value: "previous", label: "Previous Step" },
          { value: "first", label: "First Step" },
        ],
        visibleWhen: readingIs("rateBase"),
      },
      rateLabel: {
        kind: "string",
        label: "Rate Label",
        section: "appearance",
        visibleWhen: readingIs("rateLabel"),
      },
      // pareto 의 누적 기준 % 와 histogram 의 기준값이 같은 키다 — 값 범위가 종류마다 달라 슬라이더 범위를
      //   두지 않고, 기본값도 두지 않는다 (정의 기본값은 모든 종류의 해석 props 에 들어가 histogram 이 늘
      //   80 을 기준으로 칠한다 — pareto 는 비면 80, `paretoModel`).
      threshold: {
        kind: "number",
        label: "Threshold",
        section: "appearance",
        visibleWhen: readingIs("threshold"),
      },
      rankLabels: {
        kind: "boolean",
        label: "Rank Labels",
        section: "appearance",
        default: false,
        visibleWhen: readingIs("rankLabels"),
      },
      startTotal: {
        kind: "boolean",
        label: "Start Total",
        section: "appearance",
        default: true,
        visibleWhen: readingIs("startTotal"),
      },
      endTotal: {
        kind: "boolean",
        label: "End Total",
        section: "appearance",
        default: false,
        visibleWhen: readingIs("endTotal"),
      },
      connectors: {
        kind: "boolean",
        label: "Connectors",
        section: "appearance",
        default: true,
        visibleWhen: readingIs("connectors"),
      },
      showExtremes: {
        kind: "boolean",
        label: "Show Extremes",
        section: "appearance",
        default: false,
        visibleWhen: readingIs("showExtremes"),
      },
      streamOffset: {
        kind: "enum",
        label: "Offset",
        section: "appearance",
        default: "wiggle",
        options: [
          { value: "wiggle", label: "Wiggle" },
          { value: "silhouette", label: "Silhouette" },
        ],
        visibleWhen: readingIs("streamOffset"),
      },
      reorder: {
        kind: "boolean",
        label: "Reorder",
        section: "appearance",
        default: true,
        visibleWhen: readingIs("reorder"),
      },
      periodLabels: {
        kind: "string-array",
        label: "Period Labels",
        section: "appearance",
        visibleWhen: readingIs("periodLabels"),
      },
      depth: {
        kind: "number",
        label: "Depth",
        section: "appearance",
        default: 0.32,
        min: 0.1,
        max: 0.32,
        step: 0.01,
        visibleWhen: readingIs("depth"),
      },
      wall: {
        kind: "boolean",
        label: "Wall",
        section: "appearance",
        default: true,
        visibleWhen: readingIs("wall"),
      },
      texture: {
        kind: "enum",
        label: "Texture",
        section: "appearance",
        default: "front",
        options: [
          { value: "front", label: "Front Row" },
          { value: "all", label: "All" },
          { value: "none", label: "None" },
        ],
        visibleWhen: readingIs("texture"),
      },
      frontRate: {
        kind: "enum",
        label: "Front Rate",
        section: "appearance",
        default: "label",
        options: [
          { value: "label", label: "Label" },
          { value: "strip", label: "Strip" },
          { value: "none", label: "None" },
        ],
        visibleWhen: readingIs("frontRate"),
      },
      // ── ADR-306 Phase 4 — distribution · matrix family 의 역할 · 옵션 ──
      binStartField: {
        kind: "string",
        label: "Bin Start",
        section: "collection",
        visibleWhen: readingIs("binStartField"),
      },
      binEndField: {
        kind: "string",
        label: "Bin End",
        section: "collection",
        visibleWhen: readingIs("binEndField"),
      },
      countField: {
        kind: "string",
        label: "Count",
        section: "collection",
        visibleWhen: readingIs("countField"),
      },
      labelField: {
        kind: "string",
        label: "Label",
        section: "collection",
        visibleWhen: readingIs("labelField"),
      },
      rowField: {
        kind: "string",
        label: "Row",
        section: "collection",
        visibleWhen: readingIs("rowField"),
      },
      openField: {
        kind: "string",
        label: "Open",
        section: "collection",
        visibleWhen: readingIs("openField"),
      },
      highField: {
        kind: "string",
        label: "High",
        section: "collection",
        visibleWhen: readingIs("highField"),
      },
      lowField: {
        kind: "string",
        label: "Low",
        section: "collection",
        visibleWhen: readingIs("lowField"),
      },
      closeField: {
        kind: "string",
        label: "Close",
        section: "collection",
        visibleWhen: readingIs("closeField"),
      },
      volumeField: {
        kind: "string",
        label: "Volume",
        section: "collection",
        visibleWhen: readingIs("volumeField"),
      },
      invertFields: {
        kind: "string-array",
        label: "Inverted Axes",
        section: "collection",
        visibleWhen: readingIs("invertFields"),
      },
      percentiles: {
        kind: "string-array",
        label: "Percentiles",
        section: "appearance",
        visibleWhen: readingIs("percentiles"),
      },
      edges: {
        kind: "string-array",
        label: "Bin Edges",
        section: "appearance",
        visibleWhen: readingIs("edges"),
      },
      binWidth: {
        kind: "number",
        label: "Bin Width",
        section: "appearance",
        visibleWhen: readingIs("binWidth"),
      },
      // 비우면 자동 (Freedman-Diaconis · Sturges) — 슬라이더는 빈 값을 최솟값으로 보여 숫자 칸으로 둔다.
      bins: {
        kind: "number",
        label: "Bins",
        section: "appearance",
        visibleWhen: readingIs("bins"),
      },
      log: {
        kind: "boolean",
        label: "Log Scale",
        section: "appearance",
        default: false,
        visibleWhen: readingIs("log"),
      },
      kde: {
        kind: "boolean",
        label: "Density Curve",
        section: "appearance",
        default: false,
        visibleWhen: readingIs("kde"),
      },
      outliers: {
        kind: "boolean",
        label: "Outliers",
        section: "appearance",
        default: true,
        visibleWhen: readingIs("outliers"),
      },
      whiskers: {
        kind: "string-array",
        label: "Whisker Percentiles",
        section: "appearance",
        visibleWhen: readingIs("whiskers"),
      },
      // 비우면 점 개수에 맞춘다 — bins 와 같은 이유로 숫자 칸.
      dotRadius: {
        kind: "number",
        label: "Dot Radius",
        section: "appearance",
        visibleWhen: readingIs("dotRadius"),
      },
      showMedian: {
        kind: "boolean",
        label: "Show Median",
        section: "appearance",
        default: true,
        visibleWhen: readingIs("showMedian"),
      },
      overlap: {
        kind: "number",
        label: "Overlap",
        section: "appearance",
        default: 1.5,
        min: 0.5,
        max: 4,
        step: 0.1,
        visibleWhen: readingIs("overlap"),
      },
      bandwidth: {
        kind: "number",
        label: "Bandwidth",
        section: "appearance",
        visibleWhen: readingIs("bandwidth"),
      },
      legendLabels: {
        kind: "string-array",
        label: "Legend Labels",
        section: "appearance",
        visibleWhen: readingIs("legendLabels"),
      },
      // 0 = 일요일 · 1 = 월요일 (ztd `weekStart` 숫자 그대로 — enum options 는 글자 값만 받는다).
      weekStart: {
        kind: "number",
        label: "Week Start",
        section: "appearance",
        default: 0,
        min: 0,
        max: 1,
        step: 1,
        visibleWhen: readingIs("weekStart"),
      },
      cellGap: {
        kind: "number",
        label: "Cell Gap",
        section: "appearance",
        default: 2.5,
        min: 0,
        max: 12,
        step: 0.5,
        visibleWhen: readingIs("cellGap"),
      },
      movingAverages: {
        kind: "string-array",
        label: "Moving Averages",
        section: "appearance",
        visibleWhen: readingIs("movingAverages"),
      },
      // ── ADR-306 Phase 5 — network family 의 역할 · 옵션 ──
      pathFields: {
        kind: "string-array",
        label: "Path",
        section: "collection",
        visibleWhen: readingIs("pathFields"),
      },
      sourceField: {
        kind: "string",
        label: "Source",
        section: "collection",
        visibleWhen: readingIs("sourceField"),
      },
      targetField: {
        kind: "string",
        label: "Target",
        section: "collection",
        visibleWhen: readingIs("targetField"),
      },
      nodeWidth: {
        kind: "number",
        label: "Node Width",
        section: "appearance",
        min: 2,
        max: 40,
        step: 1,
        unit: "px",
        visibleWhen: readingIs("nodeWidth"),
      },
      nodePadding: {
        kind: "number",
        label: "Node Gap",
        section: "appearance",
        min: 0,
        max: 60,
        step: 1,
        unit: "px",
        visibleWhen: readingIs("nodePadding"),
      },
      padAngle: {
        kind: "number",
        label: "Group Gap (deg)",
        section: "appearance",
        min: 0,
        max: 20,
        step: 0.5,
        visibleWhen: readingIs("padAngle"),
      },
      // ── ADR-306 Phase 5 — 기존 종류 보강 (breakdown §2.1) ──
      lowerFields: {
        kind: "string-array",
        label: "Band Lower",
        section: "collection",
        visibleWhen: readingIs("lowerFields"),
      },
      upperFields: {
        kind: "string-array",
        label: "Band Upper",
        section: "collection",
        visibleWhen: readingIs("upperFields"),
      },
      endLabels: {
        kind: "boolean",
        label: "End Labels",
        section: "appearance",
        visibleWhen: readingIs("endLabels"),
      },
      connectNulls: {
        kind: "boolean",
        label: "Connect Gaps",
        section: "appearance",
        visibleWhen: readingIs("connectNulls"),
      },
      sizeField: {
        kind: "string",
        label: "Size",
        section: "collection",
        visibleWhen: readingIs("sizeField"),
      },
      sizeRange: {
        kind: "string-array",
        label: "Size Range (px)",
        section: "appearance",
        visibleWhen: readingIs("sizeRange"),
      },
      fit: {
        kind: "enum",
        label: "Trend Line",
        section: "appearance",
        options: [
          { value: "none", label: "None" },
          { value: "linear", label: "Linear" },
        ],
        visibleWhen: readingIs("fit"),
      },
      quadrants: {
        kind: "string-array",
        label: "Quadrant Names",
        section: "appearance",
        visibleWhen: readingIs("quadrants"),
      },
      // ── ADR-306 Phase 6 — 공통 상호작용 (사용자 결정 1). 기본값 없음 — 비면 지금 그림 그대로.
      //   주석 목록은 `ChartAnnotationControls` (Content) — generic 편집기는 숨긴다.
      annotations: {
        kind: "items-manager",
        label: "Annotations",
        section: "content",
        editorHidden: true,
        visibleWhen: readingIs("annotations"),
        itemsManager: {
          itemsKey: "annotations",
          itemTypeName: "ChartAnnotation",
          defaultItem: { type: "event" },
          itemSchema: [
            { key: "type", type: "string", label: "Type" },
            { key: "x", type: "string", label: "X" },
            { key: "xEnd", type: "string", label: "X End" },
            { key: "y", type: "string", label: "Value" },
            { key: "yEnd", type: "string", label: "Value End" },
            { key: "label", type: "string", label: "Label" },
          ],
          labelKey: "label",
        },
      },
      signColors: {
        kind: "boolean",
        label: "Sign Colors",
        section: "appearance",
        visibleWhen: readingIs("signColors"),
      },
      // 손익 색을 켰을 때만 읽는다 — 끈 채로 보이면 아무것도 하지 않는 칸이 된다.
      baseline: {
        kind: "number",
        label: "Baseline",
        section: "appearance",
        visibleWhen: {
          all: [readingIs("baseline"), { key: "signColors", truthy: true }],
        },
      },
      bandFrom: {
        kind: "enum",
        label: "Band From",
        section: "appearance",
        options: [
          { value: "start", label: "Start" },
          { value: "forecast", label: "Forecast" },
        ],
        // 범위 띠 (아래 경계 필드) 가 있을 때만 읽는다.
        visibleWhen: {
          all: [readingIs("bandFrom"), { key: "lowerFields", truthy: true }],
        },
      },
      outside: {
        kind: "boolean",
        label: "Outside Points",
        section: "appearance",
        // 범위 띠 (아래 경계 필드) 가 있을 때만 읽는다.
        visibleWhen: {
          all: [readingIs("outside"), { key: "lowerFields", truthy: true }],
        },
      },
      // 강조 — 모드 (max · min · first · last · none) 또는 항목 이름. 비면 종류의 기본 강조.
      highlight: {
        kind: "string-array",
        label: "Highlight",
        section: "appearance",
        visibleWhen: readingIs("highlight"),
      },
      // 범위 선택 · 동기화 — Preview · Publish 의 실행 상태 (저장하지 않는 뷰 상태를 켜는 설정).
      brush: {
        kind: "enum",
        label: "Range Select",
        section: "interaction",
        options: [
          { value: "none", label: "None" },
          { value: "select", label: "Select" },
          { value: "zoom", label: "Zoom" },
        ],
        visibleWhen: readingIs("brush"),
      },
      syncId: {
        kind: "string",
        label: "Sync Group",
        section: "interaction",
        visibleWhen: readingIs("syncId"),
      },
      /**
       * ── ADR-210 — 다중 수치 컬럼·시리즈 표시·숫자 형식 ──
       *
       * 전부 **선택적**이고 catalog default 는 투영/편집 화면의 읽기 기본값일 뿐 canonical
       * 에 쓰지 않는다 (`CHART_DEFAULT_PROPS` 에도 없다). 여기 선언하는 것이 DOM 투영의
       * 통과 조건이다 (`toRacProps` 는 accepts 키만 투영 — 위 `data` 주석의 같은 함정).
       * 복합 편집 (모드 전환 popover · 시리즈 목록 · 형식 묶음 Apply) 은 Chart 전용
       * 컨트롤 (`ChartDataMappingControls` 등) 이 맡으므로 generic 필드는 `editorHidden`.
       * 검증·정규화는 specs `resolveChartPresentation` 한 곳이다.
       */
      dataMode: {
        kind: "enum",
        label: "Data Mode",
        section: "collection",
        default: "group",
        editorHidden: true,
        options: [
          { value: "group", label: "Group Field" },
          { value: "columns", label: "Value Columns" },
        ],
      },
      valueFields: {
        kind: "string-array",
        label: "Value Fields",
        section: "collection",
        editorHidden: true,
      },
      seriesConfig: {
        kind: "items-manager",
        label: "Series",
        section: "series",
        editorHidden: true,
        itemsManager: {
          itemsKey: "seriesConfig",
          itemTypeName: "ChartSeriesConfig",
          defaultItem: { key: "" },
          itemSchema: [
            { key: "key", type: "string", label: "Series" },
            { key: "label", type: "string", label: "Display Name" },
            { key: "colorToken", type: "string", label: "Palette Color" },
          ],
          labelKey: "label",
        },
      },
      valueFormat: {
        kind: "enum",
        label: "Number Format",
        section: "appearance",
        default: "auto",
        editorHidden: true,
        options: [
          { value: "auto", label: "Auto (default)" },
          { value: "decimal", label: "Decimal" },
          { value: "currency", label: "Currency" },
          { value: "percent", label: "Percent" },
        ],
      },
      valueLocale: {
        kind: "enum",
        label: "Number Locale",
        section: "appearance",
        editorHidden: true,
        options: [
          { value: "en-US", label: "en-US" },
          { value: "ko-KR", label: "ko-KR" },
        ],
      },
      valueFractionDigits: {
        kind: "number",
        label: "Fraction Digits",
        section: "appearance",
        editorHidden: true,
        min: 0,
        max: 6,
        step: 1,
      },
      valueCurrency: {
        kind: "string",
        label: "Currency Code",
        section: "appearance",
        editorHidden: true,
      },
      valuePercentUnit: {
        kind: "enum",
        label: "Percent Unit",
        section: "appearance",
        editorHidden: true,
        options: [
          { value: "ratio", label: "Ratio (0.25 = 25%)" },
          { value: "percentagePoints", label: "Points (25 = 25%)" },
        ],
      },
      /**
       * ADR-211 — 표시 예산 4 키 (breakdown §2.4 · §2.6). 평면 키 · 전부 선택적 (미설정 = `auto`
       * / `sum` / `auto` / 영문 상수 "Other"). 지원표 밖 조합 (pie + window 등) 은 specs validator
       * 가 거부한다 (`presentation.ok=false`). 편집은 Chart 전용 컨트롤 (`ChartBudgetControls`).
       */
      budgetOverflow: {
        kind: "enum",
        label: "When Categories Overflow",
        section: "interaction",
        default: "auto",
        editorHidden: true,
        options: [
          { value: "auto", label: "Auto (by chart & axis)" },
          { value: "window", label: "Window" },
          { value: "aggregate", label: "Aggregate buckets" },
          { value: "extrema", label: "Keep extrema" },
          { value: "others", label: "Group the rest" },
        ],
      },
      budgetAggregate: {
        kind: "enum",
        label: "Aggregate",
        section: "interaction",
        default: "sum",
        editorHidden: true,
        options: [
          { value: "sum", label: "Sum" },
          { value: "mean", label: "Mean" },
          { value: "max", label: "Maximum" },
          { value: "min", label: "Minimum" },
        ],
      },
      budgetAxis: {
        kind: "enum",
        label: "Category Axis",
        section: "interaction",
        default: "auto",
        editorHidden: true,
        options: [
          { value: "auto", label: "Auto (detect dates)" },
          { value: "category", label: "Category" },
          { value: "ordinal", label: "Ordinal (time / sequence)" },
        ],
      },
      budgetOthersLabel: {
        kind: "string",
        label: "Group Label",
        section: "interaction",
        editorHidden: true,
      },
      // ADR-216 — 시간축 3 키 (line/area opt-in). 패널은 ChartTimeAxisControls (dimension 옆),
      //   generic 렌더는 숨긴다. accepts 선언이 DOM 경로 (toRacProps) 의 통과 조건이다.
      dimensionScale: {
        kind: "enum",
        label: "Category Spacing",
        section: "collection",
        default: "category",
        editorHidden: true,
        options: [
          { value: "category", label: "Even" },
          { value: "time", label: "Time (date spacing)" },
        ],
      },
      dimensionFormat: {
        kind: "string",
        label: "Date Input Format",
        section: "collection",
        editorHidden: true,
      },
      dimensionLabelFormat: {
        kind: "string",
        label: "Axis Label Format",
        section: "collection",
        editorHidden: true,
      },
      // ADR-217 — 값 축 기준선 (RSC ReferenceLine: value · label · lineType · layer). bar/line/area, ≤ 4.
      //   패널은 `ChartReferenceLineControls` (Content) — generic 편집기는 숨긴다.
      referenceLines: {
        kind: "items-manager",
        label: "Reference Lines",
        section: "content",
        editorHidden: true,
        itemsManager: {
          itemsKey: "referenceLines",
          itemTypeName: "ChartReferenceLine",
          defaultItem: { value: 0 },
          itemSchema: [
            { key: "value", type: "string", label: "Value" },
            { key: "label", type: "string", label: "Label" },
            { key: "lineType", type: "string", label: "Line Style" },
            { key: "layer", type: "string", label: "Layer" },
          ],
          labelKey: "label",
        },
      },
      // collection items 데이터 — canonical 이 아니라 collections root 소유 (ListBox 동형).
      dataBinding: {
        kind: "binding",
        label: "Data source",
        section: "collection",
      },
      /**
       * 샘플/정적 rows. **accepts 에 선언하는 것이 통과 조건이다** — `toRacProps` 는
       * accepts 에 있는 키만 투영하므로, 선언을 빠뜨리면 DOM 경로에서 `data` 가 조용히
       * 사라지고 Preview 가 "No data" 만 그린다 (2026-09-08 live 에서 실제로 그랬다.
       * Skia 는 scene-node props 를 직접 읽어 멀쩡했던 **한쪽만 깨지는** 형태).
       */
      data: {
        kind: "items-manager",
        label: "Sample Rows",
        section: "collection",
        itemsManager: {
          itemsKey: "data",
          itemTypeName: "ChartRow",
          itemLabel: "Sample Row",
          defaultItem: { category: "New", value: 0, series: "A" },
          itemSchema: [
            { key: "category", type: "string", label: "Category" },
            { key: "value", type: "string", label: "Value" },
            { key: "series", type: "string", label: "Series" },
          ],
          labelKey: "category",
        },
      },

      /**
       * ── appearance ──
       *
       * **차트 종류 전용 prop 은 `visibleWhen` 으로 가른다** (ADR-208 P1ⓑ). 조건의 근거는
       * `computeChartScene` 의 실제 소비뿐이다 — 어떤 종류가 그 값을 읽는가. 읽는데 숨기면
       * 사용자가 편집 수단 자체를 못 찾으므로(R2), 조건 표는 소비 경로와 1:1 이어야 하고
       * 그 정합은 `chartVisibleWhen.test.ts` 가 값 변화로 확인한다 (선언 대조 아님).
       *
       * 조건을 **달지 않는 것**: `showAxis`·`showGrid`·`showLegend`·`legendPosition`·
       * `showValueLabels`·`colorBy`·`showTooltip`. 두 계열이 함께 읽거나 전 종류 공통이다 —
       * 억지 조건은 표만 키우고 뜻을 흐린다.
       */
      orientation: {
        kind: "enum",
        label: "Orientation",
        section: "appearance",
        default: "vertical",
        options: [
          { value: "vertical", label: "Vertical" },
          { value: "horizontal", label: "Horizontal" },
        ],
        // 극좌표·pie 는 읽지 않는다 (computeChartScene.ts:417,487,502). ADR-217 scatter 도 읽는다.
        visibleWhen: {
          key: "chartType",
          oneOf: ["bar", "line", "area", "scatter", ...reading("orientation")],
        },
      },
      stackType: {
        kind: "enum",
        label: "Stack Type",
        section: "appearance",
        default: "dodged",
        options: [
          { value: "dodged", label: "Dodged" },
          { value: "stacked", label: "Stacked" },
          { value: "expand", label: "Stacked 100%" },
        ],
        // radar 만 무시한다 (ADR-207 R8, computeChartScene.ts:155). pie 도 읽는다 —
        //   값 축이 없어 링 분할을 따로 판정하는 자리가 있다 (:363-365). cartesian 은
        //   bar·line·area 가 같은 분기(:411-413)라 셋 다.
        visibleWhen: {
          key: "chartType",
          oneOf: ["bar", "line", "area", "pie", "radial"],
        },
      },
      curve: {
        kind: "enum",
        label: "Curve",
        section: "appearance",
        default: "linear",
        options: [
          { value: "linear", label: "Linear" },
          { value: "monotone", label: "Monotone" },
          { value: "step", label: "Step" },
        ],
        // computeChartScene.ts:505,519.
        visibleWhen: {
          key: "chartType",
          oneOf: ["line", "area", ...reading("curve")],
        },
      },
      showDots: {
        kind: "boolean",
        label: "Show Dots",
        section: "appearance",
        default: false,
        // computeChartScene.ts:184,510,525 (radar 는 꼭짓점에 찍는다).
        visibleWhen: { key: "chartType", oneOf: ["line", "area", "radar"] },
      },
      showValueLabels: {
        kind: "boolean",
        label: "Show Value Labels",
        section: "appearance",
        default: false,
      },
      /**
       * 레이블 **내용** (ADR-208 P4) — 켜는 스위치는 `showValueLabels` 가 그대로 갖고
       * 여기서는 무엇을 적을지만 가른다. 스위치를 하나 더 만들면 "값도 이름도 안 나오는"
       * 조합이 생긴다. 조건 축이 `chartType` 이 아닌 첫 사례 — 레이블을 끈 상태에서는
       * 내용 선택이 아무 일도 안 하므로 그때는 숨긴다.
       */
      labelKey: {
        kind: "enum",
        label: "Label Content",
        section: "appearance",
        default: "value",
        options: [
          { value: "value", label: "Value" },
          { value: "category", label: "Category Name" },
        ],
        // ADR-306 — family 종류는 값 라벨 내용을 고르지 않는다 (값만 적는다) — treemap 만 이름 · 비율을 고른다.
        visibleWhen: {
          all: [
            { key: "showValueLabels", truthy: true },
            {
              key: "chartType",
              oneOf: [...SERIES_TYPES, ...reading("labelKey")],
            },
          ],
        },
      },
      // ADR-215 — 시리즈 팔레트 (RSC `Chart.colors` 팔레트 이름 참조). 상자 시각 ·
      //   `colorBy` (데이터→색 매핑) 와 다른 축 — 색 관련 두 필드가 패널에서 이웃하도록 colorBy 바로 앞에 둔다. 값은 rule `chart.series` / `chart.palettes` 가 푼다.
      palette: {
        kind: "enum",
        label: "Palette",
        section: "appearance",
        default: "categorical",
        options: [
          { value: "categorical", label: "Categorical" },
          { value: "mono", label: "Mono" },
        ],
      },
      colorBy: {
        kind: "enum",
        label: "Color By",
        section: "appearance",
        default: "series",
        options: [
          { value: "series", label: "Series" },
          { value: "category", label: "Category" },
        ],
        // ADR-210 — columns 는 시리즈 색뿐이다 (범주색 조합 미지원, breakdown §3). 미설정
        //   dataMode 는 default "group" 이 conditionValues 에 채워져 기존 노출 그대로다.
        //   bar 조건은 오라클 (`chartVisibleWhen.test.ts` "조건을 단 prop 은 읽힌다") 의
        //   요구다 — `colorBy` 는 bar 만 읽는다 (computeChartScene legend/buildBarMarks).
        visibleWhen: {
          all: [
            { key: "chartType", equals: "bar" },
            { key: "dataMode", equals: "group" },
          ],
        },
      },
      innerRadius: {
        kind: "number",
        label: "Inner Radius (%)",
        section: "appearance",
        default: 0,
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        // computeChartScene.ts:152,358. radar 도 읽는다 — center.inner 가 결측 꼭짓점을
        //   접는 반지름이자 격자 안쪽 경계다.
        //   ADR-306 — sunburst 는 가운데 구멍.
        visibleWhen: {
          key: "chartType",
          oneOf: ["pie", "radial", "radar", ...reading("innerRadius")],
        },
      },
      gridType: {
        kind: "enum",
        label: "Grid Type",
        section: "appearance",
        default: "polygon",
        options: [
          { value: "polygon", label: "Polygon" },
          { value: "circle", label: "Circle" },
        ],
        // computeChartScene.ts:219 — ADR-207:190 이 지목한 항목.
        visibleWhen: {
          all: [
            { key: "chartType", equals: "radar" },
            { key: "showGrid", truthy: true },
          ],
        },
      },
      /**
       * 극좌표 각도 범위 (ADR-208 P3) — 도, **12시=0 시계**. Recharts 는 3시=0 반시계라
       * 같은 그림이라도 숫자가 다르다. **radial 만 읽는다** (`computeChartScene.ts:211-212`)
       * — radar·pie 에 열어 두면 "바꿔도 아무 일이 안 일어나는 값" 이 되어 본 ADR 이
       * 없애려던 바로 그 혼란을 만든다.
       */
      startAngle: {
        kind: "number",
        label: "Start Angle (deg)",
        section: "appearance",
        default: 0,
        min: 0,
        max: 360,
        step: 1,
        unit: "°",
        visibleWhen: { key: "chartType", equals: "radial" },
      },
      endAngle: {
        kind: "number",
        label: "End Angle (deg)",
        section: "appearance",
        default: 360,
        min: 0,
        max: 360,
        step: 1,
        unit: "°",
        visibleWhen: { key: "chartType", equals: "radial" },
      },
      showTotal: {
        kind: "boolean",
        label: "Show Total",
        section: "appearance",
        default: false,
        // computeChartScene.ts:359 + radial 확장 (P3 — centerTotalLabels 공유).
        visibleWhen: {
          key: "chartType",
          oneOf: ["pie", "radial", ...reading("showTotal")],
        },
      },
      /**
       * radar 격자·선 제어 (ADR-208 P2). 넷 다 radar 전용이라 조건을 단다 — 조건이
       * 소비와 어긋나면 `chartVisibleWhen.test.ts` 의 차등 오라클이 잡는다.
       */
      showSpokes: {
        kind: "boolean",
        label: "Show Spokes",
        section: "appearance",
        default: true,
        visibleWhen: {
          all: [
            { key: "chartType", equals: "radar" },
            { key: "showAxis", truthy: true },
          ],
        },
      },
      gridRings: {
        kind: "number",
        label: "Grid Rings (0=auto)",
        section: "appearance",
        default: 0,
        min: 0,
        max: 10,
        step: 1,
        visibleWhen: {
          all: [
            { key: "chartType", equals: "radar" },
            { key: "showGrid", truthy: true },
          ],
        },
      },
      fillGrid: {
        kind: "boolean",
        label: "Fill Grid",
        section: "appearance",
        default: false,
        visibleWhen: {
          all: [
            { key: "chartType", equals: "radar" },
            { key: "showGrid", truthy: true },
          ],
        },
      },
      fillArea: {
        kind: "boolean",
        label: "Fill Area (radar)",
        section: "appearance",
        default: true,
        visibleWhen: { key: "chartType", equals: "radar" },
      },
      showTooltip: {
        kind: "boolean",
        label: "Show Tooltip",
        section: "interaction",
        default: false,
      },
      showAxis: {
        kind: "boolean",
        label: "Show Axis",
        section: "appearance",
        default: true,
        visibleWhen: {
          key: "chartType",
          oneOf: ["bar", "line", "area", "radar"],
        },
      },
      showGrid: {
        kind: "boolean",
        label: "Show Grid",
        section: "appearance",
        default: false,
        visibleWhen: {
          key: "chartType",
          oneOf: ["bar", "line", "area", "radar"],
        },
      },
      showLegend: {
        kind: "boolean",
        label: "Show Legend",
        section: "appearance",
        default: false,
      },
      legendPosition: {
        kind: "enum",
        label: "Legend Position",
        visibleWhen: { key: "showLegend", truthy: true },
        section: "appearance",
        default: "bottom",
        options: [
          { value: "bottom", label: "Bottom" },
          { value: "top", label: "Top" },
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
        ],
      },
      isAnimationActive: {
        kind: "boolean",
        label: "Animation",
        section: "interaction",
        default: false,
      },
      animationBegin: {
        kind: "number",
        label: "Animation Delay (ms)",
        section: "interaction",
        default: 0,
        min: 0,
        max: 3000,
        step: 50,
        unit: "ms",
        visibleWhen: { key: "isAnimationActive", truthy: true },
      },
      animationDuration: {
        kind: "number",
        label: "Animation Duration (ms)",
        section: "interaction",
        default: 600,
        min: 0,
        max: 3000,
        step: 50,
        unit: "ms",
        visibleWhen: { key: "isAnimationActive", truthy: true },
      },
      animationEasing: {
        kind: "enum",
        label: "Animation Easing",
        section: "interaction",
        default: "ease-out",
        options: ["linear", "ease", "ease-in", "ease-out", "ease-in-out"].map(
          (value) => ({ value, label: value }),
        ),
        visibleWhen: { key: "isAnimationActive", truthy: true },
      },
    },
    toRacProps: "default",
    propPassthrough: [
      "chartType",
      "dimension",
      "metric",
      "color",
      "dataMode",
      "valueFields",
      "seriesConfig",
      "valueFormat",
      "valueLocale",
      "valueFractionDigits",
      "valueCurrency",
      "valuePercentUnit",
      "budgetOverflow",
      "budgetAggregate",
      "budgetAxis",
      "budgetOthersLabel",
      "dimensionScale",
      "dimensionFormat",
      "dimensionLabelFormat",
      "referenceLines",
      "orientation",
      "stackType",
      "curve",
      "showDots",
      "showValueLabels",
      "labelKey",
      "colorBy",
      "innerRadius",
      "gridType",
      "showTotal",
      "startAngle",
      "endAngle",
      "showSpokes",
      "gridRings",
      "fillGrid",
      "fillArea",
      "showTooltip",
      "showAxis",
      "showGrid",
      "showLegend",
      "legendPosition",
      "isAnimationActive",
      "animationBegin",
      "animationDuration",
      "animationEasing",
      "palette",
      // ADR-306 — family 역할 · 옵션 (목록 하나 — DOM · Skia 와 같은 `CHART_FAMILY_PROP_KEYS`).
      ...CHART_FAMILY_PROP_KEYS,
    ],
  },
  skiaPrimitive: "chart_scene",
  staticAttrs: {},
};

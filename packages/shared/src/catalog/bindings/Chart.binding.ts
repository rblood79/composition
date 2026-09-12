import type { PrimitiveBinding } from "../types";

/**
 * Chart — 데이터 시각화 leaf (ADR-194).
 *
 * **D1 = internal source**: RAC 에 chart primitive 가 없다. `kind:"internal"` 탈출구는
 *   TableView(@tanstack/react-table)·Icon(Lucide) 선례와 같은 자리다. ARIA 부여처가
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
 *   파일 1개(`packages/specs/src/chart/marks/*`)이므로 평탄화가 확장을 막지 않는다.
 *   scatter/이중 축처럼 조합이 정말 필요해지면 reusable(조합) 경로로 승격 판정.
 *
 * **D3 = catalog rule**: `COMPONENT_RULES_TABLE.Chart` (variants default/quiet · sizes
 *   sm/md/lg · `chart` 채널의 시리즈 팔레트·축·grid·기하 metric). generate-css 가
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
      // ── content — 어느 필드를 어느 축에 쓸지 ──
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
        ],
      },
      dimension: {
        kind: "string",
        label: "Category",
        section: "content",
        default: "category",
      },
      metric: {
        kind: "string",
        label: "Value",
        section: "content",
        default: "value",
        // ADR-210 — columns 모드는 값 필드 목록(`valueFields`)이 값 축이다. legacy metric
        //   은 휴면 보존되지만 편집 화면에서는 숨긴다 (breakdown §4.1).
        visibleWhen: { key: "dataMode", equals: "group" },
      },
      color: {
        kind: "string",
        label: "Series",
        section: "content",
        visibleWhen: { key: "dataMode", equals: "group" },
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
        section: "content",
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
        section: "content",
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
        section: "content",
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
        section: "content",
        editorHidden: true,
      },
      dimensionLabelFormat: {
        kind: "string",
        label: "Axis Label Format",
        section: "content",
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
      dataBinding: { kind: "binding", label: "Data", section: "content" },
      /**
       * 샘플/정적 rows. **accepts 에 선언하는 것이 통과 조건이다** — `toRacProps` 는
       * accepts 에 있는 키만 투영하므로, 선언을 빠뜨리면 DOM 경로에서 `data` 가 조용히
       * 사라지고 Preview 가 "No data" 만 그린다 (2026-09-08 live 에서 실제로 그랬다.
       * Skia 는 scene-node props 를 직접 읽어 멀쩡했던 **한쪽만 깨지는** 형태).
       * ListBox `items` 주석이 같은 함정을 기록해 두고 있다.
       */
      data: {
        kind: "items-manager",
        label: "Sample Rows",
        section: "content",
        itemsManager: {
          itemsKey: "data",
          itemTypeName: "ChartRow",
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
        // 극좌표·pie 는 읽지 않는다 (computeChartScene.ts:417,487,502).
        visibleWhen: { key: "chartType", oneOf: ["bar", "line", "area"] },
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
        visibleWhen: { key: "chartType", oneOf: ["line", "area"] },
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
        visibleWhen: { key: "showValueLabels", truthy: true },
      },
      // ADR-215 — 시리즈 팔레트 (RSC `Chart.colors` 팔레트 이름 참조). `variant` (상자) ·
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
        // computeChartScene.ts:152,358. radar 도 읽는다 — center.inner 가 결측 꼭짓점을
        //   접는 반지름이자 격자 안쪽 경계다.
        visibleWhen: { key: "chartType", oneOf: ["pie", "radial", "radar"] },
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
        visibleWhen: { key: "chartType", equals: "radial" },
      },
      endAngle: {
        kind: "number",
        label: "End Angle (deg)",
        section: "appearance",
        default: 360,
        visibleWhen: { key: "chartType", equals: "radial" },
      },
      showTotal: {
        kind: "boolean",
        label: "Show Total (donut · radial)",
        section: "appearance",
        default: false,
        // computeChartScene.ts:359 + radial 확장 (P3 — centerTotalLabels 공유).
        visibleWhen: { key: "chartType", oneOf: ["pie", "radial"] },
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
        visibleWhen: { key: "isAnimationActive", truthy: true },
      },
      animationDuration: {
        kind: "number",
        label: "Animation Duration (ms)",
        section: "interaction",
        default: 600,
        min: 0,
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
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "default",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
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
      "variant",
      "size",
    ],
  },
  skiaPrimitive: "chart_scene",
  staticAttrs: {},
};

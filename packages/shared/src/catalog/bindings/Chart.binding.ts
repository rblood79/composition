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
        label: "Dimension",
        section: "content",
        default: "category",
      },
      metric: {
        kind: "string",
        label: "Metric",
        section: "content",
        default: "value",
      },
      color: {
        kind: "string",
        label: "Series Field",
        section: "content",
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

      // ── appearance ──
      orientation: {
        kind: "enum",
        label: "Orientation",
        section: "appearance",
        default: "vertical",
        options: [
          { value: "vertical", label: "Vertical" },
          { value: "horizontal", label: "Horizontal" },
        ],
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
      },
      showDots: {
        kind: "boolean",
        label: "Show Dots",
        section: "appearance",
        default: false,
      },
      showValueLabels: {
        kind: "boolean",
        label: "Show Value Labels",
        section: "appearance",
        default: false,
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
      },
      innerRadius: {
        kind: "number",
        label: "Inner Radius (%)",
        section: "appearance",
        default: 0,
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
      },
      showSpokes: {
        kind: "boolean",
        label: "Show Spokes",
        section: "appearance",
        default: true,
      },
      gridRings: {
        kind: "number",
        label: "Grid Rings (0=auto)",
        section: "appearance",
        default: 0,
      },
      fillGrid: {
        kind: "boolean",
        label: "Fill Grid",
        section: "appearance",
        default: false,
      },
      fillArea: {
        kind: "boolean",
        label: "Fill Area (radar)",
        section: "appearance",
        default: true,
      },
      startAngle: {
        kind: "number",
        label: "Start Angle (deg)",
        section: "appearance",
        default: 0,
      },
      endAngle: {
        kind: "number",
        label: "End Angle (deg)",
        section: "appearance",
        default: 360,
      },
      labelKey: {
        kind: "enum",
        label: "Label Content",
        section: "appearance",
        default: "value",
        options: [
          { value: "value", label: "Value" },
          { value: "category", label: "Category Name" },
        ],
      },
      showTotal: {
        kind: "boolean",
        label: "Show Total (donut · radial)",
        section: "appearance",
        default: false,
      },
      showTooltip: {
        kind: "boolean",
        label: "Show Tooltip",
        section: "appearance",
        default: false,
      },
      showAxis: {
        kind: "boolean",
        label: "Show Axis",
        section: "appearance",
        default: true,
      },
      showGrid: {
        kind: "boolean",
        label: "Show Grid",
        section: "appearance",
        default: false,
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
        section: "appearance",
        default: "bottom",
        options: [
          { value: "bottom", label: "Bottom" },
          { value: "top", label: "Top" },
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
        ],
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
      "orientation",
      "stackType",
      "curve",
      "showDots",
      "showValueLabels",
      "colorBy",
      "innerRadius",
      "gridType",
      "showSpokes",
      "gridRings",
      "fillGrid",
      "fillArea",
      "startAngle",
      "endAngle",
      "labelKey",
      "showTotal",
      "showTooltip",
      "showAxis",
      "showGrid",
      "showLegend",
      "legendPosition",
      "variant",
      "size",
    ],
  },
  skiaPrimitive: "chart_scene",
  staticAttrs: { role: "img" },
};

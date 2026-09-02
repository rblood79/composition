/**
 * Layout 스타일/핸들 타입 정의 (구 taffyLayout.ts 에서 이전)
 *
 * ADR-916 Taffy 완전 제거 (2026-07-06): TaffyLayout wrapper 삭제 후에도
 * element→style 변환기(flexStyleAdapter/blockStyleAdapter)와 fullTreeLayout /
 * persistentLayoutTree 가 소비하는 순수 TypeScript 타입만 본 파일에 보존한다.
 * 타입 접두는 ADR-923 Phase 6 (2026-09-03) 에서 `Taffy*` → `Engine*` 로 개명 — 스키마 자체는
 * 자체 엔진 (composition-engine) 의 Rust `StyleInput` (Taffy 0.9 계보) 과 1:1 대응한다.
 */

/**
 * 엔진 경계 display 운반 union — **CSS display 값 그대로** (ADR-923 Phase 5, 2026-09-02).
 * outer(inline → block 부모의 line item)/inner(solver) 해석은 엔진 `display.rs` 가 맡는다;
 * TS 는 값을 지우지 않는다 (종전 union `flex | grid | block | none` 은 inline-* 의 outer 를 잃었다 — S9).
 * 미인식 값은 `normalizeCssDisplay` 가 `block` 으로 폴백 (엔진 `parse_display` 와 동일).
 */
export type EngineDisplay =
  | "block"
  | "inline"
  | "inline-block"
  | "flex"
  | "inline-flex"
  | "grid"
  | "inline-grid"
  | "none";
export type EnginePosition = "relative" | "absolute";
export type EngineOverflow = "visible" | "hidden" | "clip" | "scroll";
export type EngineFlexDirection =
  "row" | "column" | "row-reverse" | "column-reverse";
export type EngineFlexWrap = "nowrap" | "wrap" | "wrap-reverse";
export type EngineJustifyContent =
  | "flex-start"
  | "flex-end"
  | "center"
  | "space-between"
  | "space-around"
  | "space-evenly"
  | "start"
  | "end"
  | "stretch";
export type EngineAlignItems =
  | "flex-start"
  | "flex-end"
  | "center"
  | "stretch"
  | "baseline"
  | "start"
  | "end";
export type EngineAlignContent =
  | "flex-start"
  | "flex-end"
  | "center"
  | "stretch"
  | "space-between"
  | "space-around"
  | "space-evenly"
  | "start"
  | "end";
export type EngineAlignSelf =
  | "auto"
  | "flex-start"
  | "flex-end"
  | "center"
  | "stretch"
  | "baseline"
  | "start"
  | "end";
export type EngineGridAutoFlow = "row" | "column" | "row-dense" | "column-dense";
export type EngineJustifyItems =
  | "start"
  | "end"
  | "center"
  | "stretch"
  | "baseline"
  | "flex-start"
  | "flex-end";
export type EngineJustifySelf =
  | "auto"
  | "start"
  | "end"
  | "center"
  | "stretch"
  | "baseline"
  | "flex-start"
  | "flex-end";

/** CSS-like dimension value: "100px", "50%", "auto", plain number (treated as px). */
export type EngineDimensionValue = string | number;

/** Grid track definition: "1fr", "100px", "auto", "minmax(100px, 1fr)". */
export type EngineTrackValue = string;

/** Grid placement: "1", "span 2", "auto", or a number. */
export type EngineGridPlacement = string | number;

/**
 * Engine style input matching the Rust `StyleInput` schema (Taffy 0.9 계보).
 * All fields are optional — unset fields use the engine's Style::DEFAULT.
 */
export interface EngineStyle {
  // Display & position
  display?: EngineDisplay;
  position?: EnginePosition;
  overflowX?: EngineOverflow;
  overflowY?: EngineOverflow;

  // Flex container
  flexDirection?: EngineFlexDirection;
  flexWrap?: EngineFlexWrap;
  justifyContent?: EngineJustifyContent;
  justifyItems?: EngineJustifyItems;
  alignItems?: EngineAlignItems;
  alignContent?: EngineAlignContent;

  // Flex item
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: EngineDimensionValue;
  alignSelf?: EngineAlignSelf;
  justifySelf?: EngineJustifySelf;
  order?: number;

  // Grid container
  gridTemplateColumns?: EngineTrackValue[];
  gridTemplateRows?: EngineTrackValue[];
  gridAutoFlow?: EngineGridAutoFlow;
  gridAutoColumns?: EngineTrackValue[];
  gridAutoRows?: EngineTrackValue[];

  // Grid item
  gridColumnStart?: EngineGridPlacement;
  gridColumnEnd?: EngineGridPlacement;
  gridRowStart?: EngineGridPlacement;
  gridRowEnd?: EngineGridPlacement;

  // Size
  width?: EngineDimensionValue;
  height?: EngineDimensionValue;
  minWidth?: EngineDimensionValue;
  minHeight?: EngineDimensionValue;
  maxWidth?: EngineDimensionValue;
  maxHeight?: EngineDimensionValue;

  // Margin
  marginTop?: EngineDimensionValue;
  marginRight?: EngineDimensionValue;
  marginBottom?: EngineDimensionValue;
  marginLeft?: EngineDimensionValue;

  // Padding
  paddingTop?: EngineDimensionValue;
  paddingRight?: EngineDimensionValue;
  paddingBottom?: EngineDimensionValue;
  paddingLeft?: EngineDimensionValue;

  // Border
  borderTop?: EngineDimensionValue;
  borderRight?: EngineDimensionValue;
  borderBottom?: EngineDimensionValue;
  borderLeft?: EngineDimensionValue;

  // Inset (position offsets)
  insetTop?: EngineDimensionValue;
  insetRight?: EngineDimensionValue;
  insetBottom?: EngineDimensionValue;
  insetLeft?: EngineDimensionValue;

  // Gap
  columnGap?: EngineDimensionValue;
  rowGap?: EngineDimensionValue;

  // Aspect ratio
  aspectRatio?: number;

  // Intrinsic 측정 스칼라 (ADR-165) — CSS 속성이 아니라 TS 측정 공급 채널.
  // 텍스트 leaf 의 min-content(최장 단어)/max-content(단일줄) content-box px (ceil).
  // 엔진 NodeStyle.content_min_width/content_max_width 대응 — width intrinsic
  // 키워드(fit/min/max-content)와 §4.5 automatic minimum floor 의 입력.
  contentMinWidth?: number;
  contentMaxWidth?: number;

  // Baseline 계약 입력 3종 (ADR-923 Phase 2 — wasm 경계).
  // 엔진 NodeStyle.vertical_align/line_height/leaf_baseline 대응.
  /** vertical-align CSS 키워드 (baseline/top/middle/bottom) — 엔진이 u8 매핑 */
  verticalAlign?: string;
  /** line-height — px 해석 완료 스칼라 (배율·단위는 TS 가 fontSize 로 선해석) */
  lineHeight?: number;
  /** 텍스트 leaf 첫 줄 baseline (content-box 상단 기준 px — 측정 공급 채널) */
  leafBaseline?: number;
}

/** Opaque handle to a layout node. (구 EngineNodeHandle — 자체 엔진 handle 과 동일 규약) */
export type EngineNodeHandle = number;

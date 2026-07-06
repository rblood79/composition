/**
 * Layout 스타일/핸들 타입 정의 (구 taffyLayout.ts 에서 이전)
 *
 * ADR-916 Taffy 완전 제거 (2026-07-06): TaffyLayout wrapper 삭제 후에도
 * element→style 변환기(TaffyFlexEngine/TaffyBlockEngine)와 fullTreeLayout /
 * persistentTaffyTree 가 소비하는 순수 TypeScript 타입만 본 파일에 보존한다.
 * "Taffy" 접두 네이밍은 스타일 스키마 계보 표기로 유지 — 자체 엔진
 * (composition-engine) 의 Rust `StyleInput` 스키마와 1:1 대응한다.
 */

export type TaffyDisplay = "flex" | "grid" | "block" | "none";
export type TaffyPosition = "relative" | "absolute";
export type TaffyOverflow = "visible" | "hidden" | "clip" | "scroll";
export type TaffyFlexDirection =
  | "row"
  | "column"
  | "row-reverse"
  | "column-reverse";
export type TaffyFlexWrap = "nowrap" | "wrap" | "wrap-reverse";
export type TaffyJustifyContent =
  | "flex-start"
  | "flex-end"
  | "center"
  | "space-between"
  | "space-around"
  | "space-evenly"
  | "start"
  | "end"
  | "stretch";
export type TaffyAlignItems =
  | "flex-start"
  | "flex-end"
  | "center"
  | "stretch"
  | "baseline"
  | "start"
  | "end";
export type TaffyAlignContent =
  | "flex-start"
  | "flex-end"
  | "center"
  | "stretch"
  | "space-between"
  | "space-around"
  | "space-evenly"
  | "start"
  | "end";
export type TaffyAlignSelf =
  | "auto"
  | "flex-start"
  | "flex-end"
  | "center"
  | "stretch"
  | "baseline"
  | "start"
  | "end";
export type TaffyGridAutoFlow = "row" | "column" | "row-dense" | "column-dense";
export type TaffyJustifyItems =
  | "start"
  | "end"
  | "center"
  | "stretch"
  | "baseline"
  | "flex-start"
  | "flex-end";
export type TaffyJustifySelf =
  | "auto"
  | "start"
  | "end"
  | "center"
  | "stretch"
  | "baseline"
  | "flex-start"
  | "flex-end";

/** CSS-like dimension value: "100px", "50%", "auto", plain number (treated as px). */
export type TaffyDimensionValue = string | number;

/** Grid track definition: "1fr", "100px", "auto", "minmax(100px, 1fr)". */
export type TaffyTrackValue = string;

/** Grid placement: "1", "span 2", "auto", or a number. */
export type TaffyGridPlacement = string | number;

/**
 * Taffy style input matching the Rust `StyleInput` schema.
 * All fields are optional — unset fields use Taffy's Style::DEFAULT.
 */
export interface TaffyStyle {
  // Display & position
  display?: TaffyDisplay;
  position?: TaffyPosition;
  overflowX?: TaffyOverflow;
  overflowY?: TaffyOverflow;

  // Flex container
  flexDirection?: TaffyFlexDirection;
  flexWrap?: TaffyFlexWrap;
  justifyContent?: TaffyJustifyContent;
  justifyItems?: TaffyJustifyItems;
  alignItems?: TaffyAlignItems;
  alignContent?: TaffyAlignContent;

  // Flex item
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: TaffyDimensionValue;
  alignSelf?: TaffyAlignSelf;
  justifySelf?: TaffyJustifySelf;
  order?: number;

  // Grid container
  gridTemplateColumns?: TaffyTrackValue[];
  gridTemplateRows?: TaffyTrackValue[];
  gridAutoFlow?: TaffyGridAutoFlow;
  gridAutoColumns?: TaffyTrackValue[];
  gridAutoRows?: TaffyTrackValue[];

  // Grid item
  gridColumnStart?: TaffyGridPlacement;
  gridColumnEnd?: TaffyGridPlacement;
  gridRowStart?: TaffyGridPlacement;
  gridRowEnd?: TaffyGridPlacement;

  // Size
  width?: TaffyDimensionValue;
  height?: TaffyDimensionValue;
  minWidth?: TaffyDimensionValue;
  minHeight?: TaffyDimensionValue;
  maxWidth?: TaffyDimensionValue;
  maxHeight?: TaffyDimensionValue;

  // Margin
  marginTop?: TaffyDimensionValue;
  marginRight?: TaffyDimensionValue;
  marginBottom?: TaffyDimensionValue;
  marginLeft?: TaffyDimensionValue;

  // Padding
  paddingTop?: TaffyDimensionValue;
  paddingRight?: TaffyDimensionValue;
  paddingBottom?: TaffyDimensionValue;
  paddingLeft?: TaffyDimensionValue;

  // Border
  borderTop?: TaffyDimensionValue;
  borderRight?: TaffyDimensionValue;
  borderBottom?: TaffyDimensionValue;
  borderLeft?: TaffyDimensionValue;

  // Inset (position offsets)
  insetTop?: TaffyDimensionValue;
  insetRight?: TaffyDimensionValue;
  insetBottom?: TaffyDimensionValue;
  insetLeft?: TaffyDimensionValue;

  // Gap
  columnGap?: TaffyDimensionValue;
  rowGap?: TaffyDimensionValue;

  // Aspect ratio
  aspectRatio?: number;
}

/** Opaque handle to a layout node. (구 TaffyNodeHandle — 자체 엔진 handle 과 동일 규약) */
export type TaffyNodeHandle = number;

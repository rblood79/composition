/**
 * Spacing handle vocabulary (ADR-222) shared by the geometry and its editors. No store or
 * document imports: the ADR-248 Canvas reads it without the old presentation layer.
 */
export type SpacingSide = "top" | "right" | "bottom" | "left";
export const SPACING_SIDES: readonly SpacingSide[] = [
  "top",
  "right",
  "bottom",
  "left",
];

export type SpacingPaddingProperty =
  "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft";
export type SpacingGapProperty = "rowGap" | "columnGap";
export type SpacingProperty = SpacingPaddingProperty | SpacingGapProperty;

export const PADDING_PROPERTY_BY_SIDE: Readonly<
  Record<SpacingSide, SpacingPaddingProperty>
> = {
  top: "paddingTop",
  right: "paddingRight",
  bottom: "paddingBottom",
  left: "paddingLeft",
};

export interface SpacingBoxMetrics {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface SpacingPaddingGrowth {
  readonly x: boolean;
  readonly y: boolean;
}

export type SpacingActiveMode = "press" | "drag" | "input";

export interface SpacingActiveTarget {
  /** 포인터가 잡은 띠 */
  readonly bandId: string;
  /** 같이 움직이는 띠 전부 (Option/Alt 양쪽 · 4변) */
  readonly bandIds: readonly string[];
  readonly mode: SpacingActiveMode;
}

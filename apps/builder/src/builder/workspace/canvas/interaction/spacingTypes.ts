/**
 * Spacing handle vocabulary (ADR-222) shared by the geometry and its editors. No store or
 * document imports: the ADR-248 Canvas reads it without the old presentation layer.
 */
import type { EditorPresentationTargetRef } from "../../../presentation/editorPresentationTypes";

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

/** Why a container's padding · gap cannot be edited on the Canvas (ADR-222). */
export type SpacingUnsupportedReason =
  | "no-selection"
  | "multi-selection"
  | "not-canonical-node"
  | "body"
  | "cascade-shadowed"
  | "engine-style-missing"
  | "position-unsupported"
  | "grid"
  | "grid-ancestor"
  | "transform"
  | "locked"
  | "not-container"
  | "raw-unit-preserved"
  | "not-flex"
  | "wrap"
  | "distributed-alignment"
  | "auto-margin-child"
  | "fewer-than-two-children";

export type SpacingAxisCapability =
  | {
      readonly supported: true;
      /** 주축 gap property — row 계열은 columnGap, column 계열은 rowGap */
      readonly property: SpacingGapProperty;
      readonly axis: "horizontal" | "vertical";
      readonly reverse: boolean;
      /** effective px (엔진 소비값) */
      readonly value: number;
      /** in-flow 자식 ID (layout 순서) */
      readonly flowChildIds: readonly string[];
    }
  | { readonly supported: false; readonly reason: SpacingUnsupportedReason };

export type SpacingPaddingCapability =
  | {
      readonly supported: true;
      /** effective px (엔진 소비값) — 미지정은 0 */
      readonly values: SpacingBoxMetrics;
      /** raw canonical 에 있는 변 (없으면 catalog/기본값 유래) */
      readonly rawSides: ReadonlySet<SpacingSide>;
      /** padding 을 늘리면 박스가 그 축으로 커지는가 (hug) — 드래그 부호 입력 (`resolvePaddingGrowth`) */
      readonly growth: SpacingPaddingGrowth;
    }
  | { readonly supported: false; readonly reason: SpacingUnsupportedReason };

export interface SpacingCapability {
  readonly projectId: string;
  readonly target: Extract<
    EditorPresentationTargetRef,
    { kind: "canonical-node" }
  >;
  readonly rootKey: string;
  readonly nodeType: string;
  /** border 두께 px (padding-box 계산용) */
  readonly border: SpacingBoxMetrics;
  readonly padding: SpacingPaddingCapability;
  readonly gap: SpacingAxisCapability;
  readonly rawStyle: Readonly<Record<string, unknown>>;
}

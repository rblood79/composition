/**
 * ADR-248 G6: the old editor presentation pilots' target shapes, without their store bindings —
 * the Styles host's bridge type and the hooks read these, so the catalog Builder's import graph
 * does not reach the pilots (old canonical document store).
 */
import type { FillItem } from "../../types/builder/fill.types";
import type {
  EditorMutationPropagation,
  EditorPresentationTargetRef,
} from "./editorPresentationTypes";

export interface FillPresentationPilotTarget {
  readonly fills: readonly FillItem[];
  readonly materializedFallback: boolean;
  readonly projectId: string;
  readonly target: EditorPresentationTargetRef;
}

export interface BorderColorPresentationPilotTarget {
  readonly projectId: string;
  readonly style: Readonly<Record<string, unknown>>;
  readonly target: EditorPresentationTargetRef;
}

export interface BoxShadowPresentationPilotTarget {
  readonly projectId: string;
  readonly style: Readonly<Record<string, unknown>>;
  readonly target: EditorPresentationTargetRef;
}

export interface TextColorPresentationPilotTarget {
  readonly projectId: string;
  readonly propagation: EditorMutationPropagation;
  readonly style: Readonly<Record<string, unknown>>;
  readonly target: EditorPresentationTargetRef;
}

export interface OpacityPresentationPilotTarget {
  readonly projectId: string;
  readonly style: Readonly<Record<string, unknown>>;
  readonly target: EditorPresentationTargetRef;
}

export type LayoutPresentationProperty =
  | "width"
  | "height"
  | "padding"
  | "paddingTop"
  | "paddingRight"
  | "paddingBottom"
  | "paddingLeft"
  | "gap"
  | "rowGap"
  | "columnGap";

export interface LayoutPresentationPilotTarget {
  readonly projectId: string;
  readonly property: LayoutPresentationProperty;
  readonly style: Readonly<Record<string, unknown>>;
  readonly target: EditorPresentationTargetRef;
}

export type TextMetricPresentationProperty = "fontSize" | "fontWeight";

export interface TextMetricPresentationPilotTarget {
  readonly projectId: string;
  readonly style: Readonly<Record<string, unknown>>;
  readonly target: EditorPresentationTargetRef;
}

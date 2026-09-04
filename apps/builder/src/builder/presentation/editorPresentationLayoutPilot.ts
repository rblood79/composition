import {
  editorPresentationCanonicalRuntimeOptions,
  getEditorPresentationTargetNode,
  resolveEditorPresentationTarget,
} from "./editorPresentationCommitAdapter";
import { useCanonicalDocumentStore } from "../stores/canonical/canonicalDocumentStore";
import type { EditorPresentationTargetRef } from "./editorPresentationTypes";
import { isStylePresentationPilotEnabled } from "./editorPresentationStylePilot";

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

/**
 * Layout presentation은 CSS 문자열을 hot path에 흘리지 않는다.
 * panel은 px 값을 보내고, runtime descriptor는 계산된 숫자만 소비한다.
 */
export function parsePresentationLayoutPx(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value !== "string") return null;
  const match = /^\s*(\d+(?:\.\d+)?)px\s*$/.exec(value);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function readLayoutPresentationValue(
  style: Readonly<Record<string, unknown>>,
  property: LayoutPresentationProperty,
): number | null {
  const direct = parsePresentationLayoutPx(style[property]);
  if (direct !== null) return direct;
  if (property === "padding") {
    const values = [
      style.paddingTop,
      style.paddingRight,
      style.paddingBottom,
      style.paddingLeft,
    ].map(parsePresentationLayoutPx);
    if (values.every((value) => value !== null && value === values[0])) {
      return values[0];
    }
  }
  if (property === "gap") {
    const rowGap = parsePresentationLayoutPx(style.rowGap ?? style.gap);
    const columnGap = parsePresentationLayoutPx(style.columnGap ?? style.gap);
    if (rowGap !== null && columnGap !== null && rowGap === columnGap) {
      return rowGap;
    }
  }
  if (property === "rowGap" || property === "columnGap") {
    return parsePresentationLayoutPx(style.gap);
  }
  return null;
}

export function canUseTargetedLayoutPresentation(
  style: Readonly<Record<string, unknown>>,
  hasChildren: boolean,
  property: LayoutPresentationProperty = "width",
): boolean {
  const position = style.position;
  if (position === "fixed" || position === "sticky") return false;
  if (property === "width" || property === "height") {
    if (position === "absolute") return !hasChildren;
    return true;
  }
  // 엔진 targeted incremental placement cannot invalidate grid track caches.
  return style.display !== "grid" && style.display !== "inline-grid";
}

/**
 * G6 scoped layout slice.
 *
 * Absolute leaf와 targeted engine을 보유한 in-flow node의 명시 width/height,
 * 그리고 non-grid flow의 numeric spacing만 targeted publication에 연다.
 * percentage/auto/intrinsic/grid track 값은 여전히 commit-only로 닫는다.
 */
export function resolveLayoutPresentationPilotTarget(
  selectedElementId: string | null,
  property: LayoutPresentationProperty,
): LayoutPresentationPilotTarget | null {
  if (!isStylePresentationPilotEnabled() || !selectedElementId) return null;

  const state = useCanonicalDocumentStore.getState();
  const projectId = state.currentProjectId;
  if (!projectId || !state.documents.has(projectId)) return null;

  const target = resolveEditorPresentationTarget(projectId, selectedElementId);
  if (
    !target ||
    target.kind !== "canonical-node" ||
    !editorPresentationCanonicalRuntimeOptions.hasTarget(projectId, target)
  ) {
    return null;
  }
  const element = getEditorPresentationTargetNode(projectId, target);
  if (!element) return null;

  const style = editorPresentationCanonicalRuntimeOptions.readTargetValue(
    projectId,
    target,
    `style-layout-${property}`,
  );
  if (!style || typeof style !== "object" || Array.isArray(style)) return null;
  const styleRecord = style as Record<string, unknown>;
  if (
    !canUseTargetedLayoutPresentation(
      styleRecord,
      (element.children?.length ?? 0) > 0,
      property,
    )
  ) {
    return null;
  }
  if (readLayoutPresentationValue(styleRecord, property) === null) return null;

  return { projectId, property, style: styleRecord, target };
}

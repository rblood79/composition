import {
  editorPresentationCanonicalRuntimeOptions,
  getEditorPresentationTargetNode,
  resolveEditorPresentationTarget,
} from "./editorPresentationCommitAdapter";
import { parsePresentationLayoutPx } from "./editorPresentationLayoutValue";
import { useCanonicalDocumentStore } from "../stores/canonical/canonicalDocumentStore";
import type { EditorPresentationTargetRef } from "./editorPresentationTypes";
import { isStylePresentationPilotEnabled } from "./editorPresentationStylePilot";
import type {
  LayoutPresentationProperty,
  LayoutPresentationPilotTarget,
} from "./editorPresentationPilotTypes";
export type {
  LayoutPresentationProperty,
  LayoutPresentationPilotTarget,
};

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

export { parsePresentationLayoutPx };

import {
  editorPresentationCanonicalRuntimeOptions,
  getEditorPresentationTargetNode,
  resolveEditorPresentationTarget,
} from "./editorPresentationCommitAdapter";
import { useCanonicalDocumentStore } from "../stores/canonical/canonicalDocumentStore";
import type { EditorPresentationTargetRef } from "./editorPresentationTypes";
import { isStylePresentationPilotEnabled } from "./editorPresentationStylePilot";
import { getSkiaNode } from "../workspace/canvas/skia/useSkiaNode";
import {
  isFixedTextMetricStyle,
  parsePresentationFontSize,
  parsePresentationFontWeight,
} from "./editorPresentationTextMetricValue";

export type TextMetricPresentationProperty = "fontSize" | "fontWeight";

export interface TextMetricPresentationPilotTarget {
  readonly projectId: string;
  readonly style: Readonly<Record<string, unknown>>;
  readonly target: EditorPresentationTargetRef;
}

/**
 * G8 scoped text metric slice. A standalone, absolute Text leaf with explicit
 * pixel dimensions is the only target whose paragraph can be replaced without
 * reflowing an ancestor or invalidating hit-test topology.
 */
export function resolveTextMetricPresentationPilotTarget(
  selectedElementId: string | null,
  property: TextMetricPresentationProperty = "fontSize",
): TextMetricPresentationPilotTarget | null {
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
  if (
    !element ||
    element.type !== "Text" ||
    (element.children?.length ?? 0) > 0
  ) {
    return null;
  }

  const skiaNode = getSkiaNode(target.nodeId);
  if (
    !skiaNode?.presentationTextMetricTargets ||
    skiaNode.presentationTextMetricTargets.length === 0
  ) {
    return null;
  }

  const style = editorPresentationCanonicalRuntimeOptions.readTargetValue(
    projectId,
    target,
    "style-text-metrics",
  );
  if (!style || typeof style !== "object" || Array.isArray(style)) return null;
  const styleRecord = style as Record<string, unknown>;
  return isFixedTextMetricStyle(styleRecord) &&
    (property === "fontSize" ||
      parsePresentationFontWeight(styleRecord.fontWeight) !== null)
    ? { projectId, style: styleRecord, target }
    : null;
}

export { parsePresentationFontSize, parsePresentationFontWeight };

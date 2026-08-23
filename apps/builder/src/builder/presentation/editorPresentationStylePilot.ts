import {
  editorPresentationCanonicalRuntimeOptions,
  getEditorPresentationTargetNode,
  resolveEditorPresentationTarget,
} from "./editorPresentationCommitAdapter";
import { useCanonicalDocumentStore } from "../stores/canonical/canonicalDocumentStore";
import type { EditorPresentationTargetRef } from "./editorPresentationTypes";

const STYLE_PILOT_QUERY_PARAM = "adr187FillPilot";

export interface BorderColorPresentationPilotTarget {
  readonly projectId: string;
  readonly style: Readonly<Record<string, unknown>>;
  readonly target: EditorPresentationTargetRef;
}

export function isStylePresentationPilotEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    new URLSearchParams(window.location.search).get(STYLE_PILOT_QUERY_PARAM) !==
    "0"
  );
}

export function resolveBorderColorPresentationPilotTarget(
  selectedElementId: string | null,
): BorderColorPresentationPilotTarget | null {
  if (!isStylePresentationPilotEnabled() || !selectedElementId) return null;

  const state = useCanonicalDocumentStore.getState();
  const projectId = state.currentProjectId;
  if (!projectId || !state.documents.has(projectId)) return null;

  const target = resolveEditorPresentationTarget(projectId, selectedElementId);
  if (
    !target ||
    !editorPresentationCanonicalRuntimeOptions.hasTarget(projectId, target)
  ) {
    return null;
  }
  const element = getEditorPresentationTargetNode(projectId, target);
  if (!element) return null;
  const style = editorPresentationCanonicalRuntimeOptions.readTargetValue(
    projectId,
    target,
    "style-border-color",
  );
  if (!style || typeof style !== "object" || Array.isArray(style)) return null;
  const styleRecord = style as Record<string, unknown>;
  if (styleRecord.borderStyle === "none") return null;
  if (!("borderColor" in styleRecord) && !("borderWidth" in styleRecord)) {
    return null;
  }
  return { projectId, style: styleRecord, target };
}

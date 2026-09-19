import { useMemo } from "react";
import { create } from "zustand";
import type { CompositionDocument, FrameNode } from "@composition/shared";
import { getReusableFrameMirrorId } from "@/adapters/canonical/frameMirror";
import {
  getActiveCanonicalDocument,
  useActiveCanonicalDocument,
} from "./canonicalElementsBridge";

/**
 * Canonical reusable FrameNode → Builder "Layout" UI/list/invalidation 읽기 투영 (ADR-225).
 * 이 파일이 Layout facade 와 raw `FrameNode` 사이 번역 경계다 — type guard 는 Frame 을 유지한다.
 */
export interface ReusableLayoutSummary {
  id: string;
  name: string;
  project_id: string;
  description?: string;
  slug?: string;
}

type ReusableLayoutSelectionState = {
  selectedReusableLayoutId: string | null;
  setSelectedReusableLayoutId: (frameId: string | null) => void;
};

export const useReusableLayoutSelectionStore =
  create<ReusableLayoutSelectionState>((set) => ({
    selectedReusableLayoutId: null,
    setSelectedReusableLayoutId: (frameId) =>
      set({ selectedReusableLayoutId: frameId }),
  }));

export function useSelectedReusableLayoutId(): string | null {
  return useReusableLayoutSelectionStore(
    (state) => state.selectedReusableLayoutId,
  );
}

export function getSelectedReusableLayoutId(): string | null {
  return useReusableLayoutSelectionStore.getState().selectedReusableLayoutId;
}

export function setSelectedReusableLayoutId(frameId: string | null): void {
  useReusableLayoutSelectionStore
    .getState()
    .setSelectedReusableLayoutId(frameId);
}

function isReusableFrameNode(node: unknown): node is FrameNode {
  return (
    !!node &&
    typeof node === "object" &&
    (node as FrameNode).type === "frame" &&
    (node as FrameNode).reusable === true
  );
}

function getStringMetadata(
  metadata: FrameNode["metadata"],
  key: string,
): string | undefined {
  const value = (metadata as Record<string, unknown> | undefined)?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function canonicalDocumentToReusableLayouts(
  doc: CompositionDocument | null | undefined,
): ReusableLayoutSummary[] {
  if (!doc) return [];

  return doc.children
    .filter(isReusableFrameNode)
    .map((frame): ReusableLayoutSummary => {
      const id = getReusableFrameMirrorId(frame);
      const projectId =
        getStringMetadata(frame.metadata, "project_id") ??
        getStringMetadata(frame.metadata, "projectId") ??
        "";
      return {
        id,
        name: frame.name ?? id,
        project_id: projectId,
        description: getStringMetadata(frame.metadata, "description"),
        slug: getStringMetadata(frame.metadata, "slug"),
      };
    });
}

export function getCanonicalReusableLayouts(): ReusableLayoutSummary[] {
  return canonicalDocumentToReusableLayouts(getActiveCanonicalDocument());
}

export function useCanonicalReusableLayouts(): ReusableLayoutSummary[] {
  const doc = useActiveCanonicalDocument();
  return useMemo(() => canonicalDocumentToReusableLayouts(doc), [doc]);
}

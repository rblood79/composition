import { useMemo } from "react";
import { create } from "zustand";
import type { CompositionDocument, FrameNode } from "@composition/shared";
import { getReusableFrameMirrorId } from "@/adapters/canonical/frameMirror";
import {
  getActiveCanonicalDocument,
  useActiveCanonicalDocument,
} from "./canonicalElementsBridge";

/**
 * Canonical reusable frame → UI/list/invalidation 읽기 투영.
 */
export interface ReusableFrameLayoutSummary {
  id: string;
  name: string;
  project_id: string;
  description?: string;
  slug?: string;
}

type CanonicalFrameSelectionState = {
  selectedReusableFrameId: string | null;
  setSelectedReusableFrameId: (frameId: string | null) => void;
};

export const useCanonicalFrameSelectionStore =
  create<CanonicalFrameSelectionState>((set) => ({
    selectedReusableFrameId: null,
    setSelectedReusableFrameId: (frameId) =>
      set({ selectedReusableFrameId: frameId }),
  }));

export function useSelectedReusableFrameId(): string | null {
  return useCanonicalFrameSelectionStore(
    (state) => state.selectedReusableFrameId,
  );
}

export function getSelectedReusableFrameId(): string | null {
  return useCanonicalFrameSelectionStore.getState().selectedReusableFrameId;
}

export function setSelectedReusableFrameId(frameId: string | null): void {
  useCanonicalFrameSelectionStore
    .getState()
    .setSelectedReusableFrameId(frameId);
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

export function canonicalDocumentToReusableFrameLayouts(
  doc: CompositionDocument | null | undefined,
): ReusableFrameLayoutSummary[] {
  if (!doc) return [];

  return doc.children
    .filter(isReusableFrameNode)
    .map((frame): ReusableFrameLayoutSummary => {
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

export function getCanonicalReusableFrameLayouts(): ReusableFrameLayoutSummary[] {
  return canonicalDocumentToReusableFrameLayouts(getActiveCanonicalDocument());
}

export function useCanonicalReusableFrameLayouts(): ReusableFrameLayoutSummary[] {
  const doc = useActiveCanonicalDocument();
  return useMemo(() => canonicalDocumentToReusableFrameLayouts(doc), [doc]);
}

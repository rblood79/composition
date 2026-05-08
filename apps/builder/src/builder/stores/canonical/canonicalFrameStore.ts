import { useMemo } from "react";
import { create } from "zustand";
import type { CompositionDocument, FrameNode } from "@composition/shared";
import type { Layout } from "@/types/builder/layout.types";
import { getReusableFrameMirrorId } from "@/adapters/canonical/frameMirror";
import { useCanonicalDocumentStore } from "./canonicalDocumentStore";
import {
  getActiveCanonicalDocument,
  useActiveCanonicalDocument,
} from "./canonicalElementsBridge";

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

function createEmptyDocument(): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [],
  };
}

function buildReusableFrameShell(
  layout: Layout,
  existingFrame?: FrameNode,
): FrameNode {
  const metadata: FrameNode["metadata"] = {
    ...(existingFrame?.metadata ?? { type: "legacy-layout" }),
    type: existingFrame?.metadata?.type ?? "legacy-layout",
    layoutId: layout.id,
    project_id: layout.project_id,
    description: layout.description ?? null,
    slug: layout.slug ?? null,
  };
  delete (metadata as Record<string, unknown>).order_num;

  return {
    ...(existingFrame ?? {}),
    id: existingFrame?.id ?? `layout-${layout.id}`,
    type: "frame",
    reusable: true,
    name: layout.name,
    metadata,
    slot: existingFrame?.slot,
    children: existingFrame?.children ?? [],
  };
}

export function seedCanonicalReusableFrameLayouts(
  layouts: Layout[],
  projectId: string,
): void {
  if (layouts.length === 0) return;

  const canonical = useCanonicalDocumentStore.getState();
  const currentDoc = canonical.getDocument(projectId) ?? createEmptyDocument();
  const framesById = new Map<string, FrameNode>();
  for (const child of currentDoc.children) {
    if (isReusableFrameNode(child)) {
      framesById.set(getReusableFrameMirrorId(child), child);
    }
  }

  const nextFrameIds = new Set(layouts.map((layout) => layout.id));
  const nextFrames = layouts.map((layout) =>
    buildReusableFrameShell(layout, framesById.get(layout.id)),
  );
  const otherChildren = currentDoc.children.filter(
    (child) =>
      !isReusableFrameNode(child) ||
      !nextFrameIds.has(getReusableFrameMirrorId(child)),
  );

  if (canonical.currentProjectId !== projectId) {
    canonical.setCurrentProject(projectId);
  }
  canonical.setDocument(projectId, {
    ...currentDoc,
    children: [...nextFrames, ...otherChildren],
  });
}

export function canonicalDocumentToReusableFrameLayouts(
  doc: CompositionDocument | null | undefined,
): Layout[] {
  if (!doc) return [];

  return doc.children.filter(isReusableFrameNode).map((frame): Layout => {
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

export function getCanonicalReusableFrameLayouts(): Layout[] {
  return canonicalDocumentToReusableFrameLayouts(getActiveCanonicalDocument());
}

export function useCanonicalReusableFrameLayouts(): Layout[] {
  const doc = useActiveCanonicalDocument();
  return useMemo(() => canonicalDocumentToReusableFrameLayouts(doc), [doc]);
}

import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { runCanonicalMutation } from "@/adapters/canonical/canonicalMutationRunner";
import type { CanonicalMutationResult } from "@/adapters/canonical/canonicalMutations";
import type { FillItem } from "../../types/builder/fill.types";
import { useStore } from "../stores";
import { canonicalDocumentToElements } from "../stores/canonical/canonicalElementsView";
import { useCanonicalDocumentStore } from "../stores/canonical/canonicalDocumentStore";
import { historyManager } from "../stores/history";
import type { CanonicalHistoryNodeEvent } from "../stores/history/canonicalHistoryEvents";
import type {
  EditorPresentationCommitInput,
  EditorPresentationCommitResult,
  EditorPresentationRuntimeOptions,
} from "./editorPresentationRuntime";
import type {
  EditorMutationDescriptor,
  EditorPresentationTargetRef,
} from "./editorPresentationTypes";

interface IndexedCanonicalNode {
  readonly indexPath: readonly number[];
  readonly node: CanonicalNode;
  readonly parentId: string | null;
  readonly siblingIndex: number;
}

const indexByDocument = new WeakMap<
  CompositionDocument,
  ReadonlyMap<string, IndexedCanonicalNode>
>();
let documentIndexBuildCount = 0;
let documentIndexReadMissCount = 0;

function buildDocumentIndex(
  document: CompositionDocument,
): ReadonlyMap<string, IndexedCanonicalNode> {
  documentIndexBuildCount += 1;
  const index = new Map<string, IndexedCanonicalNode>();
  const visit = (
    nodes: readonly CanonicalNode[],
    parentId: string | null,
    parentPath: readonly number[],
  ): void => {
    nodes.forEach((node, siblingIndex) => {
      const indexPath = Object.freeze([...parentPath, siblingIndex]);
      index.set(
        node.id,
        Object.freeze({ indexPath, node, parentId, siblingIndex }),
      );
      if (node.children) visit(node.children, node.id, indexPath);
    });
  };
  visit(document.children, null, []);
  return index;
}

function getDocumentIndex(
  document: CompositionDocument,
): ReadonlyMap<string, IndexedCanonicalNode> {
  const cached = indexByDocument.get(document);
  if (cached) return cached;
  documentIndexReadMissCount += 1;
  throw new Error("Canonical presentation index was not primed for document");
}

function primeDocumentIndexes(
  documents: ReadonlyMap<string, CompositionDocument>,
): void {
  for (const document of documents.values()) {
    if (indexByDocument.has(document)) continue;
    indexByDocument.set(document, buildDocumentIndex(document));
  }
}

primeDocumentIndexes(useCanonicalDocumentStore.getState().documents);
useCanonicalDocumentStore.subscribe((state, previousState) => {
  if (state.documents === previousState.documents) return;
  primeDocumentIndexes(state.documents);
});

export function getEditorPresentationCommitAdapterDiagnostics(): {
  readonly documentIndexBuildCount: number;
  readonly documentIndexReadMissCount: number;
} {
  return Object.freeze({
    documentIndexBuildCount,
    documentIndexReadMissCount,
  });
}

function readProjectDocument(projectId: string): CompositionDocument | null {
  const state = useCanonicalDocumentStore.getState();
  if (state.currentProjectId !== projectId) return null;
  return state.documents.get(projectId) ?? null;
}

function getIndexedNode(
  projectId: string,
  target: EditorPresentationTargetRef,
): IndexedCanonicalNode | null {
  if (target.kind !== "canonical-node") return null;
  const document = readProjectDocument(projectId);
  return document
    ? (getDocumentIndex(document).get(target.nodeId) ?? null)
    : null;
}

function cloneFillItems(fills: readonly FillItem[]): FillItem[] {
  return fills.map((fill) => structuredClone(fill));
}

function cloneCanonicalNode(node: CanonicalNode): CanonicalNode {
  return structuredClone(node);
}

function replaceNodeAtIndexPath(
  document: CompositionDocument,
  indexPath: readonly number[],
  nextNode: CanonicalNode,
): CompositionDocument {
  const replace = (
    nodes: readonly CanonicalNode[],
    depth: number,
  ): CanonicalNode[] => {
    const siblingIndex = indexPath[depth];
    if (siblingIndex === undefined || !nodes[siblingIndex]) {
      throw new Error("Canonical presentation index path is stale");
    }
    const nextNodes = [...nodes];
    if (depth === indexPath.length - 1) {
      nextNodes[siblingIndex] = nextNode;
      return nextNodes;
    }
    const parent = nodes[siblingIndex];
    nextNodes[siblingIndex] = {
      ...parent,
      children: replace(parent.children ?? [], depth + 1),
    };
    return nextNodes;
  };

  return { ...document, children: replace(document.children, 0) };
}

export function areFillItemsEqual(
  left: readonly FillItem[] | undefined,
  right: readonly FillItem[] | undefined,
): boolean {
  if (left === right) return true;
  if (!left || !right || left.length !== right.length) return false;
  return left.every(
    (fill, index) => JSON.stringify(fill) === JSON.stringify(right[index]),
  );
}

function readTargetFills(
  projectId: string,
  target: EditorPresentationTargetRef,
): readonly FillItem[] | null {
  const entry = getIndexedNode(projectId, target);
  if (!entry) return null;
  return Array.isArray(entry.node.fills)
    ? (entry.node.fills as FillItem[])
    : [];
}

function buildReplaceHistoryEvents(
  before: IndexedCanonicalNode,
  after: CanonicalNode,
): CanonicalHistoryNodeEvent[] {
  return [
    {
      type: "remove",
      node: cloneCanonicalNode(before.node),
      parentId: before.parentId,
      index: before.siblingIndex,
    },
    {
      type: "insert",
      node: cloneCanonicalNode(after),
      parentId: before.parentId,
      index: before.siblingIndex,
    },
  ];
}

export function commitEditorPresentationFills(
  input: EditorPresentationCommitInput,
): EditorPresentationCommitResult {
  const descriptor = input.descriptor;
  const target = descriptor.target;
  if (descriptor.type !== "fills.replace" || target.kind !== "canonical-node") {
    throw new Error(
      "ADR-187 Phase 2 commit allowlist only accepts canonical fills.replace",
    );
  }

  const canonical = useCanonicalDocumentStore.getState();
  if (canonical.currentProjectId !== input.projectId) {
    throw new Error("Editor presentation project is no longer active");
  }
  if (canonical.documentVersion !== input.baseDocumentVersion) {
    throw new Error(
      "Editor presentation document version changed before commit",
    );
  }
  const document = canonical.documents.get(input.projectId);
  const before = document
    ? getDocumentIndex(document).get(target.nodeId)
    : undefined;
  if (!document || !before) {
    throw new Error("Editor presentation canonical target no longer exists");
  }

  const nextFills = cloneFillItems(descriptor.fills);
  const previousFills = Array.isArray(before.node.fills)
    ? (before.node.fills as FillItem[])
    : [];
  if (areFillItemsEqual(previousFills, nextFills)) {
    return { committedDocumentRevision: canonical.documentVersion };
  }
  if (!historyManager.getCurrentPageId()) {
    throw new Error(
      "Editor presentation commit requires an active history page",
    );
  }

  const nextNode: CanonicalNode = { ...before.node, fills: nextFills };
  const nextDocument = replaceNodeAtIndexPath(
    document,
    before.indexPath,
    nextNode,
  );
  const historyEvents = buildReplaceHistoryEvents(before, nextNode);

  runCanonicalMutation<CanonicalMutationResult>({
    canonical: () => {
      useCanonicalDocumentStore
        .getState()
        .setDocument(input.projectId, nextDocument);
      return { changed: true, document: nextDocument };
    },
    store: () => {
      const elements = canonicalDocumentToElements(nextDocument);
      useStore.setState((state) => ({
        elements,
        layoutVersion: state.layoutVersion + 1,
      }));
    },
    history: () => {
      historyManager.addEntry({
        type: "update",
        elementId: target.nodeId,
        data: { canonicalEvents: historyEvents },
      });
    },
  });

  return {
    committedDocumentRevision:
      useCanonicalDocumentStore.getState().documentVersion,
  };
}

export const editorPresentationCanonicalRuntimeOptions: Required<
  Pick<
    EditorPresentationRuntimeOptions,
    | "commit"
    | "hasTarget"
    | "isDescriptorEqualToBase"
    | "readDocumentVersion"
    | "readTargetValue"
  >
> = {
  commit: commitEditorPresentationFills,
  hasTarget: (projectId, target) => getIndexedNode(projectId, target) !== null,
  isDescriptorEqualToBase: (descriptor, baseValue) =>
    descriptor.type === "fills.replace" &&
    areFillItemsEqual(
      descriptor.fills,
      Array.isArray(baseValue) ? (baseValue as FillItem[]) : [],
    ),
  readDocumentVersion: (projectId) => {
    const state = useCanonicalDocumentStore.getState();
    return state.currentProjectId === projectId ? state.documentVersion : -1;
  },
  readTargetValue: (projectId, target) => readTargetFills(projectId, target),
};

export function isCanonicalFillDescriptor(
  descriptor: EditorMutationDescriptor,
): descriptor is Extract<EditorMutationDescriptor, { type: "fills.replace" }> {
  return (
    descriptor.type === "fills.replace" &&
    descriptor.target.kind === "canonical-node"
  );
}

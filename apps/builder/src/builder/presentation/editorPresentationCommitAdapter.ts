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
import { isTextColorPresentationType } from "./editorPresentationTextColor";
import {
  getCanonicalRefDescendantOverride,
  getCanonicalRefPathSegment,
  getCanonicalRefTarget,
  withCanonicalRefDescendantFills,
  withCanonicalRefDescendantStylePatch,
} from "../../adapters/canonical/canonicalRefResolution";

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

function findDescendantNode(
  root: CanonicalNode,
  pathKey: string,
): CanonicalNode | null {
  let current: CanonicalNode = root;
  for (const segment of pathKey.split("/")) {
    const next = current.children?.find(
      (child) => getCanonicalRefPathSegment(child) === segment,
    );
    if (!next) return null;
    current = next;
  }
  return current;
}

export function getEditorPresentationTargetNode(
  projectId: string,
  target: EditorPresentationTargetRef,
): CanonicalNode | null {
  if (target.kind === "canonical-node") {
    return getIndexedNode(projectId, target)?.node ?? null;
  }
  const refRoot = getIndexedNode(projectId, {
    kind: "canonical-node",
    nodeId: target.refId,
  });
  if (!refRoot) return null;
  const masterId = getCanonicalRefTarget(refRoot.node);
  if (!masterId) return null;
  const master = getIndexedNode(projectId, {
    kind: "canonical-node",
    nodeId: masterId,
  });
  return master ? findDescendantNode(master.node, target.pathKey) : null;
}

export function resolveEditorPresentationTarget(
  projectId: string,
  selectedElementId: string,
): EditorPresentationTargetRef | null {
  if (!selectedElementId.includes("/")) {
    const target = {
      kind: "canonical-node",
      nodeId: selectedElementId,
    } as const;
    return getEditorPresentationTargetNode(projectId, target) ? target : null;
  }
  const separator = selectedElementId.indexOf("/");
  const refId = selectedElementId.slice(0, separator);
  const pathKey = selectedElementId.slice(separator + 1);
  const target = { kind: "ref-descendant", refId, pathKey } as const;
  return getEditorPresentationTargetNode(projectId, target) ? target : null;
}

function cloneFillItems(fills: readonly FillItem[]): FillItem[] {
  return fills.map((fill) => structuredClone(fill));
}

function cloneCanonicalNode(node: CanonicalNode): CanonicalNode {
  return structuredClone(node);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
  const node = getEditorPresentationTargetNode(projectId, target);
  if (!node) return null;
  if (target.kind === "ref-descendant") {
    const refRoot = getIndexedNode(projectId, {
      kind: "canonical-node",
      nodeId: target.refId,
    })?.node;
    const override = refRoot
      ? getCanonicalRefDescendantOverride(refRoot, target.pathKey)
      : null;
    if (Array.isArray(override?.fills)) {
      return override.fills as FillItem[];
    }
  }
  return Array.isArray(node.fills) ? (node.fills as FillItem[]) : [];
}

function readTargetStyle(
  projectId: string,
  target: EditorPresentationTargetRef,
): Readonly<Record<string, unknown>> | null {
  const node = getEditorPresentationTargetNode(projectId, target);
  if (!node) return null;
  if (target.kind === "ref-descendant") {
    const refRoot = getIndexedNode(projectId, {
      kind: "canonical-node",
      nodeId: target.refId,
    })?.node;
    const override = refRoot
      ? getCanonicalRefDescendantOverride(refRoot, target.pathKey)
      : null;
    if (isRecord(override?.style)) return override.style;
  }
  return isRecord(node.props?.style) ? node.props.style : {};
}

function applyStylePatch(
  baseStyle: Readonly<Record<string, unknown>>,
  patch: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const nextStyle = { ...baseStyle };
  for (const [key, value] of Object.entries(patch)) {
    if (value === "") delete nextStyle[key];
    else nextStyle[key] = value;
  }
  return nextStyle;
}

function areStylePatchValuesEqual(
  patch: Readonly<Record<string, unknown>>,
  baseStyle: unknown,
): boolean {
  if (!isRecord(baseStyle)) return false;
  return Object.entries(patch).every(([key, value]) => {
    const baseValue = baseStyle[key];
    return value === "" ? baseValue === undefined : Object.is(baseValue, value);
  });
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
  if (descriptor.type !== "fills.replace") {
    throw new Error("ADR-187 fill commit allowlist only accepts fills.replace");
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
    ? getDocumentIndex(document).get(
        target.kind === "canonical-node" ? target.nodeId : target.refId,
      )
    : undefined;
  const targetNode = getEditorPresentationTargetNode(input.projectId, target);
  if (!document || !before || !targetNode) {
    throw new Error("Editor presentation canonical target no longer exists");
  }

  const nextFills = cloneFillItems(descriptor.fills);
  const previousFills = Array.isArray(targetNode.fills)
    ? (targetNode.fills as FillItem[])
    : [];
  if (areFillItemsEqual(previousFills, nextFills)) {
    return { committedDocumentRevision: canonical.documentVersion };
  }
  if (!historyManager.getCurrentPageId()) {
    throw new Error(
      "Editor presentation commit requires an active history page",
    );
  }

  const nextNode: CanonicalNode =
    target.kind === "canonical-node"
      ? { ...before.node, fills: nextFills }
      : withCanonicalRefDescendantFills(before.node, target.pathKey, nextFills);
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
        elementId:
          target.kind === "canonical-node" ? target.nodeId : target.refId,
        data: { canonicalEvents: historyEvents },
      });
    },
  });

  return {
    committedDocumentRevision:
      useCanonicalDocumentStore.getState().documentVersion,
  };
}

export function commitEditorPresentationStyle(
  input: EditorPresentationCommitInput,
): EditorPresentationCommitResult {
  const descriptor = input.descriptor;
  const patchKeys = Object.keys(
    descriptor.type === "style.patch" ? descriptor.patch : {},
  );
  const isBorderColorPatch =
    patchKeys.length === 1 &&
    patchKeys[0] === "borderColor" &&
    descriptor.type === "style.patch" &&
    typeof descriptor.patch.borderColor === "string";
  const isBoxShadowPatch =
    patchKeys.length === 1 &&
    patchKeys[0] === "boxShadow" &&
    descriptor.type === "style.patch" &&
    typeof descriptor.patch.boxShadow === "string";
  const isTextColorPatch =
    patchKeys.length === 1 &&
    patchKeys[0] === "color" &&
    descriptor.type === "style.patch" &&
    typeof descriptor.patch.color === "string";
  if (
    descriptor.type !== "style.patch" ||
    (!isBorderColorPatch && !isBoxShadowPatch && !isTextColorPatch)
  ) {
    throw new Error(
      "ADR-187 style commit allowlist only accepts style.patch.borderColor, style.patch.boxShadow, or Text style.patch.color",
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
    ? getDocumentIndex(document).get(
        descriptor.target.kind === "canonical-node"
          ? descriptor.target.nodeId
          : descriptor.target.refId,
      )
    : undefined;
  const targetNode = getEditorPresentationTargetNode(
    input.projectId,
    descriptor.target,
  );
  const previousStyle = readTargetStyle(input.projectId, descriptor.target);
  if (!document || !before || !targetNode || !previousStyle) {
    throw new Error("Editor presentation canonical target no longer exists");
  }
  if (isTextColorPatch && !isTextColorPresentationType(targetNode.type)) {
    throw new Error(
      "ADR-187 Text color presentation target must own a materialized text target",
    );
  }
  if (areStylePatchValuesEqual(descriptor.patch, previousStyle)) {
    return { committedDocumentRevision: canonical.documentVersion };
  }
  if (!historyManager.getCurrentPageId()) {
    throw new Error(
      "Editor presentation commit requires an active history page",
    );
  }

  const nextNode: CanonicalNode =
    descriptor.target.kind === "canonical-node"
      ? {
          ...before.node,
          props: {
            ...(before.node.props ?? {}),
            style: applyStylePatch(previousStyle, descriptor.patch),
          },
        }
      : withCanonicalRefDescendantStylePatch(
          before.node,
          descriptor.target.pathKey,
          descriptor.patch,
        );
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
        elementId:
          descriptor.target.kind === "canonical-node"
            ? descriptor.target.nodeId
            : descriptor.target.refId,
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
  commit: (input) =>
    input.descriptor.type === "fills.replace"
      ? commitEditorPresentationFills(input)
      : commitEditorPresentationStyle(input),
  hasTarget: (projectId, target) =>
    getEditorPresentationTargetNode(projectId, target) !== null,
  isDescriptorEqualToBase: (descriptor, baseValue) =>
    descriptor.type === "fills.replace"
      ? areFillItemsEqual(
          descriptor.fills,
          Array.isArray(baseValue) ? (baseValue as FillItem[]) : [],
        )
      : descriptor.type === "style.patch" &&
        areStylePatchValuesEqual(descriptor.patch, baseValue),
  readDocumentVersion: (projectId) => {
    const state = useCanonicalDocumentStore.getState();
    return state.currentProjectId === projectId ? state.documentVersion : -1;
  },
  readTargetValue: (projectId, target, commitIntent) =>
    commitIntent?.startsWith("style-")
      ? readTargetStyle(projectId, target)
      : readTargetFills(projectId, target),
};

export function isCanonicalFillDescriptor(
  descriptor: EditorMutationDescriptor,
): descriptor is Extract<EditorMutationDescriptor, { type: "fills.replace" }> {
  return (
    descriptor.type === "fills.replace" &&
    descriptor.target.kind === "canonical-node"
  );
}

import type {
  BreakpointName,
  CanonicalNode,
  CompositionDocument,
} from "@composition/shared";

import { runCanonicalMutation } from "@/adapters/canonical/canonicalMutationRunner";
import {
  RESIZE_COMMIT_INTENT,
  commitCanvasResizePresentation,
} from "./editorPresentationResizeSession";
import type { CanonicalMutationResult } from "@/adapters/canonical/canonicalMutations";
import type { FillItem } from "../../types/builder/fill.types";
import { useStore } from "../stores";
import {
  canonicalDocumentToElements,
  canonicalNodeToElement,
  isCanonicalDocumentElementProjection,
  registerCanonicalDocumentElementProjection,
} from "../stores/canonical/canonicalElementsView";
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
import { parsePresentationOpacity } from "./editorPresentationOpacity";
import {
  isFixedTextMetricStyle,
  parsePresentationFontSize,
  parsePresentationFontWeight,
} from "./editorPresentationTextMetricValue";
import {
  getCanonicalRefDescendantOverride,
  getCanonicalRefPathSegment,
  getCanonicalRefTarget,
  withCanonicalRefDescendantFills,
  withCanonicalRefDescendantStylePatch,
} from "../../adapters/canonical/canonicalRefResolution";
import { getFrameElementMirrorId } from "../../adapters/canonical/frameMirror";
import { applyPropsPatch } from "../../adapters/canonical/instanceResolver";
import {
  buildResponsiveStyleOverride,
  shouldWriteBreakpointOverride,
} from "../stores/utils/responsiveWriteRouting";
import { resolveResponsiveStyleMap } from "../workspace/canvas/layout/resolveResponsive";
import {
  hasPresentationSpacingPatch,
  normalizePresentationSpacingPatch,
  normalizePresentationSpacingStyle,
  presentationGapLonghands,
  presentationPaddingLonghands,
} from "./editorPresentationStyleNormalization";

interface IndexedCanonicalNode {
  readonly indexPath: readonly number[];
  readonly node: CanonicalNode;
  readonly parentId: string | null;
  readonly siblingIndex: number;
}

type PresentationStoreElement = NonNullable<
  ReturnType<typeof canonicalNodeToElement>
>;

const indexByDocument = new WeakMap<
  CompositionDocument,
  ReadonlyMap<string, IndexedCanonicalNode>
>();
let documentIndexBuildCount = 0;
let documentIndexReadMissCount = 0;
let incrementalStorePatchCount = 0;
let fullStoreProjectionFallbackCount = 0;
let storeElementIndexBuildCount = 0;
const storeElementIndexByElements = new WeakMap<
  readonly PresentationStoreElement[],
  ReadonlyMap<string, number | null>
>();

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
  readonly fullStoreProjectionFallbackCount: number;
  readonly incrementalStorePatchCount: number;
  readonly storeElementIndexBuildCount: number;
} {
  return Object.freeze({
    documentIndexBuildCount,
    documentIndexReadMissCount,
    fullStoreProjectionFallbackCount,
    incrementalStorePatchCount,
    storeElementIndexBuildCount,
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

/**
 * ADR-229 Phase 0 — 조합 origin 의 자식이 다른 origin 의 ref (Form 안 TextField · Toolbar 안
 * Button) 면 path 는 그 ref 를 지나 nested master 의 자식으로 이어진다. 걸음마다 ref 자식은
 * 자기 origin 으로 열어 (유효 props = origin ⊕ 자식 props — `resolveCanonicalRefElement` 와 같은
 * merge) 계속 내려가고, 끝점이 ref 자식이면 열린 노드를 돌려준다 — base style 을 읽는 쪽이
 * nested master 의 값을 보게. 순환은 유한 종료.
 */
function findDescendantNode(
  root: CanonicalNode,
  pathKey: string,
  lookupNode?: (id: string) => CanonicalNode | null,
): CanonicalNode | null {
  let current: CanonicalNode = root;
  const visitedMasters = new Set<string>();
  // ADR-229 Phase 2: segment (name → id) 자체가 '/' 를 품을 수 있다 (Form seed 의 "TextField/Name") —
  //   '/' 로 쪼개지 않고 남은 path 의 앞부분과 segment 를 통째로 맞춘다 (해소기 · descendants 키와
  //   같은 문자열 규약). 같은 부모 안에서는 긴 segment 부터.
  let remaining = pathKey;
  while (remaining.length > 0) {
    const candidates = (current.children ?? [])
      .map((child) => ({ child, segment: getCanonicalRefPathSegment(child) }))
      .filter(
        ({ segment }) =>
          remaining === segment || remaining.startsWith(`${segment}/`),
      )
      .sort((a, b) => b.segment.length - a.segment.length);
    const match = candidates[0];
    if (!match) return null;
    current = openNestedRefChild(match.child, lookupNode, visitedMasters);
    remaining =
      remaining === match.segment
        ? ""
        : remaining.slice(match.segment.length + 1);
  }
  return current;
}

function openNestedRefChild(
  node: CanonicalNode,
  lookupNode: ((id: string) => CanonicalNode | null) | undefined,
  visitedMasters: Set<string>,
): CanonicalNode {
  if (node.type !== "ref" || !lookupNode) return node;
  const masterId = getCanonicalRefTarget(node);
  if (!masterId || visitedMasters.has(masterId)) return node;
  const master = lookupNode(masterId);
  if (!master || master.type === "ref") return node;
  visitedMasters.add(masterId);
  return {
    ...master,
    id: node.id,
    props: applyPropsPatch(master.props ?? {}, node.props ?? {}),
    reusable: undefined,
  } as CanonicalNode;
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
  return master
    ? findDescendantNode(
        master.node,
        target.pathKey,
        (id) =>
          getIndexedNode(projectId, { kind: "canonical-node", nodeId: id })
            ?.node ?? null,
      )
    : null;
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

function withoutFillDerivedStyle(node: CanonicalNode): CanonicalNode {
  const style = node.props?.style;
  if (!isRecord(style)) return node;
  const nextStyle = { ...style };
  delete nextStyle.backgroundColor;
  delete nextStyle.backgroundImage;
  delete nextStyle.backgroundSize;
  return {
    ...node,
    props: {
      ...(node.props ?? {}),
      style: nextStyle,
    },
  };
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

/**
 * layout intent (width/height · spacing) 의 base 값 — activeBreakpoint 로 resolve 한
 * effective style (base ⊕ responsive cascade). Inspector 가 보는 값과 같아야 "base 와
 * 같음 → no-op" 판정과 conflict 감지가 비-desktop 에서도 맞는다 (ADR-222 §1.1 확장 —
 * mobile 에서 base 16 · mobile override 24 인 노드를 16 으로 끌면 override 를 16 으로
 * 써야 하지 base 와 같다고 건너뛰면 안 된다). desktop 은 base identity 그대로.
 */
function readTargetLayoutStyle(
  projectId: string,
  target: EditorPresentationTargetRef,
): Readonly<Record<string, unknown>> | null {
  const base = readTargetStyle(projectId, target);
  if (!base || target.kind !== "canonical-node") return base;
  const node = getEditorPresentationTargetNode(projectId, target);
  return resolveResponsiveStyleMap(
    base as Record<string, unknown>,
    node?.responsive,
    useStore.getState().activeBreakpoint,
  );
}

function isLayoutCommitIntent(commitIntent: string | undefined): boolean {
  return commitIntent?.startsWith("style-layout-") === true;
}

function applyStylePatch(
  baseStyle: Readonly<Record<string, unknown>>,
  patch: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const hasSpacing = hasPresentationSpacingPatch(patch);
  const nextStyle = hasSpacing
    ? normalizePresentationSpacingStyle(baseStyle)
    : { ...baseStyle };
  const normalizedPatch = hasSpacing
    ? normalizePresentationSpacingPatch(patch)
    : patch;
  for (const [key, value] of Object.entries(normalizedPatch)) {
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
  const hasSpacing = hasPresentationSpacingPatch(patch);
  const normalizedPatch = hasSpacing
    ? normalizePresentationSpacingPatch(patch)
    : patch;
  const normalizedBaseStyle = hasSpacing
    ? normalizePresentationSpacingStyle(baseStyle)
    : baseStyle;
  return Object.entries(normalizedPatch).every(([key, value]) => {
    const baseValue = normalizedBaseStyle[key];
    if (value === "") return baseValue === undefined;
    if (Object.is(baseValue, value)) return true;
    // Inspector 는 spacing 을 숫자로, presentation 은 "Npx" 로 저장한다 — 같은 px 면 같은 값.
    return (
      hasSpacing &&
      typeof baseValue === "number" &&
      typeof value === "string" &&
      /^\s*(\d+(?:\.\d+)?)px\s*$/.test(value) &&
      Number.parseFloat(value) === baseValue
    );
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

function getStoreElementIndex(
  elements: readonly PresentationStoreElement[],
): ReadonlyMap<string, number | null> {
  const cached = storeElementIndexByElements.get(elements);
  if (cached) return cached;

  storeElementIndexBuildCount += 1;
  const index = new Map<string, number | null>();
  elements.forEach((element, elementIndex) => {
    index.set(element.id, index.has(element.id) ? null : elementIndex);
  });
  storeElementIndexByElements.set(elements, index);
  return index;
}

function syncPresentationStoreMirror(
  previousDocument: CompositionDocument,
  nextDocument: CompositionDocument,
  before: IndexedCanonicalNode,
  nextNode: CanonicalNode,
): void {
  useStore.setState((state) => {
    const fallbackToFullProjection = (): {
      elements: ReturnType<typeof canonicalDocumentToElements>;
      layoutVersion: number;
    } => {
      fullStoreProjectionFallbackCount += 1;
      return {
        elements: canonicalDocumentToElements(nextDocument),
        layoutVersion: state.layoutVersion + 1,
      };
    };

    if (
      !isCanonicalDocumentElementProjection(state.elements, previousDocument)
    ) {
      return fallbackToFullProjection();
    }

    const targetId = before.node.id;
    if (!state.elementsMap.has(targetId)) {
      return fallbackToFullProjection();
    }
    const elementIndex = getStoreElementIndex(state.elements);
    const targetIndex = elementIndex.get(targetId);
    // null 은 duplicate-id 표식이다. 기존 last-match 전체 projection 의미를
    // 보존하려고 증분 치환을 닫는다.
    if (typeof targetIndex !== "number") return fallbackToFullProjection();

    const currentElement = state.elements[targetIndex];
    if (!currentElement) return fallbackToFullProjection();
    const nextElement = canonicalNodeToElement(
      nextNode,
      currentElement.parent_id ?? null,
      {
        pageId: currentElement.page_id ?? null,
        layoutId: getFrameElementMirrorId(currentElement),
      },
    );
    if (!nextElement) return fallbackToFullProjection();

    incrementalStorePatchCount += 1;
    const elements = [...state.elements];
    elements[targetIndex] = nextElement;
    storeElementIndexByElements.set(elements, elementIndex);
    registerCanonicalDocumentElementProjection(elements, nextDocument);
    return {
      elements,
      layoutVersion: state.layoutVersion + 1,
    };
  });
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

  const nodeWithFills: CanonicalNode =
    target.kind === "canonical-node"
      ? { ...before.node, fills: nextFills }
      : withCanonicalRefDescendantFills(before.node, target.pathKey, nextFills);
  const nextNode =
    target.kind === "canonical-node" && previousFills.length === 0
      ? withoutFillDerivedStyle(nodeWithFills)
      : nodeWithFills;
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
      syncPresentationStoreMirror(document, nextDocument, before, nextNode);
    },
    indexSource: "store",
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
  const descriptor =
    input.descriptor.type === "style.patch"
      ? {
          ...input.descriptor,
          patch: normalizePresentationSpacingPatch(input.descriptor.patch),
        }
      : input.descriptor;
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
  const isOpacityPatch =
    patchKeys.length === 1 &&
    patchKeys[0] === "opacity" &&
    descriptor.type === "style.patch" &&
    parsePresentationOpacity(descriptor.patch.opacity) !== null;
  const spacingKeys = [
    ...presentationGapLonghands,
    ...presentationPaddingLonghands,
  ];
  const isGapLonghand = (key: string): boolean =>
    (presentationGapLonghands as readonly string[]).includes(key);
  const isPaddingLonghand = (key: string): boolean =>
    (presentationPaddingLonghands as readonly string[]).includes(key);
  // 한 축 그룹 안의 longhand 부분집합은 원자 patch 로 허용한다 — ADR-222 §1.1
  // Option/Alt 양쪽 padding (2변) 이 commit 1회여야 한다. gap 과 padding 을
  // 한 patch 에 섞는 것은 여전히 거부한다.
  const isSpacingPatch =
    descriptor.type === "style.patch" &&
    patchKeys.length >= 1 &&
    patchKeys.every((key) =>
      (spacingKeys as readonly string[]).some((candidate) => candidate === key),
    ) &&
    (patchKeys.every(isGapLonghand) || patchKeys.every(isPaddingLonghand));
  const isLayoutPatch =
    descriptor.type === "style.patch" &&
    ((patchKeys.length === 1 &&
      ["width", "height"].includes(patchKeys[0] ?? "")) ||
      isSpacingPatch) &&
    patchKeys.every(
      (key) =>
        typeof descriptor.patch[key] === "string" &&
        /^\s*(\d+(?:\.\d+)?)px\s*$/.test(descriptor.patch[key] as string),
    );
  const isTextMetricPatch =
    patchKeys.length === 1 &&
    descriptor.type === "style.patch" &&
    ((patchKeys[0] === "fontSize" &&
      parsePresentationFontSize(descriptor.patch.fontSize) !== null) ||
      (patchKeys[0] === "fontWeight" &&
        parsePresentationFontWeight(descriptor.patch.fontWeight) !== null));
  if (
    descriptor.type !== "style.patch" ||
    (!isBorderColorPatch &&
      !isBoxShadowPatch &&
      !isTextColorPatch &&
      !isOpacityPatch &&
      !isLayoutPatch &&
      !isTextMetricPatch)
  ) {
    throw new Error(
      "ADR-187 style commit allowlist only accepts borderColor, boxShadow, Text color, opacity, scoped layout width/height/spacing, or fixed Text fontSize/fontWeight patches",
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
      "ADR-187 text color presentation target must own a materialized text target",
    );
  }
  if (
    isTextMetricPatch &&
    (descriptor.target.kind !== "canonical-node" ||
      targetNode.type !== "Text" ||
      (targetNode.children?.length ?? 0) > 0 ||
      !isFixedTextMetricStyle(previousStyle) ||
      (patchKeys[0] === "fontWeight" &&
        parsePresentationFontWeight(previousStyle.fontWeight) === null))
  ) {
    throw new Error(
      "ADR-187 text metric presentation target must be a fixed standalone Text leaf",
    );
  }
  // ADR-222 §1.1 확장 — 비-desktop breakpoint 의 layout patch 는 Inspector write 3함수와
  // 같은 판정 (shouldWriteBreakpointOverride: eligible + 해당 tier 토글 ON) 으로 키마다
  // tier override / base 를 가른다. 토글 OFF 면 base (전역) — ADR-154 개정 1 기본 모델.
  const activeBreakpoint: BreakpointName = useStore.getState().activeBreakpoint;
  const overridePatch: Record<string, unknown> = {};
  const basePatch: Record<string, unknown> = {};
  if (isLayoutPatch && descriptor.target.kind === "canonical-node") {
    for (const [key, value] of Object.entries(descriptor.patch)) {
      if (
        shouldWriteBreakpointOverride(
          before.node.responsive,
          key,
          activeBreakpoint,
        )
      ) {
        overridePatch[key] = value;
      } else {
        basePatch[key] = value;
      }
    }
  } else {
    Object.assign(basePatch, descriptor.patch);
  }
  const effectiveStyle =
    Object.keys(overridePatch).length > 0
      ? (readTargetLayoutStyle(input.projectId, descriptor.target) ??
        previousStyle)
      : previousStyle;
  if (
    areStylePatchValuesEqual(basePatch, previousStyle) &&
    areStylePatchValuesEqual(overridePatch, effectiveStyle)
  ) {
    return { committedDocumentRevision: canonical.documentVersion };
  }
  if (!historyManager.getCurrentPageId()) {
    throw new Error(
      "Editor presentation commit requires an active history page",
    );
  }

  let nextResponsive = before.node.responsive;
  for (const [key, value] of Object.entries(overridePatch)) {
    nextResponsive = buildResponsiveStyleOverride(
      nextResponsive,
      key,
      String(value),
      activeBreakpoint,
    );
  }
  const nextNode: CanonicalNode =
    descriptor.target.kind === "canonical-node"
      ? {
          ...before.node,
          props: {
            ...(before.node.props ?? {}),
            style:
              Object.keys(basePatch).length > 0
                ? applyStylePatch(previousStyle, basePatch)
                : (before.node.props?.style ?? {}),
          },
          ...(nextResponsive !== before.node.responsive
            ? { responsive: nextResponsive }
            : {}),
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
      syncPresentationStoreMirror(document, nextDocument, before, nextNode);
    },
    indexSource: "store",
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
      : input.commitIntent === RESIZE_COMMIT_INTENT
        ? // ADR-224 캔버스 resize — marker 축 Fill 해제 + CSS px 는 store 명령 한 경로
          commitCanvasResizePresentation(input)
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
    isLayoutCommitIntent(commitIntent)
      ? readTargetLayoutStyle(projectId, target)
      : commitIntent?.startsWith("style-")
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

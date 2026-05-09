/**
 * @fileoverview ADR-116 Phase 3 G4 — Canonical mutation wrapper (mutation reverse 진정 진입점).
 *
 * caller 가 legacy `setElements` / `mergeElements` 직접 호출 대신 본 wrapper 를
 * 경유. design §8.6 grep gate 의 단일 SSOT 격리 (D18=A) 정합.
 *
 * **2026-05-02 direct cutover**:
 *
 * in-memory wrapper (merge/set) 가 항상 canonical primary 로 동작한다.
 * (1) active canonical document 또는 snapshot shell 에 입력 elements upsert →
 * (2) canonical store `setDocument` push.
 *
 * ADR-122 Phase 1: wrapper 내부의 legacy export 후 `setElements` write-back 은
 * 제거한다. legacy `elementsMap` 호환 cache 가 transition 중
 * 필요하면 canonical store subscriber 가 derived read-only snapshot 으로 갱신한다.
 *   DB wrapper (create/update/createMultiple) 는 reverse 영향 없음 — DB persist
 *   자체는 elementsApi 그대로 사용 (D17=A 채택, schema 미변경).
 *
 * **무한 루프 방지**: `canonicalDocumentSync` 는 direct cutover 이후 legacy
 * store subscribe/projection 을 수행하지 않는다. wrapper 가 canonical store 와
 * legacy mirror 를 같은 호출에서 갱신하므로 재호출 루프가 없다.
 *
 * **파일 위치 의도**: `apps/builder/src/adapters/canonical/` 안에 둠 → design
 * §8.6 grep gate 의 `apps/builder/src/adapters/**` exclude 패턴 안에 들어가서
 * grep gate 의 violation 카운트에서 자동 제외. caller 변환 1개당 baseline 1
 * 감소.
 *
 * **Circular dependency 해소 (DI pattern)**:
 * elements.ts → canonicalMutations.ts → stores/index → elements.ts 의 ESM
 * circular import chain 을 callback registration 으로 차단. BuilderCore mount
 * 시점에 `registerCanonicalMutationStoreActions` 로 store action 주입.
 * 테스트 환경에서는 `vi.mock` 또는 `registerCanonicalMutationStoreActions` 로
 * mock action 주입 가능.
 */

import type { Element } from "@/types/builder/unified.types";
import type { Page, Layout } from "@/types/builder/unified.types";
import type {
  CanonicalNode,
  CanonicalParentId,
  CompositionDocument,
  CompositionExtension,
  FrameNode,
  RefNode,
  SerializedDataBinding,
  SerializedEventHandler,
} from "@composition/shared";
import { moveCanonicalChild } from "@composition/shared";
import { elementsApi } from "./legacyElementsApiService";
import { useCanonicalDocumentStore } from "../../builder/stores/canonical/canonicalDocumentStore";
import {
  buildLegacyElementMetadata,
  readLegacyElementPositionMetadata,
} from "./legacyMetadata";
import { getCanonicalSlotDeclaration } from "./slotDeclaration";
import { isLegacySlotTag, tagToType } from "./tagRename";
import { getPageFrameBindingId } from "./frameMirror";
import { asElementWithLegacyMirror } from "./legacyElementFields";
import {
  compareElementsBySource,
  createElementSourceIndex,
} from "../../builder/utils/elementOrdering";

type CanonicalRefElementFields = {
  ref?: unknown;
};

// ─────────────────────────────────────────────
// Callback registration (DI pattern)
// ─────────────────────────────────────────────

/**
 * canonical primary reverse path 에 필요한 legacy snapshot 형태.
 */
export type LegacySnapshot = {
  elements: Element[];
  pages: Page[];
  layouts: Layout[];
};

/**
 * store action 타입 — wrapper 가 호출하는 최소 action 집합.
 * useStore 전체 타입 의존을 피해 circular import chain 차단.
 *
 * **2026-05-02 §8.7 확장**: canonical primary reverse path 용 3 callback 추가
 * (`getCurrentLegacySnapshot` / `getCurrentProjectId`).
 */
export type CanonicalMutationStoreActions = {
  /** canonical primary path: 현재 legacy state 전체 snapshot 조회 */
  getCurrentLegacySnapshot: () => LegacySnapshot;
  /** canonical primary path: 활성 projectId (canonical store setDocument target) */
  getCurrentProjectId: () => string | null;
};

export type CanonicalMutationResult = {
  changed: boolean;
  document: CompositionDocument | null;
};

let _registeredActions: CanonicalMutationStoreActions | null = null;

/**
 * BuilderCore (또는 테스트 setup) 에서 store action 을 주입한다.
 * mount useEffect 에서 1회 호출.
 *
 * @example
 * // BuilderCore.tsx
 * useEffect(() => {
 *   registerCanonicalMutationStoreActions({
 *     getCurrentLegacySnapshot: () => ({
 *       elements: Array.from(useStore.getState().elementsMap.values()),
 *       pages: useStore.getState().pages,
 *       layouts: getCanonicalReusableFrameLayouts(),
 *     }),
 *     getCurrentProjectId: () => projectId ?? null,
 *   });
 * }, [projectId]);
 */
export function registerCanonicalMutationStoreActions(
  actions: CanonicalMutationStoreActions,
): void {
  _registeredActions = actions;
}

/**
 * 테스트 / 모듈 재로드 후 등록된 action 을 초기화한다.
 * afterEach 에서 호출 가능 (선택적).
 */
export function resetCanonicalMutationStoreActions(): void {
  _registeredActions = null;
}

export function areCanonicalMutationStoreActionsRegistered(): boolean {
  return _registeredActions !== null;
}

function getActions(): CanonicalMutationStoreActions {
  if (!_registeredActions) {
    throw new Error(
      "[canonicalMutations] store actions not registered. " +
        "Call registerCanonicalMutationStoreActions() before using mutation wrappers.",
    );
  }
  return _registeredActions;
}

function getCurrentDocument(projectId: string | null): CompositionDocument {
  return (
    (projectId
      ? useCanonicalDocumentStore.getState().getDocument(projectId)
      : null) ?? {
      version: "composition-1.0",
      children: [],
    }
  );
}

function sortElementsForUpsert(elements: Element[]): Element[] {
  const byId = new Map(elements.map((element) => [element.id, element]));
  const sourceIndexById = createElementSourceIndex(elements);
  const depthCache = new Map<string, number>();

  const getDepth = (element: Element): number => {
    const cached = depthCache.get(element.id);
    if (cached !== undefined) return cached;
    const parent =
      element.parent_id !== null && element.parent_id !== undefined
        ? byId.get(element.parent_id)
        : undefined;
    const depth = parent ? getDepth(parent) + 1 : 0;
    depthCache.set(element.id, depth);
    return depth;
  };

  return [...elements].sort((a, b) => {
    const ownerPriority = (element: Element): number => {
      if (element.layout_id) return 0;
      if (element.page_id) return 1;
      return 2;
    };
    const ownerDiff = ownerPriority(a) - ownerPriority(b);
    if (ownerDiff !== 0) return ownerDiff;
    const depthDiff = getDepth(a) - getDepth(b);
    if (depthDiff !== 0) return depthDiff;
    return compareElementsBySource(a, b, sourceIndexById);
  });
}

function nodeMatchesId(node: CanonicalNode, elementId: string): boolean {
  return node.id === elementId;
}

function findNodeById(
  nodes: CanonicalNode[],
  elementId: string | null | undefined,
): CanonicalNode | null {
  if (!elementId) return null;
  for (const node of nodes) {
    if (nodeMatchesId(node, elementId)) return node;
    const child = findNodeById(node.children ?? [], elementId);
    if (child) return child;
    if (node.type === "ref") {
      for (const children of getDescendantChildrenArrays(node as RefNode)) {
        const descendantChild = findNodeById(children, elementId);
        if (descendantChild) return descendantChild;
      }
    }
  }
  return null;
}

function sortCanonicalChildren(children: CanonicalNode[]): CanonicalNode[] {
  return [...children];
}

function removeNodeById(
  nodes: CanonicalNode[],
  elementId: string,
): { nodes: CanonicalNode[]; removed: CanonicalNode | null } {
  let removed: CanonicalNode | null = null;
  const nextNodes: CanonicalNode[] = [];

  for (const node of nodes) {
    if (nodeMatchesId(node, elementId)) {
      removed = node;
      continue;
    }

    let nextNode = node;
    const childResult = removeNodeById(node.children ?? [], elementId);
    if (childResult.removed) {
      removed = childResult.removed;
      nextNode = { ...nextNode, children: childResult.nodes };
    }

    if (nextNode.type === "ref") {
      const descendantResult = removeNodeFromDescendants(
        nextNode as RefNode,
        elementId,
      );
      if (descendantResult.removed) {
        removed = descendantResult.removed;
        nextNode = descendantResult.node;
      }
    }

    if (nextNode !== node) {
      nextNodes.push(nextNode);
      continue;
    }
    nextNodes.push(node);
  }

  return { nodes: nextNodes, removed };
}

function getDescendantChildrenArrays(refNode: RefNode): CanonicalNode[][] {
  const descendants = refNode.descendants ?? {};
  const children: CanonicalNode[][] = [];
  for (const override of Object.values(descendants)) {
    if (
      override &&
      typeof override === "object" &&
      "children" in override &&
      Array.isArray(override.children)
    ) {
      children.push(override.children);
    }
  }
  return children;
}

function removeNodeFromDescendants(
  refNode: RefNode,
  elementId: string,
): { node: RefNode; removed: CanonicalNode | null } {
  const descendants = refNode.descendants ?? {};
  let removed: CanonicalNode | null = null;
  let changed = false;
  const nextDescendants: RefNode["descendants"] = {};

  for (const [path, override] of Object.entries(descendants)) {
    if (
      override &&
      typeof override === "object" &&
      "children" in override &&
      Array.isArray(override.children)
    ) {
      const result = removeNodeById(override.children, elementId);
      if (result.removed) {
        removed = result.removed;
        changed = true;
      }
      nextDescendants[path] = {
        ...override,
        children: result.nodes,
      };
      continue;
    }
    nextDescendants[path] = override;
  }

  return changed
    ? { node: { ...refNode, descendants: nextDescendants }, removed }
    : { node: refNode, removed: null };
}

function upsertChild(
  children: CanonicalNode[] | undefined,
  child: CanonicalNode,
): CanonicalNode[] {
  const currentChildren = children ?? [];
  const existingIndex = currentChildren.findIndex(
    (node) => node.id === child.id,
  );
  if (existingIndex !== -1) {
    const nextChildren = [...currentChildren];
    nextChildren[existingIndex] = child;
    return sortCanonicalChildren(nextChildren);
  }
  return sortCanonicalChildren([...currentChildren, child]);
}

function replaceNodeById(
  nodes: CanonicalNode[],
  elementId: string,
  replacement: CanonicalNode,
): { nodes: CanonicalNode[]; replaced: boolean } {
  let replaced = false;
  const nextNodes = nodes.map((node) => {
    if (nodeMatchesId(node, elementId)) {
      replaced = true;
      return replacement;
    }

    let nextNode = node;
    const childResult = replaceNodeById(
      node.children ?? [],
      elementId,
      replacement,
    );
    if (childResult.replaced) {
      replaced = true;
      nextNode = { ...nextNode, children: childResult.nodes };
    }

    if (nextNode.type === "ref") {
      const descendantResult = replaceNodeInDescendants(
        nextNode as RefNode,
        elementId,
        replacement,
      );
      if (descendantResult.replaced) {
        replaced = true;
        nextNode = descendantResult.node;
      }
    }

    return nextNode;
  });

  return { nodes: nextNodes, replaced };
}

function replaceNodeInDescendants(
  refNode: RefNode,
  elementId: string,
  replacement: CanonicalNode,
): { node: RefNode; replaced: boolean } {
  const descendants = refNode.descendants ?? {};
  let replaced = false;
  const nextDescendants: RefNode["descendants"] = {};

  for (const [path, override] of Object.entries(descendants)) {
    if (
      override &&
      typeof override === "object" &&
      "children" in override &&
      Array.isArray(override.children)
    ) {
      const result = replaceNodeById(override.children, elementId, replacement);
      if (result.replaced) {
        replaced = true;
        nextDescendants[path] = {
          ...override,
          children: result.nodes,
        };
        continue;
      }
    }
    nextDescendants[path] = override;
  }

  return replaced
    ? { node: { ...refNode, descendants: nextDescendants }, replaced }
    : { node: refNode, replaced: false };
}

function appendChildToNode(
  nodes: CanonicalNode[],
  parentElementId: string,
  child: CanonicalNode,
): { nodes: CanonicalNode[]; inserted: boolean } {
  let inserted = false;
  const nextNodes = nodes.map((node) => {
    if (nodeMatchesId(node, parentElementId)) {
      inserted = true;
      return {
        ...node,
        children: upsertChild(node.children, child),
      };
    }

    let nextNode = node;
    const childResult = appendChildToNode(
      node.children ?? [],
      parentElementId,
      child,
    );
    if (childResult.inserted) {
      inserted = true;
      nextNode = { ...nextNode, children: childResult.nodes };
    }

    if (nextNode.type === "ref") {
      const descendantResult = appendChildToDescendants(
        nextNode as RefNode,
        parentElementId,
        child,
      );
      if (descendantResult.inserted) {
        inserted = true;
        nextNode = descendantResult.node;
      }
    }

    return nextNode;
  });

  return { nodes: nextNodes, inserted };
}

function appendChildToDescendants(
  refNode: RefNode,
  parentElementId: string,
  child: CanonicalNode,
): { node: RefNode; inserted: boolean } {
  const descendants = refNode.descendants ?? {};
  let inserted = false;
  const nextDescendants: RefNode["descendants"] = {};

  for (const [path, override] of Object.entries(descendants)) {
    if (
      override &&
      typeof override === "object" &&
      "children" in override &&
      Array.isArray(override.children)
    ) {
      const result = appendChildToNode(
        override.children,
        parentElementId,
        child,
      );
      if (result.inserted) {
        inserted = true;
        nextDescendants[path] = {
          ...override,
          children: result.nodes,
        };
        continue;
      }
    }
    nextDescendants[path] = override;
  }

  return inserted
    ? { node: { ...refNode, descendants: nextDescendants }, inserted }
    : { node: refNode, inserted: false };
}

function buildCompositionExtensionField(element: Element): {
  "x-composition"?: CompositionExtension;
} {
  const ext: CompositionExtension = {};
  if (Array.isArray(element.events) && element.events.length > 0) {
    ext.events = element.events as SerializedEventHandler[];
  }
  if (element.dataBinding !== undefined && element.dataBinding !== null) {
    ext.dataBinding = element.dataBinding as SerializedDataBinding;
  }
  return ext.events === undefined && ext.dataBinding === undefined
    ? {}
    : { "x-composition": ext };
}

function remapLegacyDescendants(
  element: Element,
  doc: CompositionDocument,
): RefNode["descendants"] | undefined {
  const legacyDescendants = asElementWithLegacyMirror(element).descendants;
  if (!legacyDescendants || Object.keys(legacyDescendants).length === 0) {
    return undefined;
  }

  const remapped: RefNode["descendants"] = {};
  for (const [legacyChildId, override] of Object.entries(legacyDescendants)) {
    const childNode = findNodeById(doc.children, legacyChildId);
    remapped[childNode?.id ?? legacyChildId] = override;
  }
  return remapped;
}

function getCanonicalRefTarget(element: Element): string | null {
  const ref = (element as Element & CanonicalRefElementFields).ref;
  return typeof ref === "string" && ref.length > 0 ? ref : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function canonicalPropValueEquals(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  return JSON.stringify(left) === JSON.stringify(right);
}

function diffStylePropsAgainstMaster(
  masterStyle: unknown,
  instanceStyle: unknown,
): Record<string, unknown> | undefined {
  if (!isRecord(instanceStyle)) return undefined;
  const masterStyleRecord = isRecord(masterStyle) ? masterStyle : {};
  const styleOverrides: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(instanceStyle)) {
    if (!canonicalPropValueEquals(masterStyleRecord[key], value)) {
      styleOverrides[key] = value;
    }
  }

  return Object.keys(styleOverrides).length > 0 ? styleOverrides : undefined;
}

function diffRefPropsAgainstMaster(
  masterNode: CanonicalNode | null,
  refProps: Record<string, unknown>,
): Record<string, unknown> {
  if (!masterNode?.props) return refProps;

  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(refProps)) {
    if (key === "style") {
      const styleOverride = diffStylePropsAgainstMaster(
        masterNode.props.style,
        value,
      );
      if (styleOverride) props.style = styleOverride;
      continue;
    }

    if (!canonicalPropValueEquals(masterNode.props[key], value)) {
      props[key] = value;
    }
  }

  return props;
}

function legacyElementToCanonicalNode(
  element: Element,
  doc: CompositionDocument,
  previousNode: CanonicalNode | null,
): CanonicalNode {
  const legacy = asElementWithLegacyMirror(element);
  const isReusableOrigin =
    legacy.componentRole === "master" ||
    (element as Element & { reusable?: boolean }).reusable === true;
  const refTarget =
    legacy.componentRole === "instance" && legacy.masterId
      ? legacy.masterId
      : getCanonicalRefTarget(element);

  if (isLegacySlotTag(element.type)) {
    const slotName =
      (element.props.name as string | undefined) ?? element.slot_name ?? null;
    if (element.layout_id) {
      return {
        id: previousNode?.id ?? element.id,
        type: "frame",
        placeholder: true,
        slot: [],
        name: slotName ?? "content",
        props: {
          ...((element.props as Record<string, unknown> | undefined) ?? {}),
          name: slotName ?? "content",
        },
        metadata: {
          type: "legacy-slot-hoisted",
          slotName: slotName ?? "content",
        },
        children: [],
      };
    }

    return {
      id: previousNode?.id ?? element.id,
      type: "frame",
      name: element.componentName,
      ...(previousNode?.children ? { children: previousNode.children } : {}),
      metadata: {
        type: "legacy-slot",
        slot_name: element.slot_name,
        ...(slotName ? { slotName } : {}),
      },
    };
  }

  const metadataElement = isReusableOrigin
    ? ({
        ...element,
        componentRole: "master",
      } as Element)
    : refTarget
      ? ({
          ...element,
          componentRole: "instance",
          masterId: refTarget,
          overrides: legacy.overrides ?? element.props,
        } as Element)
      : element;
  const baseNode: CanonicalNode = {
    id: previousNode?.id ?? element.id,
    type: tagToType(element.type),
    name: element.componentName,
    props: element.props as Record<string, unknown>,
    ...(previousNode?.children ? { children: previousNode.children } : {}),
    ...getCanonicalSlotDeclaration(element),
    metadata: buildLegacyElementMetadata(metadataElement),
    ...buildCompositionExtensionField(element),
  };

  if (isReusableOrigin) {
    return {
      ...baseNode,
      reusable: true,
    };
  }

  if (refTarget) {
    const masterNode = findNodeById(doc.children, refTarget);
    const descendants = remapLegacyDescendants(element, doc);
    const refProps = legacy.overrides
      ? legacy.overrides
      : diffRefPropsAgainstMaster(
          masterNode,
          element.props as Record<string, unknown>,
        );
    const refNode: RefNode = {
      ...baseNode,
      type: "ref",
      ref: masterNode?.id ?? refTarget,
      props: refProps,
      metadata: buildLegacyElementMetadata({
        ...metadataElement,
        overrides: refProps,
      } as Element),
      ...(descendants ? { descendants } : {}),
    };
    return refNode;
  }

  return baseNode;
}

function cloneCanonicalNodeForHistory(node: CanonicalNode): CanonicalNode {
  if (typeof structuredClone === "function") {
    return structuredClone(node) as CanonicalNode;
  }
  return JSON.parse(JSON.stringify(node)) as CanonicalNode;
}

function getCurrentDocumentForHistory(): CompositionDocument {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId =
    _registeredActions?.getCurrentProjectId() ?? canonical.currentProjectId;
  return getCurrentDocument(projectId);
}

export function createCanonicalHistoryNodeFromElement(
  element: Element,
): CanonicalNode {
  const doc = getCurrentDocumentForHistory();
  const previousNode = findNodeById(doc.children, element.id);
  return cloneCanonicalNodeForHistory(
    legacyElementToCanonicalNode(element, doc, previousNode),
  );
}

export function getCanonicalHistoryNodeSnapshot(
  element: Element,
): CanonicalNode {
  const doc = getCurrentDocumentForHistory();
  const node = findNodeById(doc.children, element.id);
  if (node) return cloneCanonicalNodeForHistory(node);
  return createCanonicalHistoryNodeFromElement(element);
}

function findReusableFrame(
  doc: CompositionDocument,
  layoutId: string,
): FrameNode | null {
  return (
    doc.children.find((node): node is FrameNode => {
      const metadata = node.metadata as { layoutId?: unknown } | undefined;
      return (
        node.type === "frame" &&
        node.reusable === true &&
        (node.id === layoutId ||
          node.id === `layout-${layoutId}` ||
          metadata?.layoutId === layoutId)
      );
    }) ?? null
  );
}

function ensureReusableFrame(
  doc: CompositionDocument,
  layoutId: string,
  snapshot: LegacySnapshot,
): { doc: CompositionDocument; frame: FrameNode } {
  const existingFrame = findReusableFrame(doc, layoutId);
  if (existingFrame) return { doc, frame: existingFrame };

  const layout = snapshot.layouts.find(
    (candidate) => candidate.id === layoutId,
  );
  const frame: FrameNode = {
    id: `layout-${layoutId}`,
    type: "frame",
    reusable: true,
    name: layout?.name ?? layoutId,
    metadata: {
      type: "legacy-layout",
      layoutId,
    },
    children: [],
  };
  return {
    doc: { ...doc, children: [...doc.children, frame] },
    frame,
  };
}

function findPageNode(
  doc: CompositionDocument,
  pageId: string,
): CanonicalNode | null {
  return (
    doc.children.find((node) => {
      const metadata = node.metadata as { type?: unknown; pageId?: unknown };
      return (
        node.id === pageId &&
        metadata?.type === "legacy-page" &&
        metadata.pageId === pageId
      );
    }) ?? null
  );
}

function ensurePageNode(
  doc: CompositionDocument,
  pageId: string,
  snapshot: LegacySnapshot,
): { doc: CompositionDocument; pageNode: CanonicalNode } {
  const existingPage = findPageNode(doc, pageId);
  if (existingPage) return { doc, pageNode: existingPage };

  const page = snapshot.pages.find((candidate) => candidate.id === pageId);
  const pageNode: FrameNode = {
    id: pageId,
    type: "frame",
    name: page?.title ?? pageId,
    metadata: {
      type: "legacy-page",
      pageId,
      slug: page?.slug ?? null,
      parent_id: page?.parent_id ?? null,
    },
    children: [],
  };
  return {
    doc: { ...doc, children: [...doc.children, pageNode] },
    pageNode,
  };
}

function buildFrameShell(
  layout: Layout,
  currentDoc: CompositionDocument,
): FrameNode {
  const existingFrame = findReusableFrame(currentDoc, layout.id);
  const metadata: FrameNode["metadata"] = {
    ...(existingFrame?.metadata ?? {}),
    type: "legacy-layout",
    layoutId: layout.id,
    project_id: layout.project_id,
    description: layout.description ?? null,
    slug: layout.slug ?? null,
  };
  delete (metadata as Record<string, unknown>).order_num;

  return {
    id: existingFrame?.id ?? `layout-${layout.id}`,
    type: "frame",
    reusable: true,
    name: layout.name,
    metadata,
    slot: existingFrame?.slot,
    children: [],
  };
}

function buildPageShell(
  page: Page,
  currentDoc: CompositionDocument,
): CanonicalNode {
  const existingPage = findPageNode(currentDoc, page.id);
  const frameId = getPageFrameBindingId(page);
  const metadata = {
    ...(existingPage?.metadata ?? {}),
    type: "legacy-page",
    pageId: page.id,
    slug: page.slug ?? null,
    parent_id: page.parent_id ?? null,
  };
  delete (metadata as Record<string, unknown>).order_num;

  if (frameId) {
    return {
      id: existingPage?.id ?? page.id,
      type: "ref",
      ref: `layout-${frameId}`,
      name: page.title,
      metadata: {
        ...metadata,
        layoutId: frameId,
      },
      descendants: {},
    } satisfies RefNode;
  }

  const frameMetadata = {
    ...metadata,
  } as typeof metadata & { layoutId?: unknown };
  delete frameMetadata.layoutId;

  const children =
    existingPage?.type === "ref"
      ? getDescendantChildrenArrays(existingPage as RefNode).flat()
      : (existingPage?.children ?? []);

  return {
    id: existingPage?.id ?? page.id,
    type: "frame",
    name: page.title,
    metadata: frameMetadata,
    ...(children.length > 0 ? { children } : {}),
  } satisfies FrameNode;
}

function buildDocumentShellFromSnapshot(
  currentDoc: CompositionDocument,
  snapshot: LegacySnapshot,
): CompositionDocument {
  return {
    ...currentDoc,
    children: [
      ...snapshot.layouts.map((layout) => buildFrameShell(layout, currentDoc)),
      ...snapshot.pages.map((page) => buildPageShell(page, currentDoc)),
    ],
  };
}

function attachChildToFrame(
  doc: CompositionDocument,
  frame: FrameNode,
  child: CanonicalNode,
): CompositionDocument {
  const result = appendChildToNode(doc.children, frame.id, child);
  return result.inserted ? { ...doc, children: result.nodes } : doc;
}

function attachChildToPage(
  doc: CompositionDocument,
  pageNode: CanonicalNode,
  child: CanonicalNode,
  slotName: string | null | undefined,
): CompositionDocument {
  if (pageNode.type === "ref") {
    const descendants = { ...((pageNode as RefNode).descendants ?? {}) };
    const slotPath =
      findSlotPathForPageRef(doc, pageNode as RefNode, slotName ?? "content") ??
      slotName ??
      "content";
    const existingOverride = descendants[slotPath];
    const existingChildren =
      existingOverride &&
      typeof existingOverride === "object" &&
      "children" in existingOverride &&
      Array.isArray(existingOverride.children)
        ? existingOverride.children
        : [];
    descendants[slotPath] = {
      children: upsertChild(existingChildren, child),
    };
    const updatedPageNode: RefNode = {
      ...(pageNode as RefNode),
      descendants,
    };
    const replaced = replaceNodeById(
      doc.children,
      pageNode.id,
      updatedPageNode,
    );
    return replaced.replaced
      ? { ...doc, children: replaced.nodes }
      : { ...doc, children: upsertChild(doc.children, updatedPageNode) };
  }

  const result = appendChildToNode(doc.children, pageNode.id, child);
  return result.inserted ? { ...doc, children: result.nodes } : doc;
}

function findSlotPathForPageRef(
  doc: CompositionDocument,
  pageRef: RefNode,
  slotName: string,
): string | null {
  const frame = doc.children.find(
    (node): node is FrameNode =>
      node.type === "frame" &&
      node.reusable === true &&
      node.id === pageRef.ref,
  );
  if (!frame) return null;
  return findSlotPathInNode(frame.children ?? [], slotName, "");
}

function findSlotPathInNode(
  nodes: CanonicalNode[],
  slotName: string,
  parentPath: string,
): string | null {
  for (const node of nodes) {
    const currentPath = parentPath ? `${parentPath}/${node.id}` : node.id;
    const metadata = node.metadata as
      | { type?: unknown; slotName?: unknown }
      | undefined;
    if (
      metadata?.type === "legacy-slot-hoisted" &&
      metadata.slotName === slotName
    ) {
      return currentPath;
    }
    const childPath = findSlotPathInNode(
      node.children ?? [],
      slotName,
      currentPath,
    );
    if (childPath) return childPath;
  }
  return null;
}

function upsertElementIntoDocument(
  doc: CompositionDocument,
  element: Element,
  snapshot: LegacySnapshot,
): CompositionDocument {
  const legacy = asElementWithLegacyMirror(element);
  const previousNode = findNodeById(doc.children, element.id);
  if (
    previousNode &&
    shouldPreserveExistingCanonicalPosition(previousNode, element)
  ) {
    const node = legacyElementToCanonicalNode(element, doc, previousNode);
    const replaced = replaceNodeById(doc.children, element.id, node);
    if (replaced.replaced) {
      return { ...doc, children: replaced.nodes };
    }
  }

  const removed = removeNodeById(doc.children, element.id);
  const docWithoutExisting: CompositionDocument = {
    ...doc,
    children: removed.nodes,
  };
  const node = legacyElementToCanonicalNode(
    element,
    docWithoutExisting,
    previousNode,
  );

  if (
    legacy.componentRole === "master" &&
    !element.parent_id &&
    !element.page_id &&
    !element.layout_id
  ) {
    return {
      ...docWithoutExisting,
      children: upsertChild(docWithoutExisting.children, node),
    };
  }

  if (element.parent_id) {
    const result = appendChildToNode(
      docWithoutExisting.children,
      element.parent_id,
      node,
    );
    if (result.inserted) {
      return { ...docWithoutExisting, children: result.nodes };
    }
  }

  if (element.layout_id) {
    const ensured = ensureReusableFrame(
      docWithoutExisting,
      element.layout_id,
      snapshot,
    );
    return attachChildToFrame(ensured.doc, ensured.frame, node);
  }

  if (element.page_id) {
    const ensured = ensurePageNode(
      docWithoutExisting,
      element.page_id,
      snapshot,
    );
    return attachChildToPage(
      ensured.doc,
      ensured.pageNode,
      node,
      element.slot_name,
    );
  }

  return {
    ...docWithoutExisting,
    children: upsertChild(docWithoutExisting.children, node),
  };
}

type LegacyNodeMetadata = {
  type?: unknown;
  slotName?: unknown;
};

function shouldPreserveExistingCanonicalPosition(
  previousNode: CanonicalNode,
  element: Element,
): boolean {
  return legacyPositionMatches(previousNode, element);
}

function legacyPositionMatches(
  previousNode: CanonicalNode,
  element: Element,
): boolean {
  const metadata = previousNode.metadata as LegacyNodeMetadata | undefined;
  const legacy = asElementWithLegacyMirror(element);

  if (
    metadata?.type === "legacy-slot-hoisted" &&
    isLegacySlotTag(element.type)
  ) {
    const slotName =
      (element.props.name as string | undefined) ??
      legacy.slot_name ??
      "content";
    return (
      legacy.layout_id !== null &&
      legacy.layout_id !== undefined &&
      metadata.slotName === slotName
    );
  }

  const previous = readLegacyElementPositionMetadata(metadata);
  if (!previous) return false;

  return (
    sameLegacyValue(previous.parentId, element.parent_id) &&
    sameLegacyValue(previous.slotName, legacy.slot_name) &&
    sameLegacyValue(previous.role, legacy.componentRole) &&
    sameLegacyValue(previous.masterRef, legacy.masterId) &&
    sameLegacyValue(previous.elementType, element.type)
  );
}

function sameLegacyValue(left: unknown, right: unknown): boolean {
  return (left ?? null) === (right ?? null);
}

function upsertElementsIntoDocument(
  doc: CompositionDocument,
  elements: Element[],
  snapshot: LegacySnapshot,
): CompositionDocument {
  return elements.reduce(
    (currentDoc, element) =>
      upsertElementIntoDocument(currentDoc, element, snapshot),
    doc,
  );
}

const ROOT_CHILDREN_PATH = JSON.stringify(["root"]);

function nodeChildrenPath(parentPath: string, nodeId: string): string {
  return JSON.stringify([parentPath, "children", nodeId]);
}

function refDescendantChildrenPath(
  parentPath: string,
  nodeId: string,
  descendantPath: string,
): string {
  return JSON.stringify([parentPath, "descendants", nodeId, descendantPath]);
}

type ChildrenArrayIndex = {
  nodesByPath: Map<string, CanonicalNode[]>;
  parentPathByNodeId: Map<string, string>;
};

type DescendantChildrenOverride = {
  children: CanonicalNode[];
};

function hasDescendantChildrenOverride(
  override: unknown,
): override is DescendantChildrenOverride {
  return (
    Boolean(override) &&
    typeof override === "object" &&
    "children" in override &&
    Array.isArray((override as { children?: unknown }).children)
  );
}

function collectChildrenArrayIndex(
  nodes: CanonicalNode[],
  path: string = ROOT_CHILDREN_PATH,
  index: ChildrenArrayIndex = {
    nodesByPath: new Map(),
    parentPathByNodeId: new Map(),
  },
): ChildrenArrayIndex {
  index.nodesByPath.set(path, nodes);

  for (const node of nodes) {
    index.parentPathByNodeId.set(node.id, path);

    if (node.children && node.children.length > 0) {
      collectChildrenArrayIndex(
        node.children,
        nodeChildrenPath(path, node.id),
        index,
      );
    }

    if (node.type !== "ref") continue;

    const descendants = (node as RefNode).descendants ?? {};
    for (const [descendantPath, override] of Object.entries(descendants)) {
      if (!hasDescendantChildrenOverride(override)) continue;
      collectChildrenArrayIndex(
        override.children,
        refDescendantChildrenPath(path, node.id, descendantPath),
        index,
      );
    }
  }

  return index;
}

function isLegacyExportableCanonicalNode(node: CanonicalNode): boolean {
  const metadata = node.metadata as { type?: unknown } | undefined;
  return Boolean(node.props) || metadata?.type === "legacy-slot-hoisted";
}

function buildCanonicalSiblingOrderByPath(
  doc: CompositionDocument,
  elements: Element[],
  previousDoc?: CompositionDocument,
): Map<string, Map<string, number>> {
  if (elements.length < 2) return new Map();

  const childrenIndex = collectChildrenArrayIndex(doc.children);
  const groupedByParentPath = new Map<string, Element[]>();
  for (const element of elements) {
    const parentPath = childrenIndex.parentPathByNodeId.get(element.id);
    if (!parentPath) continue;
    const siblings = groupedByParentPath.get(parentPath) ?? [];
    siblings.push(element);
    groupedByParentPath.set(parentPath, siblings);
  }

  const sourceIndexById = createElementSourceIndex(elements);
  const orderByPath = new Map<string, Map<string, number>>();

  for (const [parentPath, siblings] of groupedByParentPath) {
    if (siblings.length < 2) continue;

    if (
      previousDoc &&
      !siblings.some((sibling) =>
        hasCanonicalPositionChange(previousDoc, sibling),
      )
    ) {
      continue;
    }

    const currentChildren = childrenIndex.nodesByPath.get(parentPath) ?? [];
    const reorderableChildren = currentChildren.filter(
      isLegacyExportableCanonicalNode,
    );
    if (reorderableChildren.length !== currentChildren.length) continue;

    const incomingIds = new Set(siblings.map((sibling) => sibling.id));
    if (
      reorderableChildren.length !== incomingIds.size ||
      reorderableChildren.some((child) => !incomingIds.has(child.id))
    ) {
      continue;
    }

    const orderedSiblingIds = [...siblings]
      .sort((left, right) =>
        compareElementsBySource(left, right, sourceIndexById),
      )
      .map((sibling) => sibling.id);
    const siblingOrderById = new Map<string, number>();
    orderedSiblingIds.forEach((id, index) => siblingOrderById.set(id, index));
    orderByPath.set(parentPath, siblingOrderById);
  }

  return orderByPath;
}

function hasCanonicalPositionChange(
  previousDoc: CompositionDocument,
  element: Element,
): boolean {
  const previousNode = findNodeById(previousDoc.children, element.id);
  return previousNode ? !legacyPositionMatches(previousNode, element) : true;
}

function hasSameNodeOrder(
  left: CanonicalNode[],
  right: CanonicalNode[],
): boolean {
  return (
    left.length === right.length &&
    left.every((node, index) => node.id === right[index]?.id)
  );
}

function reorderCurrentChildren(
  nodes: CanonicalNode[],
  orderById: ReadonlyMap<string, number> | undefined,
): { nodes: CanonicalNode[]; changed: boolean } {
  if (!orderById) return { nodes, changed: false };
  const ordered = [...nodes].sort(
    (left, right) =>
      (orderById.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (orderById.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  );

  return hasSameNodeOrder(nodes, ordered)
    ? { nodes, changed: false }
    : { nodes: ordered, changed: true };
}

function applyCanonicalSiblingOrderToChildren(
  nodes: CanonicalNode[],
  path: string,
  orderByPath: ReadonlyMap<string, ReadonlyMap<string, number>>,
): { nodes: CanonicalNode[]; changed: boolean } {
  const reordered = reorderCurrentChildren(nodes, orderByPath.get(path));
  let currentNodes = reordered.nodes;
  let changed = reordered.changed;

  const nextNodes = currentNodes.map((node) => {
    let nextNode = node;

    if (node.children && node.children.length > 0) {
      const childResult = applyCanonicalSiblingOrderToChildren(
        node.children,
        nodeChildrenPath(path, node.id),
        orderByPath,
      );
      if (childResult.changed) {
        nextNode = { ...nextNode, children: childResult.nodes };
      }
    }

    if (nextNode.type === "ref") {
      const refResult = applyCanonicalSiblingOrderToRefDescendants(
        nextNode as RefNode,
        path,
        orderByPath,
      );
      if (refResult.changed) {
        nextNode = refResult.node;
      }
    }

    if (nextNode !== node) changed = true;
    return nextNode;
  });

  currentNodes = nextNodes;
  return { nodes: currentNodes, changed };
}

function applyCanonicalSiblingOrderToRefDescendants(
  refNode: RefNode,
  parentPath: string,
  orderByPath: ReadonlyMap<string, ReadonlyMap<string, number>>,
): { node: RefNode; changed: boolean } {
  const descendants = refNode.descendants ?? {};
  let changed = false;
  const nextDescendants: RefNode["descendants"] = {};

  for (const [descendantPath, override] of Object.entries(descendants)) {
    if (!hasDescendantChildrenOverride(override)) {
      nextDescendants[descendantPath] = override;
      continue;
    }

    const childPath = refDescendantChildrenPath(
      parentPath,
      refNode.id,
      descendantPath,
    );
    const childResult = applyCanonicalSiblingOrderToChildren(
      override.children,
      childPath,
      orderByPath,
    );
    if (childResult.changed) {
      changed = true;
      nextDescendants[descendantPath] = {
        ...override,
        children: childResult.nodes,
      };
      continue;
    }

    nextDescendants[descendantPath] = override;
  }

  return changed
    ? { node: { ...refNode, descendants: nextDescendants }, changed: true }
    : { node: refNode, changed: false };
}

function applyCanonicalSiblingOrder(
  doc: CompositionDocument,
  elements: Element[],
  previousDoc?: CompositionDocument,
): CompositionDocument {
  const orderByPath = buildCanonicalSiblingOrderByPath(
    doc,
    elements,
    previousDoc,
  );
  if (orderByPath.size === 0) return doc;

  const result = applyCanonicalSiblingOrderToChildren(
    doc.children,
    ROOT_CHILDREN_PATH,
    orderByPath,
  );
  return result.changed ? { ...doc, children: result.nodes } : doc;
}

function isFullReplaceShellNode(node: CanonicalNode): boolean {
  const metadata = node.metadata as { type?: unknown } | undefined;
  return metadata?.type === "legacy-page" || metadata?.type === "legacy-layout";
}

function shouldPreserveOmittedFullReplaceNode(node: CanonicalNode): boolean {
  return isFullReplaceShellNode(node) || node.type === "body";
}

function hasFullReplaceChildrenPayload(node: CanonicalNode): boolean {
  if (node.children && node.children.length > 0) return true;
  if (node.type !== "ref") return false;
  return Object.values((node as RefNode).descendants ?? {}).some(
    (override) =>
      hasDescendantChildrenOverride(override) && override.children.length > 0,
  );
}

function clearIncomingFullReplaceNode(node: CanonicalNode): CanonicalNode {
  if (node.type === "ref") {
    return {
      ...(node as RefNode),
      children: [],
      descendants: {},
    } satisfies RefNode;
  }
  return { ...node, children: [] };
}

function pruneRefDescendantsForFullReplace(
  refNode: RefNode,
  incomingElementIds: ReadonlySet<string>,
): RefNode {
  const descendants = refNode.descendants ?? {};
  if (Object.keys(descendants).length === 0) return refNode;

  const nextDescendants: RefNode["descendants"] = {};
  for (const [descendantPath, override] of Object.entries(descendants)) {
    if (!hasDescendantChildrenOverride(override)) {
      nextDescendants[descendantPath] = override;
      continue;
    }
    nextDescendants[descendantPath] = {
      ...override,
      children: pruneChildrenForFullReplace(
        override.children,
        incomingElementIds,
      ),
    };
  }

  return { ...refNode, descendants: nextDescendants };
}

function pruneNodeForFullReplace(
  node: CanonicalNode,
  incomingElementIds: ReadonlySet<string>,
): CanonicalNode | null {
  if (incomingElementIds.has(node.id)) {
    return clearIncomingFullReplaceNode(node);
  }

  let nextNode = node;
  if (node.children) {
    nextNode = {
      ...nextNode,
      children: pruneChildrenForFullReplace(node.children, incomingElementIds),
    };
  }

  if (nextNode.type === "ref") {
    nextNode = pruneRefDescendantsForFullReplace(
      nextNode as RefNode,
      incomingElementIds,
    );
  }

  if (shouldPreserveOmittedFullReplaceNode(nextNode)) return nextNode;
  if (!isLegacyExportableCanonicalNode(nextNode)) {
    return hasFullReplaceChildrenPayload(nextNode) ? nextNode : null;
  }
  return null;
}

function pruneChildrenForFullReplace(
  nodes: CompositionDocument["children"],
  incomingElementIds: ReadonlySet<string>,
): CompositionDocument["children"] {
  return nodes.flatMap((node) => {
    const pruned = pruneNodeForFullReplace(node, incomingElementIds);
    return pruned ? [pruned] : [];
  });
}

function prepareFullReplaceShell(
  doc: CompositionDocument,
  elements: Element[],
): CompositionDocument {
  const incomingElementIds = new Set(elements.map((element) => element.id));
  return {
    ...doc,
    children: pruneChildrenForFullReplace(doc.children, incomingElementIds),
  };
}

// ─────────────────────────────────────────────
// Canonical primary reverse path (§8.7)
// ─────────────────────────────────────────────

/**
 * mergeElements 의 canonical primary 변형.
 *
 * 1. active canonical document 에 incoming elements 를 legacy id 기준 upsert
 * 2. canonical store `setDocument` push
 */
function applyCanonicalPrimaryMerge(
  elements: Element[],
): CanonicalMutationResult {
  const actions = getActions();
  const snapshot = actions.getCurrentLegacySnapshot();
  const projectId = actions.getCurrentProjectId();
  if (!projectId) {
    return { changed: false, document: null };
  }
  const currentDoc = getCurrentDocument(projectId);
  const sortedElements = sortElementsForUpsert(elements);
  const upsertedDoc = upsertElementsIntoDocument(
    currentDoc,
    sortedElements,
    snapshot,
  );
  const doc = applyCanonicalSiblingOrder(
    upsertedDoc,
    sortedElements,
    currentDoc,
  );

  useCanonicalDocumentStore.getState().setDocument(projectId, doc);

  return { changed: true, document: doc };
}

/**
 * setElements 의 canonical primary 변형.
 *
 * 1. 기존 pages/layouts snapshot 으로 canonical document shell 구성
 * 2. 입력 elements 를 shell 에 legacy id 기준 upsert
 * 2. canonical store `setDocument` push
 */
function applyCanonicalPrimarySet(
  elements: Element[],
): CanonicalMutationResult {
  const actions = getActions();
  const snapshot = actions.getCurrentLegacySnapshot();
  const projectId = actions.getCurrentProjectId();
  if (!projectId) {
    return { changed: false, document: null };
  }
  const currentDoc = getCurrentDocument(projectId);
  const shellDoc = buildDocumentShellFromSnapshot(currentDoc, snapshot);
  const replaceShellDoc = prepareFullReplaceShell(shellDoc, elements);
  const sortedElements = sortElementsForUpsert(elements);
  const upsertedDoc = upsertElementsIntoDocument(
    replaceShellDoc,
    sortedElements,
    snapshot,
  );
  const doc = applyCanonicalSiblingOrder(upsertedDoc, sortedElements);
  useCanonicalDocumentStore.getState().setDocument(projectId, doc);

  return { changed: true, document: doc };
}

// ─────────────────────────────────────────────
// In-memory store wrapper API
// ─────────────────────────────────────────────

/**
 * legacy `mergeElements` 의 canonical-aware wrapper.
 *
 * canonical store mutation only. Derived store cache updates are caller-owned.
 *
 * @param elements - 추가/병합할 legacy element 배열
 */
export function mergeElementsCanonicalPrimary(
  elements: Element[],
): CanonicalMutationResult {
  return applyCanonicalPrimaryMerge(elements);
}

/**
 * legacy `setElements` 의 canonical-aware wrapper.
 *
 * canonical store mutation only. Derived store cache updates are caller-owned.
 *
 * @param elements - 전체 element 배열 (replace)
 */
export function setElementsCanonicalPrimary(
  elements: Element[],
): CanonicalMutationResult {
  return applyCanonicalPrimarySet(elements);
}

/**
 * canonical `children[]` splice 기반 element move.
 *
 * Drag/drop Phase 4 entry point:
 * - canonical document 를 먼저 이동한다.
 * - legacy `Element[]` mirror write-back 은 수행하지 않는다.
 * - legacy element `order_num` batch 는 제거됐고 canonical children[] index 만 갱신한다.
 */
export function moveElementCanonicalPrimary(
  elementId: string,
  targetParentId: CanonicalParentId,
  insertionIndex: number,
): CanonicalMutationResult {
  const actions = getActions();
  const projectId = actions.getCurrentProjectId();
  if (!projectId) {
    return { changed: false, document: null };
  }
  const currentDoc = getCurrentDocument(projectId);
  const result = moveCanonicalChild(
    currentDoc,
    elementId,
    targetParentId,
    insertionIndex,
  );

  if (!result.changed) {
    return { changed: false, document: currentDoc };
  }

  useCanonicalDocumentStore.getState().setDocument(projectId, result.document);

  return { changed: true, document: result.document };
}

/**
 * tree DnD/update batch 에서 계산된 parent/source-order intent 를 canonical
 * `children[]` splice 로 직접 반영한다. 입력 배열은 같은 parent 내 최종 sibling
 * source order 여야 한다.
 */
export function applyElementOrderCanonicalPrimary(
  elements: Element[],
): CanonicalMutationResult {
  if (elements.length === 0) return { changed: false, document: null };

  const actions = getActions();
  const projectId = actions.getCurrentProjectId();
  if (!projectId) {
    return { changed: false, document: null };
  }
  const currentDoc = getCurrentDocument(projectId);
  const sourceIndexById = createElementSourceIndex(elements);
  const orderedMoves = [...elements]
    .sort((left, right) => {
      const leftParent = left.parent_id ?? "";
      const rightParent = right.parent_id ?? "";
      const parentDiff = leftParent.localeCompare(rightParent);
      if (parentDiff !== 0) return parentDiff;

      return (
        (sourceIndexById.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (sourceIndexById.get(right.id) ?? Number.MAX_SAFE_INTEGER)
      );
    })
    .map((element, index, sorted) => {
      const parentId = element.parent_id ?? null;
      const siblingIndex =
        sorted
          .slice(0, index + 1)
          .filter((candidate) => (candidate.parent_id ?? null) === parentId)
          .length - 1;
      return { element, index: siblingIndex };
    });

  let doc = currentDoc;
  let changed = false;

  for (const { element, index } of orderedMoves) {
    const result = moveCanonicalChild(
      doc,
      element.id,
      element.parent_id ?? null,
      index,
    );
    if (!result.changed) continue;
    doc = result.document;
    changed = true;
  }

  if (!changed) return { changed: false, document: currentDoc };

  useCanonicalDocumentStore.getState().setDocument(projectId, doc);

  return { changed: true, document: doc };
}

// ─────────────────────────────────────────────
// DB persistence wrapper API
// ─────────────────────────────────────────────
//
// DB wrapper 3개는 §8.7 reverse 영향 없음 — D17=A 채택 (schema 미변경, DB row =
// legacy export 결과). DB persist 후 caller 가 반환 Element 받아서 in-memory
// wrapper (merge/set) 호출 → 그 시점에 canonical primary path 가동.

/**
 * legacy `elementsApi.createElement` 의 canonical-aware wrapper.
 *
 * @param element - 신규 legacy element (Partial 허용)
 * @returns 저장된 Element (DB id 포함)
 */
export function createElementCanonicalPrimary(
  element: Partial<Element>,
): Promise<Element> {
  return elementsApi.createElement(element);
}

/**
 * legacy `elementsApi.updateElement` 의 canonical-aware wrapper.
 *
 * @param id - 대상 element id
 * @param patch - 부분 업데이트 patch
 * @returns 업데이트된 Element
 */
export function updateElementCanonicalPrimary(
  id: string,
  patch: Partial<Element>,
): Promise<Element> {
  return elementsApi.updateElement(id, patch);
}

/**
 * legacy `elementsApi.createMultipleElements` 의 canonical-aware wrapper.
 *
 * @param elements - 신규 legacy element 배열 (Partial 허용)
 * @returns 저장된 Element 배열 (DB id 포함)
 */
export function createMultipleElementsCanonicalPrimary(
  elements: Partial<Element>[],
): Promise<Element[]> {
  return elementsApi.createMultipleElements(elements);
}

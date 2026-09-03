/**
 * @fileoverview Canonical → Legacy Element[] derived view — ADR-116 Phase 2 G3 Step 1b
 *
 * canonical store 의 active document 를 `Element[]` 로 평탄화. 5 hot path
 * cutover 의 read backbone — 기존 파이프라인 (buildTreeFromElements /
 * convertToLayerTreeNodes / Inspector / Preview sync) 을 변경하지 않고
 * canonical → derived view 로 사용 가능.
 *
 * ADR-116 direct cutover 이후 `CanonicalNode.props` 와 canonical node id/type 이
 * derived view 의 source of truth 이다.
 *
 * Direct cutover 이후 canonical store 가 hydrated 일 때 의미가 있다. ADR-126
 * Phase 5 이후 runtime caller 는 `Element[]` hook 대신 active canonical document
 * traversal helper 를 직접 사용한다.
 */

import { useMemo } from "react";
import type {
  CanonicalNode,
  CompositionDocument,
  CompositionExtension,
} from "@composition/shared";
import type { Element } from "../../../types/builder/unified.types";
import {
  getFrameElementMirrorId,
  withFrameElementMirrorId,
  normalizeFrameLayoutId,
} from "../../../adapters/canonical/frameMirror";
import { readLegacyMetadataCustomId } from "../../../adapters/canonical/legacyMetadata";
import { readCanonicalNodeFillPayload } from "../../../adapters/canonical/canonicalFillPayload";
import {
  canonicalDocumentToFrameElementScopes,
  type CanonicalFrameElementScopeMap,
} from "../../../adapters/canonical/frameElementScope";
import {
  getActiveCanonicalDocument,
  useActiveCanonicalDocument,
} from "./canonicalElementsBridge";
import { useCanonicalDocumentStore } from "./canonicalDocumentStore";
import { getCanonicalPageRefDescendantChildren } from "./canonicalTraversalHelpers";

type ElementScopeContext = {
  pageId: string | null;
  layoutId: string | null;
};

type CanonicalScopeMetadata = {
  customId?: unknown;
  type?: unknown;
  pageId?: unknown;
  layoutId?: unknown;
  slotName?: unknown;
};

const CANONICAL_REF_CHILD_PATCHES_FIELD = "descendants" as const;

type CanonicalComponentMirrorFields = {
  [CANONICAL_REF_CHILD_PATCHES_FIELD]?: unknown;
  metadata?: CanonicalNode["metadata"];
  ref?: string;
  reusable?: true;
  slot?: false | string[];
  responsive?: CanonicalNode["responsive"];
};

const ROOT_SCOPE: ElementScopeContext = {
  pageId: null,
  layoutId: null,
};

/**
 * ADR-116 Phase 5 G7 본격 cutover (2026-05-01) — `x-composition` extension 에서
 * events / dataBinding 추출하여 Element 에 spread 가능한 partial 객체 반환.
 * 양쪽 미정의 시 빈 객체 반환.
 */
function extractExtensionFields(node: CanonicalNode): {
  events?: Element["events"];
  dataBinding?: Element["dataBinding"];
} {
  const ext = (
    node as CanonicalNode & { "x-composition"?: CompositionExtension }
  )["x-composition"];
  if (!ext) return {};
  const out: {
    events?: Element["events"];
    dataBinding?: Element["dataBinding"];
  } = {};
  if (ext.events !== undefined) {
    out.events = ext.events as Element["events"];
  }
  if (ext.dataBinding !== undefined) {
    out.dataBinding = ext.dataBinding as Element["dataBinding"];
  }
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// Ref override helpers — ADR-127 leaf 소유권은 canonicalTraversalHelpers.
// panel/store 최종 소비자를 위해 동일 심볼을 여기서 re-export 한다.
export {
  getCanonicalRefOverrideEntries,
  withCanonicalRefOverrides,
} from "./canonicalTraversalHelpers";

function isPagePlaceholderNode(node: CanonicalNode): boolean {
  const metadata = node.metadata as CanonicalScopeMetadata | undefined;
  return metadata?.type === "page" || metadata?.type === "legacy-page";
}

function extractCanonicalComponentMirrorFields(
  node: CanonicalNode,
): CanonicalComponentMirrorFields {
  const out: CanonicalComponentMirrorFields = {};
  const ref = (node as CanonicalNode & { ref?: unknown }).ref;
  if (typeof ref === "string" && ref.length > 0) {
    out.ref = ref;
  }

  const descendants = (
    node as CanonicalNode & {
      [CANONICAL_REF_CHILD_PATCHES_FIELD]?: unknown;
    }
  )[CANONICAL_REF_CHILD_PATCHES_FIELD];
  if (isRecord(descendants)) {
    out[CANONICAL_REF_CHILD_PATCHES_FIELD] = descendants;
  }

  if (node.reusable === true) {
    out.reusable = true;
  }
  if (node.slot === false || Array.isArray(node.slot)) {
    out.slot = node.slot;
  }
  // ADR-154: 반응형 override mirror (top-level canonical 필드 → Element)
  if (node.responsive) {
    out.responsive = node.responsive;
  }
  if (node.metadata) {
    out.metadata = node.metadata;
  }

  return out;
}

// ─────────────────────────────────────────────
// Conversion helpers
// ─────────────────────────────────────────────

/**
 * canonical CanonicalNode + parent context → Element 재구성.
 *
 * `node.props` 미정의 노드(page placeholder, slot synthetic 등)는 기존처럼
 * derived Element 에서 제외한다.
 */
export function canonicalNodeToElement(
  node: CanonicalNode,
  parentId: string | null,
  scope: ElementScopeContext = ROOT_SCOPE,
): Element | null {
  // ADR-116 Phase 5 G7 본격 cutover — `x-composition` extension 에서
  // events/dataBinding 복원.
  const extFields = extractExtensionFields(node);
  const metadata = node.metadata as CanonicalScopeMetadata | undefined;
  const isLegacySlotHoisted = metadata?.type === "legacy-slot-hoisted";
  const isPagePlaceholder = isPagePlaceholderNode(node);
  const mirrorFields = extractCanonicalComponentMirrorFields(node);
  const isRenderableRef = mirrorFields.ref !== undefined && !isPagePlaceholder;
  if (!node.props && !isLegacySlotHoisted && !isRenderableRef) return null;
  const customId = readLegacyMetadataCustomId(metadata);
  const props = { ...(node.props ?? {}) };
  if (isLegacySlotHoisted && typeof metadata?.slotName === "string") {
    props.name ??= metadata.slotName;
  }
  const frameMirrorId = getFrameElementMirrorId(props) ?? scope.layoutId;

  return withFrameElementMirrorId(
    {
      id: node.id,
      ...(customId ? { customId } : {}),
      type: isLegacySlotHoisted ? "Slot" : node.type,
      props,
      parent_id: parentId,
      page_id: scope.pageId,
      layout_id: scope.layoutId,
      fills: readCanonicalNodeFillPayload(node) as Element["fills"],
      componentName: node.name,
      ...extFields,
      ...mirrorFields,
    },
    frameMirrorId,
  );
}

/**
 * canonical document tree 를 평탄한 legacy `Element[]` 로 변환.
 *
 * - DFS 순회 (root → children), source order 그대로 보존.
 * - metadata 미보존 노드는 skip — children 은 부모 context (skip 직전 부모 id) 로 승계.
 * - 결과 Element[] 는 buildTreeFromElements 가 `parent_id` 기반으로 재구성 가능.
 */
export function canonicalDocumentToElements(
  doc: CompositionDocument,
): Element[] {
  return collectCanonicalDocumentElements(doc);
}

export function getActiveCanonicalDocumentElements(): Element[] | null {
  const doc = getActiveCanonicalDocument();
  if (!doc) return null;

  // WeakMap-cached view — update/removal/instance hot path 가 매 visit 마다
  // 전체 DFS 를 다시 돌리지 않도록 한다.
  return [...getCanonicalDocumentElementsView(doc).elements];
}

function collectCanonicalDocumentElements(doc: CompositionDocument): Element[] {
  return [...getCanonicalDocumentElementsView(doc).elements];
}

// ─────────────────────────────────────────────
// Document-keyed derived view cache
// ─────────────────────────────────────────────

export type CanonicalDocumentElementsView = {
  readonly elements: readonly Element[];
  readonly byId: ReadonlyMap<string, Element>;
};

const elementsViewCache = new WeakMap<
  CompositionDocument,
  CanonicalDocumentElementsView
>();

/**
 * 문서 참조당 1회만 평탄화하는 derived view. canonical store 는 clone-on-write
 * (mutation 시에만 document 참조 교체 — canonicalElementsBridge 참조) 를 보장하므로
 * 참조 키 WeakMap 캐시가 안전하다.
 *
 * 선택 변경 hot path (useSelectedElementData / findElementInCanonicalDocument /
 * useCanonicalPropertySourceElements) 가 선택·hook 인스턴스마다 문서 전체를
 * 재-materialize 하던 비용을 제거한다.
 *
 * `byId` 는 중복 id 시 last-match — 기존 전체 순회 재할당 (`match = element`)
 * 의미와 동일하다.
 */
export function getCanonicalDocumentElementsView(
  doc: CompositionDocument,
): CanonicalDocumentElementsView {
  const cached = elementsViewCache.get(doc);
  if (cached) return cached;

  const elements: Element[] = [];
  const byId = new Map<string, Element>();
  visitCanonicalDocumentElements(doc, (element) => {
    elements.push(element);
    byId.set(element.id, element);
  });
  const view: CanonicalDocumentElementsView = { elements, byId };
  elementsViewCache.set(doc, view);
  return view;
}

export function visitCanonicalDocumentElements(
  doc: CompositionDocument,
  visitor: (element: Element, node: CanonicalNode) => void,
): void {
  function visit(
    node: CanonicalNode,
    parentLegacyId: string | null,
    scope: ElementScopeContext,
  ): void {
    const nextScope = getNodeScope(node, scope);
    const element = canonicalNodeToElement(node, parentLegacyId, nextScope);
    const nextParentId = element?.id ?? parentLegacyId;
    if (element) visitor(element, node);
    if (node.children) {
      node.children.forEach((child) => {
        visit(child, nextParentId, nextScope);
      });
    }
    getCanonicalPageRefDescendantChildren(node).forEach((children) => {
      children.forEach((child) => {
        visit(child, nextParentId, nextScope);
      });
    });
  }

  doc.children.forEach((child) => {
    visit(child, null, ROOT_SCOPE);
  });
}

function getNodeScope(
  node: CanonicalNode,
  scope: ElementScopeContext,
): ElementScopeContext {
  const metadata = node.metadata as CanonicalScopeMetadata | undefined;
  const metadataType = metadata?.type;

  if (metadataType === "legacy-slot-hoisted") {
    return scope;
  }

  if (isPagePlaceholderNode(node)) {
    return {
      pageId: typeof metadata?.pageId === "string" ? metadata.pageId : node.id,
      layoutId: null,
    };
  }

  if (
    node.type === "frame" &&
    node.reusable !== true &&
    scope.pageId === null
  ) {
    return {
      pageId: node.id,
      layoutId: null,
    };
  }

  if (node.type === "frame" && node.reusable === true) {
    const metadataLayoutId = metadata?.layoutId;
    const layoutId =
      normalizeFrameLayoutId(
        typeof metadataLayoutId === "string" ? metadataLayoutId : null,
      ) ?? node.id;
    return {
      pageId: null,
      layoutId,
    };
  }

  return scope;
}

// ─────────────────────────────────────────────
// React hook
// ─────────────────────────────────────────────

export function useCanonicalFrameElementScopes(): CanonicalFrameElementScopeMap | null {
  const doc = useActiveCanonicalDocument();
  const documentVersion = useCanonicalDocumentStore(
    (state) => state.documentVersion,
  );
  return useMemo(() => {
    if (!doc) return null;
    return canonicalDocumentToFrameElementScopes(doc);
  }, [doc, documentVersion]);
}

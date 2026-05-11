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
  DescendantOverride,
  RefNode,
} from "@composition/shared";
import type { Element } from "../../../types/builder/unified.types";
import {
  getFrameElementMirrorId,
  withFrameElementMirrorId,
} from "../../../adapters/canonical/frameMirror";
import { readLegacyMetadataCustomId } from "../../../adapters/canonical/legacyMetadata";
import {
  canonicalDocumentToFrameElementScopes,
  type CanonicalFrameElementScopeMap,
} from "../../../adapters/canonical/frameElementScope";
import {
  getActiveCanonicalDocument,
  useActiveCanonicalDocument,
} from "./canonicalElementsBridge";

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

function isCanonicalNode(value: unknown): value is CanonicalNode {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { id?: unknown; type?: unknown };
  return typeof candidate.id === "string" && typeof candidate.type === "string";
}

function readDescendantChildren(override: unknown): CanonicalNode[] {
  if (!override || typeof override !== "object") return [];
  if (isCanonicalNode(override)) return [override];

  const children = (override as { children?: unknown }).children;
  if (!Array.isArray(children)) return [];
  return children.filter(isCanonicalNode);
}

function getRefDescendantChildren(node: CanonicalNode): CanonicalNode[][] {
  if (node.type !== "ref" || !isPagePlaceholderNode(node)) return [];
  const descendants = (node as RefNode).descendants ?? {};
  return Object.values(descendants)
    .map(readDescendantChildren)
    .filter((children) => children.length > 0);
}

export function getCanonicalRefOverrideEntries(
  node: CanonicalNode,
): Array<[string, DescendantOverride]> {
  if (node.type !== "ref") return [];
  const descendants = (node as RefNode).descendants ?? {};
  return Object.entries(descendants);
}

export function withCanonicalRefOverrides(
  refNode: RefNode,
  overrides: RefNode["descendants"],
): RefNode {
  if (overrides && Object.keys(overrides).length > 0) {
    return { ...refNode, descendants: overrides };
  }

  const { descendants: _descendants, ...rest } = refNode;
  return rest as RefNode;
}

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
      fills: undefined,
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

  return collectCanonicalDocumentElements(doc);
}

function collectCanonicalDocumentElements(doc: CompositionDocument): Element[] {
  const result: Element[] = [];
  visitCanonicalDocumentElements(doc, (element) => {
    result.push(element);
  });
  return result;
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
    getRefDescendantChildren(node).forEach((children) => {
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
      typeof metadataLayoutId === "string"
        ? metadataLayoutId
        : node.id.startsWith("layout-")
          ? node.id.slice("layout-".length)
          : node.id;
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
  return useMemo(() => {
    if (!doc) return null;
    return canonicalDocumentToFrameElementScopes(doc);
  }, [doc]);
}

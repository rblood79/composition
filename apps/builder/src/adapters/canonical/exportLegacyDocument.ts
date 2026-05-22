/**
 * @fileoverview ADR-116 Phase 3 G4 — 3-A-impl: exportLegacyDocument
 *
 * canonical primary storage 전환 후 legacy compat payload 생성 SSOT (D18=A 단일
 * 진입점).
 *
 * **D18=A 채택 사유**: 모든 legacy `elements[]` 생성 site 가 본 함수 경유 →
 * grep gate 단순 (`exportLegacyDocument` 외 legacy direct write 0건). 단일
 * 진입점 testability + post-cutover refactor scope 좁힘.
 *
 * **변환 contract**:
 * - canonical 노드의 `props` 가 legacy `Element.props` 의 source 이다.
 * - DFS 순회 시 `props` 가진 노드만 element 로 emit.
 * - structural 컨테이너(page node / layout shell 등)는 props 없으면 자동 skip.
 *
 * **ADR-116 Phase 5 G7 본격 cutover** (2026-05-01): events / dataBinding 은
 * `x-composition` extension namespace 에서 reverse 추출.
 */

import type {
  CanonicalNode,
  CompositionDocument,
  CompositionExtension,
  RefNode,
} from "@composition/shared";
import type { Element } from "@/types/builder/unified.types";
import type { ElementWithLegacyMirror } from "./legacyElementFields";
import { readLegacyMetadataCustomId } from "./legacyMetadata";

type LegacyExportContext = {
  pageId: string | null;
  layoutId: string | null;
};

type LegacyScopeMetadata = {
  customId?: unknown;
  type?: unknown;
  pageId?: unknown;
  layoutId?: unknown;
  slotName?: unknown;
};

/**
 * canonical document → legacy `Element[]` payload 역변환.
 *
 * `props` 보존된 노드만 element 로 복원. 보존 누락된 컨테이너 노드
 * (page / layout shell 등) 는 element[] 에서 제외 — pages[] / layouts[] 는 별도
 * export 경로 사용.
 *
 * @param doc - canonical CompositionDocument (sync 결과 또는 primary write 결과)
 * @returns legacy Element[] (DFS 순회 결과, parent_id 그대로 보존)
 */
export function exportLegacyDocument(doc: CompositionDocument): Element[] {
  const elements: Element[] = [];
  const rootContext: LegacyExportContext = { pageId: null, layoutId: null };

  doc.children.forEach((root) => {
    walkAndCollect(root, elements, null, rootContext);
  });

  return elements;
}

function walkAndCollect(
  node: CanonicalNode,
  out: Element[],
  parentId: string | null,
  context: LegacyExportContext,
): void {
  const scopedContext = getNodeScope(node, context);
  const legacy = extractElement(node, parentId, scopedContext);
  if (legacy) {
    out.push(legacy);
  }
  const nextParentId = legacy?.id ?? parentId;

  node.children?.forEach((child) => {
    walkAndCollect(child, out, nextParentId, scopedContext);
  });

  if (shouldCollectRefDescendants(node)) {
    const descendants = (node as RefNode).descendants ?? {};
    for (const override of Object.values(descendants)) {
      if (
        override &&
        typeof override === "object" &&
        "children" in override &&
        Array.isArray(override.children)
      ) {
        override.children.forEach((child) => {
          walkAndCollect(child, out, nextParentId, scopedContext);
        });
      }
    }
  }
}

function shouldCollectRefDescendants(node: CanonicalNode): boolean {
  return node.type === "ref" && isPageMetadataNode(node);
}

function isPageMetadataNode(node: CanonicalNode): boolean {
  const metadata = node.metadata as LegacyScopeMetadata | undefined;
  return metadata?.type === "page" || metadata?.type === "legacy-page";
}

function getNodeScope(
  node: CanonicalNode,
  context: LegacyExportContext,
): LegacyExportContext {
  const metadata = node.metadata as LegacyScopeMetadata | undefined;
  const metadataType = metadata?.type;

  if (metadataType === "legacy-slot-hoisted") {
    return context;
  }

  if (isPageMetadataNode(node)) {
    return {
      pageId: typeof metadata?.pageId === "string" ? metadata.pageId : node.id,
      layoutId: null,
    };
  }

  if (
    node.type === "frame" &&
    node.reusable !== true &&
    context.pageId === null
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

  return context;
}

/**
 * canonical node 에서 Element 복원 — `props` 가 보존되어 있으면 그것을 source 로
 * element 재구성. 보존 없으면 null (structural 컨테이너).
 */
function extractElement(
  node: CanonicalNode,
  parentId: string | null,
  context: LegacyExportContext,
): Element | null {
  const metadata = node.metadata as LegacyScopeMetadata | undefined;
  const isLegacySlotHoisted = metadata?.type === "legacy-slot-hoisted";
  if (!node.props && !isLegacySlotHoisted) return null;
  const customId = readLegacyMetadataCustomId(metadata);
  const props = { ...(node.props ?? {}) };
  if (isLegacySlotHoisted && typeof metadata?.slotName === "string") {
    props.name ??= metadata.slotName;
  }

  const element: ElementWithLegacyMirror = {
    id: node.id,
    ...(customId ? { customId } : {}),
    type: isLegacySlotHoisted ? "Slot" : node.type,
    props,
    parent_id: parentId,
    page_id: context.pageId,
    layout_id: context.layoutId,
  };
  if (isLegacySlotHoisted && typeof metadata?.slotName === "string") {
    element.slot_name = metadata.slotName;
  }

  if (node.name !== undefined) element.componentName = node.name;
  if (node.reusable === true) {
    element.componentRole = "master";
    (element as ElementWithLegacyMirror & { reusable?: boolean }).reusable =
      true;
  }
  if (node.type === "ref") {
    const refNode = node as RefNode;
    element.componentRole = "instance";
    element.masterId = refNode.ref;
    (element as ElementWithLegacyMirror & { ref?: string }).ref = refNode.ref;
    element.overrides = { ...node.props };
    if (refNode.descendants) {
      element.descendants =
        refNode.descendants as ElementWithLegacyMirror["descendants"];
    }
  }

  // ADR-116 Phase 5 G7 본격 cutover (2026-05-01) — events/dataBinding 은
  // `x-composition` extension namespace 에서 reverse 복원.
  const ext = (
    node as CanonicalNode & { "x-composition"?: CompositionExtension }
  )["x-composition"];
  if (ext?.events !== undefined) {
    element.events = ext.events as Element["events"];
  }
  if (ext?.dataBinding !== undefined) {
    element.dataBinding = ext.dataBinding as Element["dataBinding"];
  }

  return element;
}

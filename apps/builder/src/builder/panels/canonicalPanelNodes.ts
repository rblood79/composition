import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { readCanonicalNodeCustomId } from "../../adapters/canonical/legacyMetadata";
import { getCanonicalPageRefDescendantChildren } from "../stores/canonical/canonicalTraversalHelpers";
import type { PanelNode } from "./panelNode";

interface PanelScope {
  pageId: string | null;
}

interface PanelScopeMetadata extends Record<string, unknown> {
  type?: unknown;
  pageId?: unknown;
  slotName?: unknown;
}

const ROOT_SCOPE: PanelScope = { pageId: null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getMetadata(node: CanonicalNode): PanelScopeMetadata | undefined {
  return isRecord(node.metadata) ? node.metadata : undefined;
}

function isPagePlaceholder(node: CanonicalNode): boolean {
  const metadataType = getMetadata(node)?.type;
  return metadataType === "page" || metadataType === "legacy-page";
}

function getNodeScope(node: CanonicalNode, scope: PanelScope): PanelScope {
  const metadata = getMetadata(node);
  if (metadata?.type === "legacy-slot-hoisted") return scope;

  if (isPagePlaceholder(node)) {
    return {
      pageId: typeof metadata?.pageId === "string" ? metadata.pageId : node.id,
    };
  }

  if (
    node.type === "frame" &&
    node.reusable !== true &&
    scope.pageId === null
  ) {
    return { pageId: node.id };
  }

  if (node.type === "frame" && node.reusable === true) {
    return { pageId: null };
  }

  return scope;
}

function getNodeRef(node: CanonicalNode): string | undefined {
  const ref = (node as CanonicalNode & { ref?: unknown }).ref;
  return typeof ref === "string" && ref.length > 0 ? ref : undefined;
}

function toPanelNode(
  node: CanonicalNode,
  parentId: string | null,
  scope: PanelScope,
): PanelNode | null {
  const metadata = getMetadata(node);
  const isHoistedSlot = metadata?.type === "legacy-slot-hoisted";
  const pagePlaceholder = isPagePlaceholder(node);
  const ref = getNodeRef(node);
  const isRenderableRef = ref !== undefined && !pagePlaceholder;

  if (!node.props && !isHoistedSlot && !isRenderableRef) return null;

  const props = { ...(node.props ?? {}) };
  if (isHoistedSlot && typeof metadata?.slotName === "string") {
    props.name ??= metadata.slotName;
  }

  const panelNode: PanelNode = {
    id: node.id,
    type: isHoistedSlot ? "Slot" : node.type,
    props,
    parent_id: parentId,
    page_id: scope.pageId,
  };
  const customId = readCanonicalNodeCustomId(node);
  if (customId) panelNode.customId = customId;
  if (node.name) panelNode.componentName = node.name;
  if (ref) panelNode.ref = ref;

  const descendants = (node as CanonicalNode & { descendants?: unknown })
    .descendants;
  if (isRecord(descendants)) {
    panelNode.descendants = descendants as PanelNode["descendants"];
  }
  if (node.reusable === true) panelNode.reusable = true;
  if (node.slot === false || Array.isArray(node.slot))
    panelNode.slot = node.slot;
  if (node.responsive) panelNode.responsive = node.responsive;
  if (node.metadata) panelNode.metadata = node.metadata;

  return panelNode;
}

/**
 * Panel이 필요한 canonical node 필드만 DFS 순서로 평탄화한다.
 * page placeholder와 비표시 structural node는 결과에서 제외하되 자식의
 * materialized parent와 page scope는 유지한다.
 */
export function collectCanonicalPanelNodes(
  doc: CompositionDocument,
): PanelNode[] {
  const nodes: PanelNode[] = [];

  function visit(
    node: CanonicalNode,
    parentId: string | null,
    scope: PanelScope,
  ): void {
    const nextScope = getNodeScope(node, scope);
    const panelNode = toPanelNode(node, parentId, nextScope);
    const nextParentId = panelNode?.id ?? parentId;
    if (panelNode) nodes.push(panelNode);

    node.children?.forEach((child) => {
      visit(child, nextParentId, nextScope);
    });
    getCanonicalPageRefDescendantChildren(node).forEach((children) => {
      children.forEach((child) => {
        visit(child, nextParentId, nextScope);
      });
    });
  }

  doc.children.forEach((child) => {
    visit(child, null, ROOT_SCOPE);
  });

  return nodes;
}

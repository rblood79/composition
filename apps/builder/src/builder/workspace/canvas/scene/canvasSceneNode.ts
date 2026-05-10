import type {
  CanonicalNode,
  CompositionDocument,
  DescendantOverride,
  RefNode,
} from "@composition/shared";

import { readLegacyMetadataCustomId } from "../../../../adapters/canonical/legacyMetadata";
import type { PageElementIndex } from "../../../stores/utils/elementIndexer";

type SceneScopeContext = {
  pageId: string | null;
  layoutId: string | null;
};

type SceneScopeMetadata = {
  customId?: unknown;
  type?: unknown;
  pageId?: unknown;
  layoutId?: unknown;
  slotName?: unknown;
};

export interface CanvasSceneNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  parentId: string | null;
  pageId: string | null;
  layoutId: string | null;
  /**
   * @deprecated ADR-126 transition alias. Prefer `parentId` in new Skia code.
   */
  parent_id?: string | null;
  /**
   * @deprecated ADR-126 transition alias. Prefer `pageId` in new Skia code.
   */
  page_id?: string | null;
  /**
   * Canonical scene nodes are omitted instead of marked deleted. Legacy
   * bootstrap adapters may still pass falsey deleted markers during transition.
   */
  deleted?: boolean;
  customId?: string;
  /**
   * @deprecated ADR-126 transition alias. Prefer `name`.
   */
  componentName?: string;
  name?: string;
  metadata?: CanonicalNode["metadata"];
  reusable?: true;
  ref?: string;
  descendants?: Record<string, DescendantOverride>;
  slot?: false | string[];
  sourceNode: CanonicalNode;
}

export interface CanvasSceneGraph {
  childrenByParent: Map<string, CanvasSceneNode[]>;
  nodes: CanvasSceneNode[];
  nodesMap: Map<string, CanvasSceneNode>;
  parentById: Map<string, string>;
}

const ROOT_SCOPE: SceneScopeContext = {
  pageId: null,
  layoutId: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPagePlaceholderNode(node: CanonicalNode): boolean {
  const metadata = node.metadata as SceneScopeMetadata | undefined;
  return metadata?.type === "page" || metadata?.type === "legacy-page";
}

function getNodeScope(
  node: CanonicalNode,
  scope: SceneScopeContext,
): SceneScopeContext {
  const metadata = node.metadata as SceneScopeMetadata | undefined;
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

function toCanvasSceneNode(
  node: CanonicalNode,
  parentId: string | null,
  scope: SceneScopeContext,
): CanvasSceneNode | null {
  const metadata = node.metadata as SceneScopeMetadata | undefined;
  const isLegacySlotHoisted = metadata?.type === "legacy-slot-hoisted";
  const isRenderableRef = node.type === "ref" && !isPagePlaceholderNode(node);
  if (!node.props && !isLegacySlotHoisted && !isRenderableRef) return null;

  const props = { ...(node.props ?? {}) };
  if (isLegacySlotHoisted && typeof metadata?.slotName === "string") {
    props.name ??= metadata.slotName;
  }

  const customId = readLegacyMetadataCustomId(metadata);
  const sceneNode: CanvasSceneNode = {
    id: node.id,
    type: isLegacySlotHoisted ? "Slot" : node.type,
    props,
    parentId,
    pageId: scope.pageId,
    layoutId: scope.layoutId,
    parent_id: parentId,
    page_id: scope.pageId,
    ...(customId ? { customId } : {}),
    ...(node.name !== undefined ? { name: node.name } : {}),
    ...(node.name !== undefined ? { componentName: node.name } : {}),
    ...(node.metadata ? { metadata: node.metadata } : {}),
    sourceNode: node,
  };

  if (node.reusable === true) sceneNode.reusable = true;
  if (node.slot === false || Array.isArray(node.slot)) {
    sceneNode.slot = node.slot;
  }
  if (node.type === "ref") {
    const refNode = node as RefNode;
    sceneNode.ref = refNode.ref;
    if (isRecord(refNode.descendants)) {
      sceneNode.descendants = refNode.descendants;
    }
  }

  return sceneNode;
}

export function buildCanvasSceneGraph(
  doc: CompositionDocument,
): CanvasSceneGraph {
  const nodes: CanvasSceneNode[] = [];
  const nodesMap = new Map<string, CanvasSceneNode>();
  const childrenByParent = new Map<string, CanvasSceneNode[]>();
  const parentById = new Map<string, string>();

  function visit(
    node: CanonicalNode,
    parentSceneId: string | null,
    scope: SceneScopeContext,
  ): void {
    const nextScope = getNodeScope(node, scope);
    const sceneNode = toCanvasSceneNode(node, parentSceneId, nextScope);
    const nextParentId = sceneNode?.id ?? parentSceneId;

    if (sceneNode) {
      nodes.push(sceneNode);
      nodesMap.set(sceneNode.id, sceneNode);
      if (sceneNode.parentId) {
        parentById.set(sceneNode.id, sceneNode.parentId);
        const children = childrenByParent.get(sceneNode.parentId);
        if (children) {
          children.push(sceneNode);
        } else {
          childrenByParent.set(sceneNode.parentId, [sceneNode]);
        }
      }
    }

    node.children?.forEach((child) => {
      visit(child, nextParentId, nextScope);
    });
  }

  doc.children.forEach((child) => {
    visit(child, null, ROOT_SCOPE);
  });

  return {
    childrenByParent,
    nodes,
    nodesMap,
    parentById,
  };
}

export function buildCanvasScenePageIndex(
  graph: CanvasSceneGraph,
): PageElementIndex {
  const elementsByPage = new Map<string, Set<string>>();
  const rootsByPage = new Map<string, string[]>();

  for (const node of graph.nodes) {
    if (!node.pageId) continue;

    let elements = elementsByPage.get(node.pageId);
    if (!elements) {
      elements = new Set();
      elementsByPage.set(node.pageId, elements);
    }
    elements.add(node.id);

    const parent = node.parentId ? graph.nodesMap.get(node.parentId) : null;
    const parentIsBody = parent?.type.toLowerCase() === "body";
    if (!node.parentId || parentIsBody) {
      let roots = rootsByPage.get(node.pageId);
      if (!roots) {
        roots = [];
        rootsByPage.set(node.pageId, roots);
      }
      if (!roots.includes(node.id)) roots.push(node.id);
    }
  }

  return {
    elementsByPage,
    rootsByPage,
  };
}

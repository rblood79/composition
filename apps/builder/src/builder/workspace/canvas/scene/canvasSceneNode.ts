import type {
  CanonicalNode,
  CompositionDocument,
  DescendantOverride,
  RefNode,
} from "@composition/shared";

import { readLegacyMetadataCustomId } from "../../../../adapters/canonical/legacyMetadata";
import type { PageElementIndex } from "../../../stores/utils/elementIndexer";
import { normalizeFrameLayoutId } from "../../../../adapters/canonical/frameMirror";
import {
  detectListBoxAuthoringMode,
  getListBoxItemSlotRole,
  isListBoxTemplateAnchor,
  LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
  LISTBOX_ORIGIN_ID,
} from "../../../components/listbox/listBoxTemplateOrigins";
import {
  getListBoxProjectionRows,
  type ListBoxCollectionDataSource,
  type ListBoxProjectionRow,
} from "../../../components/listbox/listBoxRowProjectionModel";
import {
  toListBoxRowProjectionId,
  toListBoxRowsGroupProjectionId,
  toCollectionRowProjectionId,
  toCollectionRowsGroupProjectionId,
} from "../../../projection/renderProjectionIds";
import { getElementDataBinding } from "../../../../adapters/canonical/compositionExtensionFields";

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
  originRef?: unknown;
  templateRole?: unknown;
};

export type CanvasProjectionMetadata =
  | {
      kind: "page-frame-element";
      pageId: string;
      sourceElementId: string;
      renderElementId: string;
      renderParentId: string | null;
      canonicalParentId: string | null;
      slotName?: string;
      descendantPath?: string;
    }
  | {
      kind: "page-slot-fill";
      pageId: string;
      sourceElementId: string;
      renderElementId: string;
      renderParentId: string;
      canonicalParentId: string | null;
      slotName: string;
      descendantPath: string;
    }
  | {
      kind: "listbox-rows";
      listBoxId: string;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  | {
      kind: "listbox-row";
      listBoxId: string;
      itemKey: string;
      rowIndex: number;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  // ADR-912 단계 4 C1 (GridList projection): listbox-row/rows 동형 메타.
  //   `listBoxId` 는 collection owner id 의미로 일반화(GridList node id). GridList 는 origin/anchor
  //   인프라 부재(factory children:[])라 templateAnchorId/templateOriginId 는 항상 null.
  //   downstream(write-target/interaction) 은 generic helper `isCollectionRowProjectionKind` 로
  //   listbox/gridlist 를 같은 handler 로 처리(본문 복제 0, OR 판정만 단일 진입점).
  | {
      kind: "gridlist-rows";
      listBoxId: string;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  | {
      kind: "gridlist-row";
      listBoxId: string;
      itemKey: string;
      rowIndex: number;
      templateAnchorId: string | null;
      templateOriginId: string | null;
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
   * @deprecated ADR-126 transition alias. Prefer `layoutId` in new Skia code.
   */
  layout_id?: string | null;
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
  projection?: CanvasProjectionMetadata;
  ref?: string;
  descendants?: Record<string, DescendantOverride>;
  slot?: false | string[];
  sourceNode: CanonicalNode;
}

interface BuildCanvasSceneGraphOptions {
  collections?: readonly ListBoxCollectionDataSource[];
  includeReusableFrames?: boolean;
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

function isCanonicalNode(value: unknown): value is CanonicalNode {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { id?: unknown; type?: unknown };
  return typeof candidate.id === "string" && typeof candidate.type === "string";
}

function withDisplayNoneStyle(
  props: Record<string, unknown>,
): Record<string, unknown> {
  const style = isRecord(props.style) ? props.style : {};
  return {
    ...props,
    style: {
      ...style,
      display: "none",
    },
  };
}

function readDescendantChildren(override: unknown): CanonicalNode[] {
  if (!override || typeof override !== "object") return [];
  if (isCanonicalNode(override)) return [override];

  const children = (override as { children?: unknown }).children;
  if (!Array.isArray(children)) return [];
  return children.filter(isCanonicalNode);
}

function getRefDescendantChildren(node: CanonicalNode): CanonicalNode[][] {
  if (node.type !== "ref") return [];
  const metadata = node.metadata as SceneScopeMetadata | undefined;
  if (metadata?.type !== "page" && metadata?.type !== "legacy-page") return [];

  const descendants = (node as RefNode).descendants ?? {};
  return Object.values(descendants)
    .map(readDescendantChildren)
    .filter((children) => children.length > 0);
}

/**
 * ADR-147 Layer 3: 문서 전체를 id→node 로 평탄화. data-bound projection 행이
 * resolved origin(template ref 의 master) style 을 참조하기 위한 lookup.
 */
function flattenDocumentNodes(
  nodes: readonly CanonicalNode[],
  map: Map<string, CanonicalNode> = new Map(),
): Map<string, CanonicalNode> {
  for (const node of nodes) {
    map.set(node.id, node);
    if (Array.isArray(node.children)) flattenDocumentNodes(node.children, map);
  }
  return map;
}

function isPagePlaceholderNode(node: CanonicalNode): boolean {
  const metadata = node.metadata as SceneScopeMetadata | undefined;
  const isPageMeta =
    metadata?.type === "page" || metadata?.type === "legacy-page";
  const isBoundRef =
    node.type === "ref" && typeof metadata?.layoutId === "string";
  return isPageMeta && !isBoundRef;
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
    node.type === "ref" &&
    typeof metadata?.layoutId === "string" &&
    (metadata?.type === "page" || metadata?.type === "legacy-page")
  ) {
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

function toCanvasSceneNode(
  node: CanonicalNode,
  parentId: string | null,
  scope: SceneScopeContext,
  includeReusableFrames: boolean,
): CanvasSceneNode | null {
  const metadata = node.metadata as SceneScopeMetadata | undefined;
  const isLegacySlotHoisted = metadata?.type === "legacy-slot-hoisted";
  const isRenderableRef = node.type === "ref" && !isPagePlaceholderNode(node);
  const isReusableFrame =
    node.type === "frame" && node.reusable === true && includeReusableFrames;
  if (
    !node.props &&
    !isLegacySlotHoisted &&
    !isRenderableRef &&
    !isReusableFrame
  ) {
    return null;
  }

  let props = { ...(node.props ?? {}) };
  if (isLegacySlotHoisted && typeof metadata?.slotName === "string") {
    props.name ??= metadata.slotName;
  }
  if (isListBoxTemplateAnchor(node)) {
    props = withDisplayNoneStyle(props);
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
    layout_id: scope.layoutId,
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

function addSceneNode(
  node: CanvasSceneNode,
  graph: Pick<CanvasSceneGraph, "childrenByParent" | "nodes" | "nodesMap"> & {
    parentById: Map<string, string>;
  },
): void {
  graph.nodes.push(node);
  graph.nodesMap.set(node.id, node);
  if (!node.parentId) return;

  graph.parentById.set(node.id, node.parentId);
  const children = graph.childrenByParent.get(node.parentId);
  if (children) {
    children.push(node);
  } else {
    graph.childrenByParent.set(node.parentId, [node]);
  }
}

function getListBoxTemplateAnchor(
  children: readonly CanonicalNode[] | undefined,
): CanonicalNode | null {
  const anchor = children?.find(
    (child) => isListBoxTemplateAnchor(child) || child.type === "ref",
  );
  return anchor ?? null;
}

function getTemplateOriginId(anchor: CanonicalNode | null): string | null {
  if (!anchor) return null;
  if (anchor.type === "ref") return (anchor as RefNode).ref;
  const metadata = anchor.metadata as SceneScopeMetadata | undefined;
  return typeof metadata?.originRef === "string" ? metadata.originRef : null;
}

/**
 * 행 projection 의 template origin id 를 해석한다 (Option B — anchor-less 정합).
 *
 * 우선순위:
 *   1. in-instance template anchor (아직 migration 되지 않은 legacy instance) — 그 ref/originRef.
 *   2. anchor-less: ListBox instance 가 ref(component-listbox) 면 master component 의
 *      slot[0] = default ListBoxItem origin 에서 해석 (component 정의의 slot 에서 행 template 해석).
 *   3. 안전망: 표준 default origin 상수.
 *
 * **Why**: ADR-146 in-instance anchor 를 제거(Option B)해도 data-bound 행이 Components 페이지의
 *   origin ListBoxItem style(height/padding 등)을 동일하게 상속하도록 단일 진입점을 유지한다.
 */
function resolveListBoxTemplateOriginId(
  sourceNode: CanonicalNode,
  templateAnchor: CanonicalNode | null,
  getDocumentNodesById: () => Map<string, CanonicalNode>,
): string | null {
  const anchorOriginId = getTemplateOriginId(templateAnchor);
  if (anchorOriginId) return anchorOriginId;

  if (sourceNode.type === "ref") {
    const masterId = (sourceNode as RefNode).ref;
    const slot = getDocumentNodesById().get(masterId)?.slot;
    if (Array.isArray(slot) && typeof slot[0] === "string") return slot[0];
  }

  return LISTBOX_ITEM_DEFAULT_ORIGIN_ID;
}

function isListBoxSceneSource(
  listBoxSceneNode: CanvasSceneNode,
  sourceNode: CanonicalNode,
): boolean {
  if (listBoxSceneNode.type === "ListBox") return true;
  if (sourceNode.type !== "ref") return false;
  const refNode = sourceNode as RefNode;
  return (
    refNode.ref === LISTBOX_ORIGIN_ID ||
    listBoxSceneNode.ref === LISTBOX_ORIGIN_ID ||
    listBoxSceneNode.componentName === "ListBox" ||
    listBoxSceneNode.name === "ListBox"
  );
}

function isListBoxRowSelected(
  props: Record<string, unknown>,
  itemKey: string,
  rowIndex: number,
): boolean {
  const selectedKeys = props.selectedKeys;
  if (Array.isArray(selectedKeys)) {
    return selectedKeys.includes(itemKey);
  }
  if (props.selectedKey === itemKey) return true;

  const selectedIndices = props.selectedIndices;
  if (Array.isArray(selectedIndices)) {
    return selectedIndices.includes(rowIndex);
  }
  return props.selectedIndex === rowIndex;
}

/**
 * data-bound ListBox 의 projection 결정(gating)을 단일 소스로 계산.
 *
 * visit 의 anchor suppression 과 appendListBoxRowProjection 이 **동일 판정**을 공유해야
 * (data-bound + rows>0) anchor 제외와 행 projection 이 lockstep 으로 동작한다. 두 곳이
 * 따로 판정하면 anchor 만 사라지고 행은 안 그려지는(빈 ListBox) drift 가 생긴다.
 */
function resolveDataBoundListBoxProjection(
  listBoxSceneNode: CanvasSceneNode,
  sourceNode: CanonicalNode,
  options: BuildCanvasSceneGraphOptions,
): {
  rows: ListBoxProjectionRow[];
  templateAnchor: CanonicalNode | null;
  sourceNode: CanonicalNode;
} | null {
  if (!isListBoxSceneSource(listBoxSceneNode, sourceNode)) return null;

  const dataBinding = getElementDataBinding(sourceNode);
  const mode = detectListBoxAuthoringMode({
    children: sourceNode.children?.map((child) => ({
      id: child.id,
      ref: child.type === "ref" ? (child as RefNode).ref : undefined,
      type: child.type,
    })),
    dataBinding,
    props: listBoxSceneNode.props,
  });
  if (mode.mode !== "data-bound") return null;

  const rows = getListBoxProjectionRows({
    collections: options.collections,
    dataBinding,
    props: listBoxSceneNode.props,
  });
  if (rows.length === 0) return null;

  return {
    rows,
    templateAnchor: getListBoxTemplateAnchor(sourceNode.children),
    sourceNode,
  };
}

function appendListBoxRowProjection(
  listBoxSceneNode: CanvasSceneNode,
  projection: {
    rows: ListBoxProjectionRow[];
    templateAnchor: CanonicalNode | null;
    sourceNode: CanonicalNode;
  },
  scope: SceneScopeContext,
  graph: Pick<CanvasSceneGraph, "childrenByParent" | "nodes" | "nodesMap"> & {
    parentById: Map<string, string>;
  },
  getDocumentNodesById: () => Map<string, CanonicalNode>,
): void {
  const props = listBoxSceneNode.props;
  const { rows, templateAnchor, sourceNode } = projection;
  const templateAnchorId = templateAnchor?.id ?? null;
  const templateOriginId = resolveListBoxTemplateOriginId(
    sourceNode,
    templateAnchor,
    getDocumentNodesById,
  );
  // ADR-147 Layer 3: projected 행 style = resolved origin(template ref master) style ◁ anchor override.
  //   사용자가 Components 페이지의 origin ListBoxItem 에 준 style(height/padding 등)이 instance 행에
  //   반영되어야 한다. anchor 는 raw ref(style 없음)일 수 있으므로 origin master 의 props.style 을 base 로,
  //   anchor 자체 override(있으면)를 위에 merge 한다. width 는 항상 100% (행 폭 고정).
  const originStyle = templateOriginId
    ? ((getDocumentNodesById().get(templateOriginId)?.props?.style as
        | Record<string, unknown>
        | undefined) ?? {})
    : {};
  const anchorStyle =
    (templateAnchor?.props?.style as Record<string, unknown> | undefined) ?? {};
  const templateAnchorStyle = { ...originStyle, ...anchorStyle };
  const rowsGroupId = toListBoxRowsGroupProjectionId(listBoxSceneNode.id);
  const rowsGroup: CanvasSceneNode = {
    id: rowsGroupId,
    type: "Rows",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 0,
        width: "100%",
      },
    },
    parentId: listBoxSceneNode.id,
    pageId: scope.pageId,
    layoutId: scope.layoutId,
    parent_id: listBoxSceneNode.id,
    page_id: scope.pageId,
    layout_id: scope.layoutId,
    projection: {
      kind: "listbox-rows",
      listBoxId: listBoxSceneNode.id,
      templateAnchorId,
      templateOriginId,
    },
    sourceNode: templateAnchor ?? sourceNode,
  };
  addSceneNode(rowsGroup, graph);

  for (const row of rows) {
    const projectionId = toListBoxRowProjectionId(
      listBoxSceneNode.id,
      row.itemKey,
    );
    const rowProps: Record<string, unknown> = {
      children: row.label,
      description: row.description ?? "",
      textValue: row.label,
      // ADR-147: anchor layout style overlay. width 는 항상 100% (list 행 폭 고정).
      style: { ...templateAnchorStyle, width: "100%" },
      _isSelected: isListBoxRowSelected(props, row.itemKey, row.rowIndex),
    };
    if (row.value) rowProps.value = row.value;
    if (row.icon) rowProps.icon = row.icon; // ADR-147: icon slot
    if (row.isDisabled) rowProps.isDisabled = true;

    addSceneNode(
      {
        id: projectionId,
        type: "ListBoxItem",
        props: rowProps,
        parentId: rowsGroupId,
        pageId: scope.pageId,
        layoutId: scope.layoutId,
        parent_id: rowsGroupId,
        page_id: scope.pageId,
        layout_id: scope.layoutId,
        projection: {
          kind: "listbox-row",
          listBoxId: listBoxSceneNode.id,
          itemKey: row.itemKey,
          rowIndex: row.rowIndex,
          templateAnchorId,
          templateOriginId,
        },
        // ADR-147 (이중 렌더 방지): projection 행은 render.shapes 로 데이터를 자체 렌더한다.
        //   canonical `ref` 를 두면 resolveCanonicalRefTree 가 origin(component-listbox-item-*)
        //   의 composed children({label}/{description} placeholder)을 행마다 확장하여
        //   데이터 위에 겹쳐 그린다. origin 참조는 projection.templateOriginId 로 보존.
        sourceNode: templateAnchor ?? sourceNode,
      },
      graph,
    );
  }
}

// ---------------------------------------------------------------------------
// ADR-912 단계 4 C1 — GridList projection (origin/anchor 없는 단순 경로)
// ---------------------------------------------------------------------------

/**
 * GridList scene node 판정 — GridList 컴포넌트(또는 그 ref instance).
 * GridList 는 origin 인프라(ensureGridListTemplateOrigins) 부재 + factory children:[] 이므로
 * ListBox 보다 단순(authoring mode / template anchor 개념 없음).
 */
function isGridListSceneSource(
  gridListSceneNode: CanvasSceneNode,
  sourceNode: CanonicalNode,
): boolean {
  if (gridListSceneNode.type === "GridList") return true;
  if (sourceNode.type === "ref") return false;
  return (
    gridListSceneNode.componentName === "GridList" ||
    gridListSceneNode.name === "GridList"
  );
}

/**
 * data-bound GridList 의 projection rows 계산 (gating). GridList 는 section 지원(props.items
 * StoredGridListEntry[] = section + item 혼합)이나 1차 C1 발효는 **flat item row** 만 projection
 * 한다(section header projected node 는 후행 — getFlatProjectionRows kind:'item' 만). rows 0개면
 * null → 발효 전 standalone render.shapes 유지(회귀 0).
 */
function resolveDataBoundGridListProjection(
  gridListSceneNode: CanvasSceneNode,
  sourceNode: CanonicalNode,
  options: BuildCanvasSceneGraphOptions,
): { rows: ListBoxProjectionRow[]; sourceNode: CanonicalNode } | null {
  if (!isGridListSceneSource(gridListSceneNode, sourceNode)) return null;

  const dataBinding = getElementDataBinding(sourceNode);
  const rows = getListBoxProjectionRows({
    collections: options.collections,
    dataBinding,
    props: gridListSceneNode.props,
  });
  if (rows.length === 0) return null;

  return { rows, sourceNode };
}

/**
 * GridList projected rows-group + 카드(GridListItem) projected node 생성.
 *
 * ListBox 대비 단순: origin/anchor 인프라 없음(templateAnchorId/templateOriginId = null) →
 * projected GridListItem 은 row 데이터(label/description/value)만 props 로 받아 GridListItem.spec.
 * render.shapes 가 카드를 자체 렌더(step1). rowsGroup 은 GridList 의 layout(grid/stack) + columns
 * 를 flex 로 반영하여 카드가 grid 배치되게 한다(배치는 Taffy layout 담당).
 */
function appendGridListRowProjection(
  gridListSceneNode: CanvasSceneNode,
  projection: { rows: ListBoxProjectionRow[]; sourceNode: CanonicalNode },
  scope: SceneScopeContext,
  graph: Pick<CanvasSceneGraph, "childrenByParent" | "nodes" | "nodesMap"> & {
    parentById: Map<string, string>;
  },
): void {
  const props = gridListSceneNode.props;
  const { rows, sourceNode } = projection;
  const layout = (props.layout as string) ?? "stack";
  const numCols =
    layout === "grid" ? Math.max(1, Number(props.columns) || 2) : 1;
  const gap = typeof props.gap === "number" ? (props.gap as number) : 12;

  const rowsGroupId = toCollectionRowsGroupProjectionId(
    "gridlist",
    gridListSceneNode.id,
  );
  const rowsGroup: CanvasSceneNode = {
    id: rowsGroupId,
    type: "Rows",
    props: {
      style: {
        display: "flex",
        flexDirection: layout === "grid" ? "row" : "column",
        flexWrap: layout === "grid" ? "wrap" : "nowrap",
        rowGap: gap,
        columnGap: gap,
        width: "100%",
      },
    },
    parentId: gridListSceneNode.id,
    pageId: scope.pageId,
    layoutId: scope.layoutId,
    parent_id: gridListSceneNode.id,
    page_id: scope.pageId,
    layout_id: scope.layoutId,
    projection: {
      kind: "gridlist-rows",
      listBoxId: gridListSceneNode.id,
      templateAnchorId: null,
      templateOriginId: null,
    },
    sourceNode,
  };
  addSceneNode(rowsGroup, graph);

  // grid 모드 카드 폭: (100% - gap*(numCols-1)) / numCols. stack 은 100%.
  const cardWidthStyle =
    layout === "grid" && numCols > 1
      ? `calc((100% - ${gap * (numCols - 1)}px) / ${numCols})`
      : "100%";

  for (const row of rows) {
    const projectionId = toCollectionRowProjectionId(
      "gridlist",
      gridListSceneNode.id,
      row.itemKey,
    );
    const rowProps: Record<string, unknown> = {
      children: row.label,
      description: row.description ?? "",
      textValue: row.label,
      style: { width: cardWidthStyle },
      _isSelected: isListBoxRowSelected(props, row.itemKey, row.rowIndex),
    };
    if (row.value) rowProps.value = row.value;
    if (row.isDisabled) rowProps.isDisabled = true;

    addSceneNode(
      {
        id: projectionId,
        type: "GridListItem",
        props: rowProps,
        parentId: rowsGroupId,
        pageId: scope.pageId,
        layoutId: scope.layoutId,
        parent_id: rowsGroupId,
        page_id: scope.pageId,
        layout_id: scope.layoutId,
        projection: {
          kind: "gridlist-row",
          listBoxId: gridListSceneNode.id,
          itemKey: row.itemKey,
          rowIndex: row.rowIndex,
          templateAnchorId: null,
          templateOriginId: null,
        },
        sourceNode,
      },
      graph,
    );
  }
}

export function buildCanvasSceneGraph(
  doc: CompositionDocument,
  options: BuildCanvasSceneGraphOptions = {},
): CanvasSceneGraph {
  const nodes: CanvasSceneNode[] = [];
  const nodesMap = new Map<string, CanvasSceneNode>();
  const childrenByParent = new Map<string, CanvasSceneNode[]>();
  const parentById = new Map<string, string>();
  const { includeReusableFrames = false } = options;
  const graph = { childrenByParent, nodes, nodesMap, parentById };
  // ADR-147 Layer 3: origin(template ref master) style lookup 용 문서 평탄화.
  //   data-bound ListBox(+origin id) 가 실제 projection 될 때만 1회 build (lazy) —
  //   data-bound ListBox 없는 페이지는 전체 트리 walk 자체를 skip.
  let documentNodesById: Map<string, CanonicalNode> | null = null;
  const getDocumentNodesById = (): Map<string, CanonicalNode> => {
    if (documentNodesById === null) {
      documentNodesById = flattenDocumentNodes(doc.children);
    }
    return documentNodesById;
  };

  function visit(
    node: CanonicalNode,
    parentSceneId: string | null,
    scope: SceneScopeContext,
  ): void {
    const nextScope = getNodeScope(node, scope);
    const sceneNode = toCanvasSceneNode(
      node,
      parentSceneId,
      nextScope,
      includeReusableFrames,
    );
    const nextParentId = sceneNode?.id ?? parentSceneId;

    if (sceneNode) {
      addSceneNode(sceneNode, graph);
    }

    // ADR-147 (이중 렌더 방지): data-bound ListBox 는 projection 이 행을 렌더하므로
    //   template anchor(및 origin composed children placeholder)는 가시 scene 에서 제외.
    //   동일 projection 판정을 suppression 과 append 가 공유한다.
    const listBoxProjection = sceneNode
      ? resolveDataBoundListBoxProjection(sceneNode, node, options)
      : null;
    const suppressedAnchorId = listBoxProjection?.templateAnchor?.id ?? null;

    // ADR-912 단계 4 C1: data-bound GridList projection (origin/anchor 없음 → suppression no-op).
    //   GridList factory children:[] 이라 가시 scene 에서 제외할 자식 없음 — append 만.
    const gridListProjection = sceneNode
      ? resolveDataBoundGridListProjection(sceneNode, node, options)
      : null;

    node.children?.forEach((child) => {
      if (suppressedAnchorId && child.id === suppressedAnchorId) return;
      // ADR-147 (RAC 표준): ListBoxItem 의 slot 조합 자식(Icon/Label/Description)은
      //   render.shapes 가 단일 렌더러로 그리므로 가시 scene 에서 제외(세로 stacked 중복 방지).
      if (
        node.type === "ListBoxItem" &&
        getListBoxItemSlotRole(child) != null
      ) {
        return;
      }
      visit(child, nextParentId, nextScope);
    });
    getRefDescendantChildren(node).forEach((children) => {
      children.forEach((child) => {
        visit(child, nextParentId, nextScope);
      });
    });
    if (sceneNode && listBoxProjection) {
      appendListBoxRowProjection(
        sceneNode,
        listBoxProjection,
        nextScope,
        graph,
        getDocumentNodesById,
      );
    }
    if (sceneNode && gridListProjection) {
      appendGridListRowProjection(
        sceneNode,
        gridListProjection,
        nextScope,
        graph,
      );
    }
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

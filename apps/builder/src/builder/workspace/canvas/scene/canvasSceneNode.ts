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
  getTableProjectionRows,
  type TableColumnDef,
  type TableProjectionRow,
} from "../../../components/collection/collectionRowProjectionModel";
import {
  toListBoxRowProjectionId,
  toListBoxRowsGroupProjectionId,
  toCollectionRowProjectionId,
  toCollectionRowsGroupProjectionId,
  toCollectionCellProjectionId,
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
    }
  // ADR-912 단계 4 C1 (Table 2D projection): RowsGroup → Row[i] → Cell[i][j] 2D.
  //   listbox/gridlist 의 row 1단 대비 cell 차원이 추가됨(table-cell). `listBoxId` 는
  //   collection owner(Table node id)로 의미 일반화. table-rows/row 는 downstream generic
  //   helper(isCollectionRow(sGroup)ProjectionKind) 가 listbox/gridlist 와 같은 handler 로
  //   처리, table-cell 은 columnId write-target 라우팅을 위해 별도 kind.
  | {
      kind: "table-rows";
      listBoxId: string;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  | {
      kind: "table-row";
      listBoxId: string;
      itemKey: string;
      rowIndex: number;
      isHeader: boolean;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  | {
      kind: "table-cell";
      listBoxId: string;
      itemKey: string;
      rowIndex: number;
      columnId: string;
      isHeader: boolean;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  // ADR-912 영역 B (A) — TagGroup chip projection: chip = collection row 동형(1단 row).
  //   listbox/gridlist row 와 동형 메타(listBoxId=collection owner=TagList scene node id /
  //   itemKey / rowIndex). origin/anchor 인프라 부재(TagGroup factory TagList children:[],
  //   items propagation) → templateAnchorId/templateOriginId 항상 null(GridList 동형).
  //   chip 본체(tag-row)는 deep hit 시 owner(TagGroup) select redirect.
  | {
      kind: "tag-rows";
      listBoxId: string;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  | {
      kind: "tag-row";
      listBoxId: string;
      itemKey: string;
      rowIndex: number;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  // ADR-912 영역 B (A) — TabList tab projection: tab = collection row 동형(1단 row).
  //   tag-row 와 동형 메타(listBoxId=collection owner=TabList scene node id / itemKey / rowIndex).
  //   items SSOT(Tabs.props.items → propagation → TabList.props.items) → templateAnchorId/
  //   templateOriginId 항상 null(GridList/Tag 동형). tab 본체(tab-row)는 deep hit 시 owner(Tabs)
  //   select redirect. 이전 implicitStyles virtual Tab(layout-synthetic)을 render-space 로 이전.
  | {
      kind: "tab-rows";
      listBoxId: string;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  | {
      kind: "tab-row";
      listBoxId: string;
      itemKey: string;
      rowIndex: number;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  | {
      kind: "breadcrumb-rows";
      listBoxId: string;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  | {
      kind: "breadcrumb-row";
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

// ── Table 2D projection (ADR-912 단계 4 C1, 사용자 결정 "행 단위 셀 노드") ──────────────
//
// GridList(row 1단) 대비 cell 차원 추가: RowsGroup → Row[i] → Cell[i][j]. header 행 1개 +
// data 행 N개(window). Row 는 bg(striped/selected)+divider self-render(TableRow.spec), Cell 은
// text-only(TableCell.spec). 배치(컬럼 폭 누적)는 Taffy flex row 가 담당.

function isTableSceneSource(
  tableSceneNode: CanvasSceneNode,
  sourceNode: CanonicalNode,
): boolean {
  if (tableSceneNode.type === "Table") return true;
  if (sourceNode.type === "ref") return false;
  return (
    tableSceneNode.componentName === "Table" || tableSceneNode.name === "Table"
  );
}

/**
 * data-bound Table 의 projection rows + columns 계산 (gating).
 *
 * getTableProjectionRows(collections/dataBinding/props.rows) → header 1행 + data N행(cells 차원).
 * data 행이 0개여도 header + sample fallback 으로 항상 행이 있으므로(spec 동형), rows 가 비면
 * (이론상 없음) null → standalone render.shapes 유지.
 */
function resolveDataBoundTableProjection(
  tableSceneNode: CanvasSceneNode,
  sourceNode: CanonicalNode,
  options: BuildCanvasSceneGraphOptions,
): {
  columns: TableColumnDef[];
  rows: TableProjectionRow[];
  sourceNode: CanonicalNode;
} | null {
  if (!isTableSceneSource(tableSceneNode, sourceNode)) return null;

  const dataBinding = getElementDataBinding(sourceNode);
  const { columns, rows } = getTableProjectionRows({
    collections: options.collections,
    dataBinding,
    props: tableSceneNode.props,
  });
  // data 행(header 제외)이 하나도 없으면 projection 의미 없음 → standalone 유지.
  if (rows.filter((r) => r.kind === "data").length === 0) return null;

  return { columns, rows, sourceNode };
}

/** Table size prop → TableRow/TableCell size (sm/md/lg). 기본 md. */
function readTableSize(props: Record<string, unknown>): "sm" | "md" | "lg" {
  const size = props.size;
  return size === "sm" || size === "lg" ? size : "md";
}

/**
 * Table projected 2D tree 생성: RowsGroup → Row[i] → Cell[i][j].
 *
 * - rowsGroup: 세로 stack(flex column) — header 행 + data 행을 위→아래로.
 * - Row: 가로 flex row(TableRow.spec containerStyles) — bg/divider self-render + 셀 자식 배치.
 * - Cell: text-only(TableCell.spec) — 컬럼 폭 고정(flex-basis). striped 는 row 의 _striped 로 전파.
 */
function appendTableRowProjection(
  tableSceneNode: CanvasSceneNode,
  projection: {
    columns: TableColumnDef[];
    rows: TableProjectionRow[];
    sourceNode: CanonicalNode;
  },
  scope: SceneScopeContext,
  graph: Pick<CanvasSceneGraph, "childrenByParent" | "nodes" | "nodesMap"> & {
    parentById: Map<string, string>;
  },
): void {
  const { columns, rows, sourceNode } = projection;
  const props = tableSceneNode.props;
  const size = readTableSize(props);
  const totalWidth = columns.reduce((sum, col) => sum + col.width, 0) || 360;
  const variant = props.variant;
  const isStripedVariant = variant === "striped";

  const rowsGroupId = toCollectionRowsGroupProjectionId(
    "table",
    tableSceneNode.id,
  );
  const rowsGroup: CanvasSceneNode = {
    id: rowsGroupId,
    type: "Rows",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: totalWidth,
      },
    },
    parentId: tableSceneNode.id,
    pageId: scope.pageId,
    layoutId: scope.layoutId,
    parent_id: tableSceneNode.id,
    page_id: scope.pageId,
    layout_id: scope.layoutId,
    projection: {
      kind: "table-rows",
      listBoxId: tableSceneNode.id,
      templateAnchorId: null,
      templateOriginId: null,
    },
    sourceNode,
  };
  addSceneNode(rowsGroup, graph);

  for (const row of rows) {
    const isHeader = row.kind === "header";
    // striped: data 행 중 홀수(rowIndex 1,3,...)에 _striped (Table.spec: !isEven → rowIndex%2!==0).
    const striped = isStripedVariant && !isHeader && row.rowIndex % 2 !== 0;

    const rowId = toCollectionRowProjectionId(
      "table",
      tableSceneNode.id,
      row.rowKey,
    );
    addSceneNode(
      {
        id: rowId,
        type: "TableRow",
        props: {
          size,
          _isHeader: isHeader,
          _striped: striped,
          _isSelected: row.isSelected,
          _rowWidth: totalWidth,
          style: { width: totalWidth },
        },
        parentId: rowsGroupId,
        pageId: scope.pageId,
        layoutId: scope.layoutId,
        parent_id: rowsGroupId,
        page_id: scope.pageId,
        layout_id: scope.layoutId,
        projection: {
          kind: "table-row",
          listBoxId: tableSceneNode.id,
          itemKey: row.rowKey,
          rowIndex: row.rowIndex,
          isHeader,
          templateAnchorId: null,
          templateOriginId: null,
        },
        sourceNode,
      },
      graph,
    );

    for (const col of columns) {
      const cellText = isHeader ? col.label : (row.cells[col.id] ?? "");
      const cellId = toCollectionCellProjectionId(
        "table",
        tableSceneNode.id,
        row.rowKey,
        col.id,
      );
      addSceneNode(
        {
          id: cellId,
          type: "TableCell",
          props: {
            size,
            children: cellText,
            _isHeader: isHeader,
            _columnWidth: col.width,
            style: { width: col.width, flexGrow: 0, flexShrink: 0 },
          },
          parentId: rowId,
          pageId: scope.pageId,
          layoutId: scope.layoutId,
          parent_id: rowId,
          page_id: scope.pageId,
          layout_id: scope.layoutId,
          projection: {
            kind: "table-cell",
            listBoxId: tableSceneNode.id,
            itemKey: row.rowKey,
            rowIndex: row.rowIndex,
            columnId: col.id,
            isHeader,
            templateAnchorId: null,
            templateOriginId: null,
          },
          sourceNode,
        },
        graph,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// ADR-912 영역 B (A) — TagGroup chip projection (wrap-flow row family)
// ---------------------------------------------------------------------------
//
// GridList(1단 row, origin/anchor 없음, factory children:[]) 와 동형이되 2점 차이:
//   1) **owner = TagList scene node** (TagGroup 이 아님). TagGroup factory 가 Label + TagList
//      중간 컨테이너를 만들고 items/variant/size/allowsRemoving/maxRows 를 TagList 로 propagate
//      (TagGroup.spec propagation). chip 좌표계 = TagList node — projection 을 TagList 에 붙인다.
//   2) **rowsGroup = flexWrap:"wrap" row** (세로 stack 아닌 가로 wrap-flow). 수동 wrap 시뮬레이션
//      (구 TagList.spec render.shapes 라인 299-333) 폐기 — chip width:fit-content + Taffy
//      flex-wrap 이 행 배치를 담당(GridList grid 모드의 flexWrap 패턴과 동형).
//   3) chip 의 remove(X)는 별도 tag-cell sub-node(deep hit). chip 본체(Tag)는 X 시각 미포함
//      (allowsRemoving 을 chip 에 전달하지 않음) → X 는 cell 이 단독 렌더.

function isTagListSceneSource(
  tagListSceneNode: CanvasSceneNode,
  sourceNode: CanonicalNode,
): boolean {
  if (tagListSceneNode.type === "TagList") return true;
  if (sourceNode.type === "ref") return false;
  return (
    tagListSceneNode.componentName === "TagList" ||
    tagListSceneNode.name === "TagList"
  );
}

/**
 * data-bound TagList 의 projection rows 계산 (gating). items 는 TagGroup.props.items 가
 * propagation 경유로 TagList.props.items 에 전파되어 있다(TagGroup.spec propagation). dataBinding
 * (api/collection) 도 동일 getFlatProjectionRows 3경로로 흡수. rows 0개면 null → 발효 전
 * standalone render.shapes 유지(회귀 0). chip 1개 = 1 row.
 */
function resolveDataBoundTagProjection(
  tagListSceneNode: CanvasSceneNode,
  sourceNode: CanonicalNode,
  options: BuildCanvasSceneGraphOptions,
): { rows: ListBoxProjectionRow[]; sourceNode: CanonicalNode } | null {
  if (!isTagListSceneSource(tagListSceneNode, sourceNode)) return null;

  const dataBinding = getElementDataBinding(sourceNode);
  const rows = getListBoxProjectionRows({
    collections: options.collections,
    dataBinding,
    props: tagListSceneNode.props,
  });
  if (rows.length === 0) return null;

  return { rows, sourceNode };
}

/**
 * TagGroup chip projected tree 생성: RowsGroup(flex wrap row) → Tag chip[i] (+ remove cell).
 *
 * - rowsGroup: 가로 flex row + flexWrap:wrap → chip 들이 컨테이너 폭에서 자동 줄바꿈(Taffy 위임,
 *   수동 wrap 계산 없음). gap = chip 간격(size 토큰 gap, propagation 으로 TagList 좌표계).
 * - chip(Tag): width:fit-content → 라벨 폭 + padding 만큼만. Tag.spec.render.shapes 가 bg/border/
 *   text 자체 렌더(_isSelected → selected variant). allowsRemoving 은 chip 에 전달하지 않음
 *   (X 는 cell 단독 렌더 → chip 본체는 X 미포함, 좌표 단순).
 * - remove cell(tag-cell, role:"remove"): allowsRemoving 시에만. chip 의 자식으로 X(icon_font)만
 *   그리는 별도 hit 노드. 단일클릭은 owner(TagGroup) select redirect, mutation 은 후속(proof scope).
 */
function appendTagRowProjection(
  tagListSceneNode: CanvasSceneNode,
  projection: { rows: ListBoxProjectionRow[]; sourceNode: CanonicalNode },
  scope: SceneScopeContext,
  graph: Pick<CanvasSceneGraph, "childrenByParent" | "nodes" | "nodesMap"> & {
    parentById: Map<string, string>;
  },
): void {
  const props = tagListSceneNode.props;
  const { rows, sourceNode } = projection;
  const allowsRemoving = Boolean(props.allowsRemoving);
  const variant = props.variant;
  const size = props.size;
  const gap = typeof props.gap === "number" ? (props.gap as number) : 4;

  const rowsGroupId = toCollectionRowsGroupProjectionId(
    "tag",
    tagListSceneNode.id,
  );
  const rowsGroup: CanvasSceneNode = {
    id: rowsGroupId,
    type: "Rows",
    props: {
      style: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        rowGap: gap,
        columnGap: gap,
        width: "100%",
        alignItems: "flex-start",
      },
    },
    parentId: tagListSceneNode.id,
    pageId: scope.pageId,
    layoutId: scope.layoutId,
    parent_id: tagListSceneNode.id,
    page_id: scope.pageId,
    layout_id: scope.layoutId,
    projection: {
      kind: "tag-rows",
      listBoxId: tagListSceneNode.id,
      templateAnchorId: null,
      templateOriginId: null,
    },
    sourceNode,
  };
  addSceneNode(rowsGroup, graph);

  for (const row of rows) {
    const chipId = toCollectionRowProjectionId(
      "tag",
      tagListSceneNode.id,
      row.itemKey,
    );
    const chipProps: Record<string, unknown> = {
      children: row.label,
      // chip 폭 = 라벨 + padding (+ allowsRemoving 시 X) — Tag.spec containerStyles inline-flex.
      //   wrap-flow 에서 각 chip 이 fit-content 로 자연 폭을 갖고 Taffy flexWrap 이 행 배치.
      style: { width: "fit-content" },
      _isSelected: isListBoxRowSelected(props, row.itemKey, row.rowIndex),
    };
    if (variant) chipProps.variant = variant;
    if (size) chipProps.size = size;
    if (row.isDisabled) chipProps.isDisabled = true;
    // ADR-912 영역 B (A) proof: X(remove)는 chip 본체(Tag.spec)가 시각으로 그린다(bg+text+X).
    //   독립 hit/remove mutation 은 layout overlay + interaction kind 계약이 필요해 후속 보류
    //   (사용자 결정 2026-06-05). 현 slice 는 chip 1노드 = owner(TagGroup) select redirect 까지.
    if (allowsRemoving) chipProps.allowsRemoving = true;

    addSceneNode(
      {
        id: chipId,
        type: "Tag",
        props: chipProps,
        parentId: rowsGroupId,
        pageId: scope.pageId,
        layoutId: scope.layoutId,
        parent_id: rowsGroupId,
        page_id: scope.pageId,
        layout_id: scope.layoutId,
        projection: {
          kind: "tag-row",
          listBoxId: tagListSceneNode.id,
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

// ---------------------------------------------------------------------------
// ADR-912 영역 B (A) — Tab row projection (TabList 1단 row family)
// ---------------------------------------------------------------------------
//
// TagGroup chip 선례와 동형이되 3점 차이:
//   1) **owner = TabList scene node**. Tabs factory 가 TabList 중간 컨테이너를 만들고
//      items/selectedKey/showIndicator/variant/size 를 TabList 로 propagate (Tabs.spec
//      propagation, ADR-912 단계 1-2). tab 좌표계 = TabList node — projection 을 TabList 에 붙인다.
//   2) **rowsGroup = 한 줄 flex row** (Tag 의 wrap-flow 아님). orientation="vertical" 이면 column.
//      이전 구현(implicitStyles virtual Tab, layout-synthetic 경로)을 render-space projection 으로
//      이전 — TabList.spec.render.shapes 의 구분선(line)은 유지, tab 본체만 projection.
//   3) chip(Tab) 본체는 Tab.spec.render.shapes 가 text + (selected && showIndicator 시) indicator
//      rect 를 그린다. _isSelected(isListBoxRowSelected, selectedKey 단일) + _showIndicator 전달.

function isTabListSceneSource(
  tabListSceneNode: CanvasSceneNode,
  sourceNode: CanonicalNode,
): boolean {
  if (tabListSceneNode.type === "TabList") return true;
  if (sourceNode.type === "ref") return false;
  return (
    tabListSceneNode.componentName === "TabList" ||
    tabListSceneNode.name === "TabList"
  );
}

/**
 * pre-propagation 기존 문서 호환 fallback — owner Tabs 의 props 를 찾는다.
 *
 * Tabs.spec propagation(ADR-912 단계 1-2) 도입 **전** 생성된 기존 문서는 factory 시점
 * applyFactoryPropagation 을 못 받아 TabList.props.items 가 비어있다(신규 Tabs 는 채워짐).
 * 그 경우 owner Tabs(TabList 를 자식으로 갖는 노드)의 props 를 document map 에서 1회 역추적해
 * items/selectedKey/showIndicator/variant/size 를 보충한다. **primary 는 어디까지나 TabList.props**
 * (projector invariant) — 본 함수는 props.items 가 빈 fallback 경로에서만 호출(owner-lookup primary
 * 패턴 확산 아님, 사용자 결정 2026-06-06).
 */
function findOwnerTabsProps(
  tabListSourceId: string,
  getDocumentNodesById: () => Map<string, CanonicalNode>,
): Record<string, unknown> | null {
  for (const node of getDocumentNodesById().values()) {
    if (node.type !== "Tabs") continue;
    const children = node.children;
    if (
      Array.isArray(children) &&
      children.some((c) => c.id === tabListSourceId)
    ) {
      return (node.props ?? null) as Record<string, unknown> | null;
    }
  }
  return null;
}

/**
 * data-bound TabList 의 projection rows 계산 (gating). items 는 Tabs.props.items 가
 * propagation 경유로 TabList.props.items 에 전파되어 있다(Tabs.spec propagation, ADR-912
 * 단계 1-2). Tag/ListBox 와 동일 getListBoxProjectionRows 로 흡수 ({id,title} → {itemKey,label}).
 * rows 0개면 null → 발효 전 standalone(빈 TabList) 유지(회귀 0). tab 1개 = 1 row.
 *
 * **호환 fallback**: TabList.props.items 가 비면(pre-propagation 기존 문서) owner Tabs.props 를
 * 역추적해 합성 props(TabList.props 우선 + owner Tabs props 보충)로 rows/selected 를 계산한다.
 * 둘 다 있으면 TabList.props 만 사용(duplicate 방지) — propagation 이 정상 동작한 신규 문서.
 */
function resolveDataBoundTabProjection(
  tabListSceneNode: CanvasSceneNode,
  sourceNode: CanonicalNode,
  getDocumentNodesById: () => Map<string, CanonicalNode>,
): {
  rows: ListBoxProjectionRow[];
  sourceNode: CanonicalNode;
  resolvedProps: Record<string, unknown>;
} | null {
  if (!isTabListSceneSource(tabListSceneNode, sourceNode)) return null;

  // Tab 은 dataBinding 없이 items SSOT 만 (Tabs.props.items → propagation → TabList.props.items).
  const tabListProps = tabListSceneNode.props;
  let resolvedProps = tabListProps;

  // 호환 fallback: propagation 전 문서는 TabList.props.items 가 비어있음 → owner Tabs 보충.
  const hasItems =
    Array.isArray(tabListProps.items) && tabListProps.items.length > 0;
  if (!hasItems) {
    const ownerProps = findOwnerTabsProps(sourceNode.id, getDocumentNodesById);
    if (ownerProps) {
      // TabList.props 우선 + owner Tabs props 보충(items/selectedKey/showIndicator/variant/size).
      resolvedProps = { ...ownerProps, ...tabListProps };
    }
  }

  const rows = getListBoxProjectionRows({ props: resolvedProps });
  if (rows.length === 0) return null;

  return { rows, sourceNode, resolvedProps };
}

/**
 * TabList tab projected tree 생성: RowsGroup(flex row) → Tab[i].
 *
 * - rowsGroup: orientation 에 따라 flex row(horizontal) 또는 column(vertical). gap=0(Tabs.spec gap).
 * - tab(Tab): width:fit-content → 라벨 폭 + padding. Tab.spec.render.shapes 가 text + indicator
 *   self-render (_isSelected → selected variant + _showIndicator → indicator rect).
 * - 단일클릭은 owner(Tabs) select redirect (resolveCanvasInteractionTarget), selection update 는
 *   후속(proof scope — Tag 선례와 동일). projection id 는 비영속.
 */
function appendTabRowProjection(
  tabListSceneNode: CanvasSceneNode,
  projection: {
    rows: ListBoxProjectionRow[];
    sourceNode: CanonicalNode;
    resolvedProps: Record<string, unknown>;
  },
  scope: SceneScopeContext,
  graph: Pick<CanvasSceneGraph, "childrenByParent" | "nodes" | "nodesMap"> & {
    parentById: Map<string, string>;
  },
): void {
  // resolvedProps = TabList.props 우선 + (pre-propagation 문서면) owner Tabs props 보충.
  //   orientation/variant/size/showIndicator/selectedKey 모두 동일 소스에서 읽어 일관성 유지.
  const { rows, sourceNode, resolvedProps: props } = projection;
  const isVertical = props.orientation === "vertical";
  const variant = props.variant;
  const size = props.size;
  const showIndicator = props.showIndicator !== false;
  // ADR-912 영역 B (A): Tab selected 판정은 selectedKey ?? defaultSelectedKey (단일 선택).
  //   isListBoxRowSelected 는 selectedKey 만 보고 defaultSelectedKey 를 모르므로(ListBox/Tag 공용),
  //   Tab 전용으로 defaultSelectedKey fallback 을 추가한다(이전 buildSpecNodeData:1095 virtual Tab
  //   로직 동형). 미적용 시 defaultSelectedKey 만 있는 Tabs 의 selected indicator 가 사라진다.
  const selectedKey =
    (props.selectedKey as string | undefined) ??
    (props.defaultSelectedKey as string | undefined);

  const rowsGroupId = toCollectionRowsGroupProjectionId(
    "tab",
    tabListSceneNode.id,
  );
  const rowsGroup: CanvasSceneNode = {
    id: rowsGroupId,
    type: "Rows",
    props: {
      style: {
        display: "flex",
        flexDirection: isVertical ? "column" : "row",
        width: "100%",
        alignItems: isVertical ? "flex-start" : "stretch",
      },
    },
    parentId: tabListSceneNode.id,
    pageId: scope.pageId,
    layoutId: scope.layoutId,
    parent_id: tabListSceneNode.id,
    page_id: scope.pageId,
    layout_id: scope.layoutId,
    projection: {
      kind: "tab-rows",
      listBoxId: tabListSceneNode.id,
      templateAnchorId: null,
      templateOriginId: null,
    },
    sourceNode,
  };
  addSceneNode(rowsGroup, graph);

  for (const row of rows) {
    const tabId = toCollectionRowProjectionId(
      "tab",
      tabListSceneNode.id,
      row.itemKey,
    );
    const tabProps: Record<string, unknown> = {
      // Tab.spec.render.shapes 는 props.title 을 텍스트 소스로 읽는다(children 아님) —
      //   virtual Tab(이전 layout-synthetic)도 title 을 넣었다. children 은 호환용 동시 제공.
      title: row.label,
      children: row.label,
      // tab 폭 = 라벨 + padding — Tab.spec containerStyles. 한 줄 row 에서 각 tab fit-content.
      style: { width: "fit-content" },
      // ADR-912 영역 B (A): Tab 단일 선택 — selectedKey ?? defaultSelectedKey === itemKey.
      _isSelected: selectedKey != null && selectedKey === row.itemKey,
      _showIndicator: showIndicator,
      // tab 본체가 owner Tabs 의 item 식별 (선택 redirect / write-target 라우팅용).
      tabId: row.itemKey,
    };
    if (variant) tabProps.variant = variant;
    if (size) tabProps.size = size;
    if (row.isDisabled) tabProps.isDisabled = true;

    addSceneNode(
      {
        id: tabId,
        type: "Tab",
        props: tabProps,
        parentId: rowsGroupId,
        pageId: scope.pageId,
        layoutId: scope.layoutId,
        parent_id: rowsGroupId,
        page_id: scope.pageId,
        layout_id: scope.layoutId,
        projection: {
          kind: "tab-row",
          listBoxId: tabListSceneNode.id,
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

// ---------------------------------------------------------------------------
// ADR-912 영역 B (A) — Breadcrumb row projection (Breadcrumbs 1단 직접 family)
// ---------------------------------------------------------------------------
//
// Tag/Tab chip 선례와 동형이되 3점 차이:
//   1) **owner = Breadcrumbs scene node 자체** (중간 컨테이너 없음). Tag/Tab 은 TagList/TabList
//      중간 컨테이너로 propagation 했지만, Breadcrumbs→Breadcrumb 은 1단 직접 구조라 propagation
//      불요 — projection 이 Breadcrumbs.props.items 를 직접 읽는다.
//   2) **rowsGroup = 한 줄 flex row nowrap** (Tag 의 wrap-flow 아님, Breadcrumbs.spec:54 nowrap).
//   3) crumb(Breadcrumb) 본체는 **Breadcrumb.spec.render.shapes** 가 그린다 (generic box+text 아님)
//      — separator(!isLast 시 emit) + isLast 강조(weight 600 + accent) 로직 보존. projection 은
//      crumb 노드에 children/_isLast/_separator 만 주입하고, spec 이 시각 책임.

function isBreadcrumbsSceneSource(
  breadcrumbsSceneNode: CanvasSceneNode,
  sourceNode: CanonicalNode,
): boolean {
  if (breadcrumbsSceneNode.type === "Breadcrumbs") return true;
  if (sourceNode.type === "ref") return false;
  return (
    breadcrumbsSceneNode.componentName === "Breadcrumbs" ||
    breadcrumbsSceneNode.name === "Breadcrumbs"
  );
}

/**
 * data-bound Breadcrumbs 의 projection rows 계산 (gating). items 는 Breadcrumbs.props.items
 * (StoredBreadcrumbItem[]) SSOT — 중간 컨테이너 없이 직접. dataBinding(api/collection)도 동일
 * getFlatProjectionRows 3경로로 흡수. rows 0개면 null → 발효 전 standalone(빈 nav) 유지(회귀 0).
 * crumb 1개 = 1 row.
 */
function resolveDataBoundBreadcrumbProjection(
  breadcrumbsSceneNode: CanvasSceneNode,
  sourceNode: CanonicalNode,
  options: BuildCanvasSceneGraphOptions,
): { rows: ListBoxProjectionRow[]; sourceNode: CanonicalNode } | null {
  if (!isBreadcrumbsSceneSource(breadcrumbsSceneNode, sourceNode)) return null;

  const dataBinding = getElementDataBinding(sourceNode);
  const rows = getListBoxProjectionRows({
    collections: options.collections,
    dataBinding,
    props: breadcrumbsSceneNode.props,
  });
  if (rows.length === 0) return null;

  return { rows, sourceNode };
}

/**
 * Breadcrumbs crumb projected tree 생성: RowsGroup(flex row nowrap) → Breadcrumb crumb[i].
 *
 * - rowsGroup: 가로 flex row nowrap (Breadcrumbs.spec:54). gap=0 (separator 가 crumb 노드 내부에
 *   afterPadX 로 흡수되므로 row gap 불요).
 * - crumb(Breadcrumb): width:fit-content → 라벨 폭 + separator 폭. Breadcrumb.spec.render.shapes
 *   가 crumb text + (!isLast 시) separator text self-render. children(라벨) + _isLast(마지막만 true,
 *   weight 600 + accent 강조) + _separator(부모 separator prop, 기본 "›") 주입.
 * - 단일클릭은 owner(Breadcrumbs) select redirect (resolveCanvasInteractionTarget), projection id 는
 *   비영속 (Tag/Tab 선례 동일).
 */
function appendBreadcrumbRowProjection(
  breadcrumbsSceneNode: CanvasSceneNode,
  projection: { rows: ListBoxProjectionRow[]; sourceNode: CanonicalNode },
  scope: SceneScopeContext,
  graph: Pick<CanvasSceneGraph, "childrenByParent" | "nodes" | "nodesMap"> & {
    parentById: Map<string, string>;
  },
): void {
  const props = breadcrumbsSceneNode.props;
  const { rows, sourceNode } = projection;
  const size = props.size;
  const separator = typeof props.separator === "string" ? props.separator : "›";
  const lastIndex = rows.length - 1;

  const rowsGroupId = toCollectionRowsGroupProjectionId(
    "breadcrumb",
    breadcrumbsSceneNode.id,
  );
  const rowsGroup: CanvasSceneNode = {
    id: rowsGroupId,
    type: "Rows",
    props: {
      style: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "nowrap",
        alignItems: "center",
        width: "100%",
      },
    },
    parentId: breadcrumbsSceneNode.id,
    pageId: scope.pageId,
    layoutId: scope.layoutId,
    parent_id: breadcrumbsSceneNode.id,
    page_id: scope.pageId,
    layout_id: scope.layoutId,
    projection: {
      kind: "breadcrumb-rows",
      listBoxId: breadcrumbsSceneNode.id,
      templateAnchorId: null,
      templateOriginId: null,
    },
    sourceNode,
  };
  addSceneNode(rowsGroup, graph);

  for (const row of rows) {
    const crumbId = toCollectionRowProjectionId(
      "breadcrumb",
      breadcrumbsSceneNode.id,
      row.itemKey,
    );
    const isLast = row.rowIndex === lastIndex;
    const crumbProps: Record<string, unknown> = {
      // Breadcrumb.spec.render.shapes 는 props.children(또는 label/title)을 텍스트 소스로 읽는다.
      children: row.label,
      // crumb 폭 = 라벨 + separator(separator 는 Breadcrumb.spec 이 crumb 노드 내부에 그림).
      style: { width: "fit-content" },
      // 마지막 crumb 만 강조(weight 600 + accent) + separator 미생성 (Breadcrumb.spec:131/175).
      _isLast: isLast,
      _separator: separator,
      // owner(Breadcrumbs) 의 item 식별 (선택 redirect / write-target 라우팅용).
      breadcrumbItemKey: row.itemKey,
    };
    if (size) crumbProps.size = size;
    if (row.isDisabled) crumbProps.isDisabled = true;

    addSceneNode(
      {
        id: crumbId,
        type: "Breadcrumb",
        props: crumbProps,
        parentId: rowsGroupId,
        pageId: scope.pageId,
        layoutId: scope.layoutId,
        parent_id: rowsGroupId,
        page_id: scope.pageId,
        layout_id: scope.layoutId,
        projection: {
          kind: "breadcrumb-row",
          listBoxId: breadcrumbsSceneNode.id,
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

    // ADR-912 단계 4 C1: data-bound Table 2D projection (RowsGroup→Row→Cell).
    //   Table factory children:[] (GridList 동형) → suppression 불필요, append 만.
    const tableProjection = sceneNode
      ? resolveDataBoundTableProjection(sceneNode, node, options)
      : null;

    // ADR-912 영역 B (A): TagGroup chip projection (owner=TagList scene node, wrap-flow row).
    //   TagList factory children:[] (items propagation) → suppression 불필요, append 만.
    const tagProjection = sceneNode
      ? resolveDataBoundTagProjection(sceneNode, node, options)
      : null;

    // ADR-912 영역 B (A): TabList tab projection (owner=TabList scene node, 한 줄 flex row).
    //   TabList factory props:{} (items propagation) → suppression 불필요, append 만.
    //   이전 implicitStyles virtual Tab(layout-synthetic) 을 render-space projection 으로 이전.
    //   getDocumentNodesById 는 pre-propagation 기존 문서 호환 fallback(owner Tabs lookup) 용.
    const tabProjection = sceneNode
      ? resolveDataBoundTabProjection(sceneNode, node, getDocumentNodesById)
      : null;

    // ADR-912 영역 B (A): Breadcrumbs crumb projection (owner=Breadcrumbs scene node 자체,
    //   중간 컨테이너 없음 — 1단 직접). 신규 Breadcrumbs factory 는 children:[] (items SSOT)
    //   지만, **pre-migration 기존 문서는 자식 Breadcrumb element 를 보유**한다. items 가 있어
    //   projection 이 active 면 legacy 자식 Breadcrumb element 를 visit 에서 제외해야 이중 렌더
    //   (legacy 자식 + projection crumb)를 막는다. DOM(renderBreadcrumbs `hasItems ? null
    //   : children`)과 대칭.
    const breadcrumbProjection = sceneNode
      ? resolveDataBoundBreadcrumbProjection(sceneNode, node, options)
      : null;
    const suppressBreadcrumbChildren =
      breadcrumbProjection != null && node.type === "Breadcrumbs";

    node.children?.forEach((child) => {
      if (suppressedAnchorId && child.id === suppressedAnchorId) return;
      // ADR-912 영역 B (A): items projection active 면 legacy 자식 Breadcrumb element 제외
      //   (이중 렌더 차단). non-Breadcrumb 자식(혹시 잔존)은 보존.
      if (suppressBreadcrumbChildren && child.type === "Breadcrumb") {
        return;
      }
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
    if (sceneNode && tableProjection) {
      appendTableRowProjection(sceneNode, tableProjection, nextScope, graph);
    }
    if (sceneNode && tagProjection) {
      appendTagRowProjection(sceneNode, tagProjection, nextScope, graph);
    }
    if (sceneNode && tabProjection) {
      appendTabRowProjection(sceneNode, tabProjection, nextScope, graph);
    }
    if (sceneNode && breadcrumbProjection) {
      appendBreadcrumbRowProjection(
        sceneNode,
        breadcrumbProjection,
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

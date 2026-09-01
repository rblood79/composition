import type {
  BreakpointName,
  CanonicalNode,
  CollectionWindow,
  CompositionDocument,
  DescendantOverride,
  RefNode,
} from "@composition/shared";
// ADR-148 Phase 0 — slotRole 공용 vocabulary (설계도 §2-1, builder-local 상수 re-home).
// ADR-159 P2 — 행 텍스트 `{field}` 템플릿 단일 resolver (G2: consumer 자체 파싱 금지).
import {
  buildCollectionRowTemplateItem,
  classifyTableCellDisplay,
  compileFieldTemplate,
  getSlotRole,
  interpolateFieldTemplate,
  resolveComponentRule,
  resolveRowTemplateSource,
  resolveBindingSelectionMode,
  resolveSelectionCheckboxVisible,
  resolveSlotComposition,
} from "@composition/shared";
// ADR-157 gap 배선 (②): ListBox 소유자 gap 을 px 로 해석 (style longhand/shorthand + props.gap).
import { parsePxValue } from "@composition/specs";

import { readLegacyMetadataCustomId } from "../../../../adapters/canonical/legacyMetadata";
import type { FillItem } from "../../../../types/builder/fill.types";
import type { PageElementIndex } from "../../../stores/utils/elementIndexer";
import { normalizeFrameLayoutId } from "../../../../adapters/canonical/frameMirror";
import {
  detectListBoxAuthoringMode,
  isListBoxTemplateAnchor,
  LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
  LISTBOX_ITEM_SELECTED_ORIGIN_ID,
  LISTBOX_ORIGIN_ID,
} from "../../../components/listbox/listBoxTemplateOrigins";
import {
  getListBoxProjectionRows,
  type ListBoxCollectionDataSource,
  type ListBoxProjectionRow,
} from "../../../components/listbox/listBoxRowProjectionModel";
import { GRIDLIST_ITEM_DEFAULT_ORIGIN_ID } from "../../../components/gridlist/gridListTemplateOrigins";
// ADR-907 Layer D: chip gap 정본 = TagList catalog rule. projection 배치와 layout
//   height 계산이 동일 resolver(resolveTagListGap)를 공유해 size 별 gap(lg=6) 을 정합.
import { resolveTagListGap } from "../layout/engines/utils";
// ADR-157 gap 배선 (② 정정): ListBox gap 은 catalog containerStyles.gap(theme 토큰 → px)에서
//   오고 CSS 가 이를 소비한다. rowsGroup 이 element.props.style 만 읽으면 catalog gap 을 놓쳐
//   Skia 만 gap 미적용(D3 asymmetry) → 소유자 layout 이 쓰는 동일 resolver 로 catalog gap 흡수.
import { resolveContainerStylesFallback } from "../layout/engines/implicitStyles";
// ADR-154 Bug3(2026-07-21): scene collection projection 은 layout/render 경로와 달리
//   owner responsive override 를 activeBreakpoint 로 resolve 하지 않아 mobile/tablet 편집
//   시 projected row gap/padding 이 raw(desktop) 값으로 떨어졌다 → 동일 merge SSOT 로 흡수.
import { resolveResponsiveStyleMap } from "../layout/resolveResponsive";
import {
  getTableProjectionRows,
  type TableColumnDef,
  type TableProjectionRow,
} from "../../../components/collection/collectionRowProjectionModel";
import {
  toListBoxRowProjectionId,
  toListBoxRowsGroupProjectionId,
  toCollectionSpacerProjectionId,
  toCollectionRemainderProjectionId,
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
  // ADR-150 A2 (ListBox 가상화): leading/trailing spacer — window 밖 행이 차지했을 높이를
  //   채우는 layout-only 노드(비-hit, 비-render 시각). row/rows-group/cell kind 가 아니라
  //   isCollectionRow(sGroup/Cell)ProjectionKind 가 모두 false → interaction/write handler 가
  //   자동 skip. 총 content height(스크롤바) + window 행 절대 위치를 보존.
  | {
      kind: "listbox-spacer";
      listBoxId: string;
      position: "lead" | "trail";
    }
  // ADR-150 A2 (GridList/Table 확산): listbox-spacer 동형 layout-only spacer.
  //   GridList grid 모드 spacer 는 width:100% 라 wrap-flow 에서 자체 시각 행을 점유(visual row
  //   경계 정합). Table spacer 는 header 행 아래에 삽입(header 는 항상 투영). 셋 다 비-hit·비-render.
  | {
      kind: "gridlist-spacer";
      listBoxId: string;
      position: "lead" | "trail";
    }
  | {
      kind: "table-spacer";
      listBoxId: string;
      position: "lead" | "trail";
    }
  // ADR-157 (data-bound collection 표시 정책): auto-height/unbounded 소유자의 샘플 window 밖
  //   나머지 행 영역 — 계산된 높이(hiddenRows × rowHeight)의 layout-참여 Box. spacer(비-render)와
  //   달리 overlay 가 사선 hatch + "+N more" 라벨을 그린다(빌더 저작 보조 시각, D3 대칭 비대상).
  //   deep hit 시 owner(listBoxId) select redirect. hiddenRows 는 라벨 텍스트용.
  | {
      kind: "collection-remainder";
      listBoxId: string;
      hiddenRows: number;
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
  /**
   * Background fill 스택 — canonical 1차 필드 `CanonicalNode.fills` 운반.
   * Skia 소비: buildBoxNodeData(전체 fill 모델) / buildSpecNodeData catalog
   * 배경 채널(color fill). 빈 배열 대신 필드 생략. canonical boundary 는
   * unknown[] — Element 구조 호환을 위해 여기서 FillItem[] 로 narrow.
   */
  fills?: FillItem[];
  reusable?: true;
  /**
   * data-bound collection projection 컨테이너(box 경로)가 catalog "shell variant" 배경
   * (`{color.raised}` 등)을 그리도록 하는 마커 — catalog 컴포넌트 key("ListBox"/"GridList").
   * box 경로(buildBoxNodeData)는 catalog shell lookup 을 안 하므로, scene 이 collection 임을
   * 아는 시점에 마커를 심어 render 단에서 theme-aware 로 배경을 복원한다(사용자 배경 없을 때만).
   * 투명 컨테이너에서 drop-shadow 가 자식 행 실루엣을 캡처하던 문제 봉쇄(box-shadow = border-box).
   */
  collectionShellTag?: string;
  projection?: CanvasProjectionMetadata;
  ref?: string;
  descendants?: Record<string, DescendantOverride>;
  slot?: false | string[];
  /**
   * ADR-154 반응형 override. layout/render resolve 경로(useLayoutPublisher /
   * renderCommands)가 activeBreakpoint 기준 base⊕override merge 에 사용.
   * canonical `CanonicalNode.responsive` 에서 복사.
   */
  responsive?: CanonicalNode["responsive"];
  sourceNode: CanonicalNode;
}

/**
 * ADR-150 A2 (ListBox 선행 proof): 가상화된 collection owner 의 window 해석.
 * BuilderCanvas 가 scrollState + 측정 metric 으로 precompute 하여 scene 빌드에 주입하는 단일
 * 소스 — draw/hit tree 가 **동일 window** 를 공유(R2). 미제공 owner 는 legacy 정적 cap 투영.
 */
export interface CollectionWindowResolution {
  /** 절대 index [startIndex, endIndex) — 이 구간 행만 투영. */
  window: CollectionWindow;
  /**
   * 균일 **visual row 높이**(px, stride) — leading/trailing spacer 높이 산출.
   * ListBox/Table(1열)은 item 높이 그대로. GridList grid 모드는 카드 높이+rowGap(=시각 행 stride).
   */
  rowHeight: number;
  /** window 전 원본 전체 행 수 — 총 content height(스크롤바) + trailing spacer. */
  totalRows: number;
  /**
   * ADR-150 A2 (GridList 확산): 시각 행당 열 수. 1열(ListBox/Table/GridList stack)은 1(기본),
   * GridList grid 모드는 numCols. spacer 계산이 item index → visual row 로 변환할 때 사용
   * (visual row = ceil(itemIndex / columns)). 미지정 = 1.
   */
  columns?: number;
  /**
   * ADR-150 A2 스크롤 입력 배선: bounded viewport 높이(px, `style.height`/`maxHeight`).
   * `maxScrollTop = contentHeight − viewportHeight` 산출 근거.
   */
  viewportHeight?: number;
  /**
   * 전 행 투영 총 content height(px) = (visual row 수 + table header) × rowHeight.
   * 스크롤바 범위 + trailing spacer 총 높이의 단일 소스.
   */
  contentHeight?: number;
  /**
   * ADR-150 A2 스크롤 입력 배선: `max(0, contentHeight − viewportHeight)`. data-bound
   * collection 은 element 자식이 0개라 GAP 4(`fullTreeLayout` maxScroll)가 못 구한다 →
   * BuilderCanvas 가 이 값을 `useScrollState.updateMaxScroll` 로 주입해 휠 스크롤 활성화.
   */
  maxScrollTop?: number;
  /**
   * ADR-157: 표시 정책 판별. 미지정/`"scroll"` = A2 가상화(bounded height + overflow scroll,
   * lead/trail 빈 spacer 로 scrollable content height 보존). `"sample"` = auto-height/unbounded
   * data-bound 소유자 — 앞부분 window 행만 투영하고 나머지는 hatch placeholder(빈 trailing
   * spacer 아님). scene 이 trailing 을 hatch 로 emit 할지 spacer 로 emit 할지 판별한다.
   */
  mode?: "scroll" | "sample";
}

interface BuildCanvasSceneGraphOptions {
  collections?: readonly ListBoxCollectionDataSource[];
  includeReusableFrames?: boolean;
  /**
   * ADR-150 A2: collection owner id → 가상화 window. bounded height + overflow scroll/auto
   * ListBox 만 등재(BuilderCanvas 판정). 미등재 owner 는 legacy `[0, cap)` 투영(BC).
   */
  collectionWindows?: ReadonlyMap<string, CollectionWindowResolution>;
  /**
   * ADR-154 Bug3: collection projection 이 owner responsive override 를 resolve 할
   * 기준 breakpoint. 미지정/`"desktop"` 이면 base(raw) style 그대로(무비용). scene
   * 재빌드는 BuilderCanvas useMemo 가 activeBreakpoint 를 dep 으로 물어 트리거한다.
   */
  activeBreakpoint?: BreakpointName;
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

/** collection item label slot 자식의 semibold(600) 대상 부모 type. */
const COLLECTION_LABEL_WEIGHT_PARENTS = new Set([
  "ListBoxItem",
  "GridListItem",
  "MenuItem",
]);

/**
 * collection item(parentType)의 label slot 정본 fontWeight 를 **catalog 단일 SSOT** 에서 읽는다.
 * `resolveComponentRule(type).variants[defaultVariant].textWeight` — instance escape(listbox_item)
 * 가 소비하는 `visual.textWeight` 와 동일 필드다(gridlist_card 동형). 즉 origin injection·instance
 * escape 가 같은 catalog 값을 읽어 리터럴 복제가 없다. variant 미지정 시 size fontWeight fallback.
 * catalog 에 값이 없으면 undefined → 호출측이 주입을 건너뛴다(catalog Text 기본 400 유지).
 */
function resolveCollectionSlotLabelWeight(
  parentType: string,
): number | undefined {
  const rule = resolveComponentRule(parentType);
  if (!rule) return undefined;
  const variantKey = (rule.defaultVariant as string | undefined) ?? "default";
  const variantWeight = rule.variants?.[variantKey]?.textWeight;
  if (typeof variantWeight === "number") return variantWeight;
  const sizeKey = rule.defaultSize as string | undefined;
  const sizeWeight = sizeKey ? rule.sizes?.[sizeKey]?.fontWeight : undefined;
  return typeof sizeWeight === "number" ? sizeWeight : undefined;
}

/**
 * 2026-07-21: reusable ListBoxItem/GridListItem/MenuItem origin(Components 페이지)의 **label**
 * slot 자식(Text)은 fold 대상이 아니라 독립 leaf scene 노드로 서는데(편집 표면), Skia leaf Text
 * 렌더는 catalog **Text** rule 의 textWeight(400)로 그린다. 그러나 collection item 의 label 은
 * semibold 이 정본이다 — catalog `{Item}.variants.default.textWeight`(=600) + 수동 CSS
 * `[slot="label"]{font-weight:600}` + instance escape(listbox_item) 의 `visual.textWeight` 가 모두
 * 같은 catalog 필드. origin 만 400 으로 렌더돼 3경로(origin·instance·CSS)가 불일치했다(사용자 보고).
 *
 * DOM 의 parent-scoped CSS 처럼 **render-time** 에 label 자식 style 에 fontWeight 를 주입해 origin
 * leaf 렌더를 catalog weight 로 맞춘다 (Table 셀 `fontWeight` 주입 선례 동형). 주입 위치가 origin
 * 편집 seam 인 이유: origin 자식은 편집 표면이라 독립 leaf 로 서고, parent(collection item)+child
 * 컨텍스트가 공존하는 scene build 만이 slot-aware 스타일을 줄 수 있다. **값은 catalog 에서 읽어**
 * (리터럴 아님) escape·instance·origin 이 단일 SSOT 를 공유 — catalog textWeight 변경 시 3경로 동시
 * 추종. 템플릿 주입은 `repairOrigin` 이 기존 origin children 을 보존해 미반영이라 부적합. 자식이 명시
 * fontWeight 를 가지면 그 값 우선(사용자 편집 보존). description slot 은 catalog Text(400) 유지.
 */
function injectCollectionLabelWeight(
  parent: CanonicalNode,
  child: CanonicalNode,
): CanonicalNode {
  if (!COLLECTION_LABEL_WEIGHT_PARENTS.has(parent.type)) return child;
  if (getSlotRole(child) !== "label") return child;
  const props = child.props as Record<string, unknown> | undefined;
  const style = isRecord(props?.style) ? props.style : undefined;
  if (style?.fontWeight != null) return child;
  const catalogWeight = resolveCollectionSlotLabelWeight(parent.type);
  if (catalogWeight == null) return child;
  return {
    ...child,
    props: {
      ...(props ?? {}),
      style: { ...(style ?? {}), fontWeight: catalogWeight },
    },
  } as CanonicalNode;
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
  const nodeFills = readCanonicalNodeFills(node);
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
    ...(nodeFills ? { fills: nodeFills } : {}),
    sourceNode: node,
  };

  if (node.reusable === true) sceneNode.reusable = true;
  if (node.slot === false || Array.isArray(node.slot)) {
    sceneNode.slot = node.slot;
  }
  // ADR-154: 반응형 override 를 scene node 로 전달 (resolve 소비 경로).
  if (node.responsive) sceneNode.responsive = node.responsive;
  if (node.type === "ref") {
    const refNode = node as RefNode;
    sceneNode.ref = refNode.ref;
    if (isRecord(refNode.descendants)) {
      sceneNode.descendants = refNode.descendants;
    }
  }

  return sceneNode;
}

/**
 * canonical 노드의 fills 판독 — 1차 필드 우선, 1차 필드 도입(2026-07-15) 전 구 문서는
 * `metadata.legacyProps.fills` 격리 보존분 fallback (canonicalElementsView 동일 규칙).
 */
function readCanonicalNodeFills(
  node: CanonicalNode | undefined,
): FillItem[] | undefined {
  if (!node) return undefined;
  const legacyPropsFills = (
    node.metadata as { legacyProps?: { fills?: unknown } } | undefined
  )?.legacyProps?.fills;
  return (
    Array.isArray(node.fills) && node.fills.length > 0
      ? node.fills
      : Array.isArray(legacyPropsFills) && legacyPropsFills.length > 0
        ? legacyPropsFills
        : undefined
  ) as FillItem[] | undefined;
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

export function getListBoxTemplateAnchor(
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
export function resolveListBoxTemplateOriginId(
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

/**
 * selected 행의 template variant origin id 를 해석한다 (2026-07-20, 사용자 승인 "variant 배선").
 *
 * master(ref target 또는 Components 페이지의 origin ListBox 자신)의 `slot` 등록 배열에서
 * `metadata.variant === "selected"` 인 문서 노드를 찾는다. 우선순위:
 *   1. slot 배열 중 variant==="selected" metadata 를 가진 origin.
 *   2. slot[1] (seed 규약: [Default, Selected]).
 *   3. 표준 상수 안전망.
 *
 * **Why**: `slot: [Default, Selected]` 등록에서 Selected 는 지금까지 렌더 소비처 0 인 죽은
 *   등록이었다 — selected 행 배경이 catalog fill token 하드결선이라 사용자가 Selected origin
 *   스타일을 편집해도 무반영. 본 resolver 가 selected 행 style overlay 의 단일 진입점이다
 *   (catalog fill = base 유지, origin props.style = override 층 — Default origin 의
 *   templateAnchorStyle 채널과 동형).
 */
export function resolveListBoxSelectedOriginId(
  sourceNode: CanonicalNode,
  getDocumentNodesById: () => Map<string, CanonicalNode>,
): string {
  const slot =
    sourceNode.type === "ref"
      ? getDocumentNodesById().get((sourceNode as RefNode).ref)?.slot
      : sourceNode.slot;
  if (Array.isArray(slot)) {
    for (const entry of slot) {
      if (typeof entry !== "string") continue;
      const candidate = getDocumentNodesById().get(entry);
      const metadata = candidate?.metadata as { variant?: unknown } | undefined;
      if (metadata?.variant === "selected") return entry;
    }
    if (typeof slot[1] === "string") return slot[1];
  }
  return LISTBOX_ITEM_SELECTED_ORIGIN_ID;
}

/**
 * GridList 행 template origin id 해석 (resolveListBoxTemplateOriginId 대칭, anchor-less).
 *
 * GridList 는 in-instance anchor 인프라가 없다(factory children:[]). 우선순위:
 *   1. ref instance → master(component-gridlist) 의 slot[0].
 *   2. origin GridList 자신(Components 페이지) → 자신의 slot[0].
 *   3. 안전망: 표준 default item origin 상수(component-gridlist-item-default).
 *
 * **Why (ADR-161 Phase 3)**: 컨테이너 origin(component-gridlist)의 slot 을 실제 소비해
 *   ref-composite 를 완성한다. 현행은 slot[0] == 리터럴이라 시각 결과 불변이나, 컨테이너
 *   origin 이 authoritative 가 되어 ListBox(resolveListBoxTemplateOriginId)와 대칭 —
 *   preview(App.tsx component-gridlist master 해석)와 동일 SSOT 를 동일 방식으로 읽는다.
 */
export function resolveGridListTemplateOriginId(
  sourceNode: CanonicalNode,
  getDocumentNodesById: () => Map<string, CanonicalNode>,
): string {
  const slot =
    sourceNode.type === "ref"
      ? getDocumentNodesById().get((sourceNode as RefNode).ref)?.slot
      : sourceNode.slot;
  if (Array.isArray(slot) && typeof slot[0] === "string") return slot[0];
  return GRIDLIST_ITEM_DEFAULT_ORIGIN_ID;
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
 * ADR-150 A2 (ListBox proof → GridList/Table 확산): window resolution → **visual row(시각 행)**
 * 단위 leading/trailing spacer 행 수. spacer 는 시각 행 단위로 높이를 채워 window 행이 절대
 * 위치에 오도록 밀어내고 총 content height(스크롤바)를 보존한다.
 *
 * `columns` 로 item index 를 visual row 로 변환한다(visual row = ceil(itemIndex / columns)):
 * - ListBox/Table/GridList stack (columns 1 또는 미지정) → visual row = item index (기존 동작 불변).
 * - GridList grid (columns=numCols) → 시각 한 줄 = numCols 카드. lead=startIndex/numCols 줄.
 *
 * window 은 resolver 에서 columns 경계로 정렬돼 있어(startIndex/endIndex 가 numCols 배수, tail
 * clamp 예외) ceil 이 정확한 시각 행 수를 준다. spacer 높이 = 반환값 × resolution.rowHeight(stride).
 */
function resolveCollectionSpacerVisualRows(
  resolution: CollectionWindowResolution,
): { lead: number; trail: number } {
  const columns = Math.max(1, resolution.columns ?? 1);
  const totalVisualRows = Math.ceil(resolution.totalRows / columns);
  const leadVisual = Math.ceil(resolution.window.startIndex / columns);
  const endVisual = Math.ceil(resolution.window.endIndex / columns);
  return {
    lead: Math.max(0, leadVisual),
    trail: Math.max(0, totalVisualRows - endVisual),
  };
}

/**
 * ADR-150 A2: 가상화 spacer(비-hit·비-render layout-only Box) 노드 생성. family 별 projection
 * id/kind 만 다르고 구조는 동형(width:100% + 고정 height + flexShrink:0). GridList grid 모드에서
 * width:100% 는 wrap-flow 에서 spacer 가 자체 시각 행을 점유하게 해 window 카드가 올바른 열에서
 * 시작하도록 정렬한다.
 */
function createCollectionSpacerNode(input: {
  family: "listbox" | "gridlist" | "table";
  kind: "listbox-spacer" | "gridlist-spacer" | "table-spacer";
  ownerId: string;
  rowsGroupId: string;
  position: "lead" | "trail";
  height: number;
  scope: SceneScopeContext;
  sourceNode: CanonicalNode;
}): CanvasSceneNode {
  return {
    id: toCollectionSpacerProjectionId(
      input.family,
      input.ownerId,
      input.position,
    ),
    type: "Box",
    props: {
      style: { width: "100%", height: input.height, flexShrink: 0 },
    },
    parentId: input.rowsGroupId,
    pageId: input.scope.pageId,
    layoutId: input.scope.layoutId,
    parent_id: input.rowsGroupId,
    page_id: input.scope.pageId,
    projection: {
      kind: input.kind,
      listBoxId: input.ownerId,
      position: input.position,
    },
    sourceNode: input.sourceNode,
  };
}

/**
 * ADR-157: 샘플 window 밖 나머지 행 영역의 hatch placeholder 노드. spacer 와 동일한 layout-참여
 * Box(width:100% + 고정 height=hiddenHeight + flexShrink:0)이지만 `collection-remainder` kind 로,
 * overlay(buildCollectionRemainderTargets)가 사선 hatch + "+N more" 라벨을 그린다(빌더 저작 보조
 * 시각). deep hit 시 owner select redirect. `hiddenRows` 는 라벨 텍스트용.
 */
function createCollectionRemainderNode(input: {
  family: "listbox" | "gridlist" | "table";
  ownerId: string;
  rowsGroupId: string;
  height: number;
  hiddenRows: number;
  scope: SceneScopeContext;
  sourceNode: CanonicalNode;
}): CanvasSceneNode {
  return {
    id: toCollectionRemainderProjectionId(input.family, input.ownerId),
    type: "Box",
    props: {
      style: { width: "100%", height: input.height, flexShrink: 0 },
    },
    parentId: input.rowsGroupId,
    pageId: input.scope.pageId,
    layoutId: input.scope.layoutId,
    parent_id: input.rowsGroupId,
    page_id: input.scope.pageId,
    projection: {
      kind: "collection-remainder",
      listBoxId: input.ownerId,
      hiddenRows: input.hiddenRows,
    },
    sourceNode: input.sourceNode,
  };
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
  /** ADR-150 A2: 가상화 window 해석(BuilderCanvas 주입). null=legacy 정적 cap. */
  windowResolution: CollectionWindowResolution | null;
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

  // ADR-150 A2: BuilderCanvas 가 이 owner 를 가상화 대상으로 판정했으면 window 슬라이스,
  //   아니면 undefined → getListBoxProjectionRows default(정적 cap) 로 legacy 투영.
  const windowResolution =
    options.collectionWindows?.get(listBoxSceneNode.id) ?? null;
  const rows = getListBoxProjectionRows(
    {
      collections: options.collections,
      dataBinding,
      props: listBoxSceneNode.props,
    },
    windowResolution?.window,
  );
  if (rows.length === 0) return null;

  return {
    rows,
    templateAnchor: getListBoxTemplateAnchor(sourceNode.children),
    sourceNode,
    windowResolution,
  };
}

function appendListBoxRowProjection(
  listBoxSceneNode: CanvasSceneNode,
  projection: {
    rows: ListBoxProjectionRow[];
    templateAnchor: CanonicalNode | null;
    sourceNode: CanonicalNode;
    windowResolution: CollectionWindowResolution | null;
  },
  scope: SceneScopeContext,
  graph: Pick<CanvasSceneGraph, "childrenByParent" | "nodes" | "nodesMap"> & {
    parentById: Map<string, string>;
  },
  getDocumentNodesById: () => Map<string, CanonicalNode>,
  activeBreakpoint: BreakpointName,
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
  const templateOriginNode = templateOriginId
    ? getDocumentNodesById().get(templateOriginId)
    : undefined;
  // ADR-154 후속 (2026-07-21) — origin/anchor 의 responsive override 를 활성 breakpoint 로
  //   해석해 행-root style 에 반영. resolveResponsiveStyleMap 은 style map 전체를 병합하므로
  //   border 뿐 아니라 background/padding/radius/typography 등 **모든 style 속성**이 함께 흐른다
  //   (border 특정이 아님). owner style(§아래 resolveResponsiveStyleMap) 과 동일 계약 — origin
  //   ListBoxItem 을 mobile breakpoint 에서 편집하면 그 override 가 mobile 뷰 인스턴스 행에 반영.
  const originStyle = resolveResponsiveStyleMap(
    (templateOriginNode?.props?.style as Record<string, unknown> | undefined) ??
      {},
    templateOriginNode?.responsive,
    activeBreakpoint,
  );
  const anchorStyle = resolveResponsiveStyleMap(
    (templateAnchor?.props?.style as Record<string, unknown> | undefined) ?? {},
    templateAnchor?.responsive,
    activeBreakpoint,
  );
  const templateAnchorStyle = { ...originStyle, ...anchorStyle };
  // 2026-07-20 (사용자 승인 "variant 배선") — selected 행은 slot 등록의 Selected variant
  //   origin(ListBoxItem/Selected) props.style 을 default origin style 위에 overlay 한다.
  //   catalog fill token(accent-subtle)은 base 로 유지 — origin 스타일이 없으면 기존 시각 그대로.
  const selectedOriginId = resolveListBoxSelectedOriginId(
    sourceNode,
    getDocumentNodesById,
  );
  const selectedOriginNode = getDocumentNodesById().get(selectedOriginId);
  const selectedOriginStyle = resolveResponsiveStyleMap(
    (selectedOriginNode?.props?.style as Record<string, unknown> | undefined) ??
      {},
    selectedOriginNode?.responsive,
    activeBreakpoint,
  );
  // Style 패널 Background 편집은 props.style 이 아니라 canonical `fills` 채널에 기록된다
  //   (커밋 시 sanitize 가 style.backgroundColor 를 비움 — buildSpecNodeData 계약과 동일).
  //   행 scene node 에 origin fills 를 실으면 buildSpecNodeData 의 fills→hex6 변환이
  //   그대로 재사용되어 escape row-bg 로 흐른다. default origin fills 는 모든 행,
  //   selected origin fills 는 selected 행이 override.
  const defaultOriginFills = readCanonicalNodeFills(templateOriginNode);
  const selectedOriginFills = readCanonicalNodeFills(selectedOriginNode);
  // ADR-148 Phase 0 — slot 구성 소비: origin(또는 anchor 가 자식을 보유하면 anchor)의
  //   slot 조합 자식(metadata.slotRole)에서 구성(존재·순서)과 slot 자식 style 을 추출해
  //   projected row 의 `_slots` 로 주입한다. listbox_item escape(Skia)와 DOM emit 이
  //   이를 소비 — origin 에서 slot 자식을 지우거나 스타일을 바꾸면 instance 행이 따라간다
  //   (구성·스타일 SSOT = origin 문서의 자식 구성, Decision 3). null(slot 자식 없음)이면
  //   미주입 → consumer 는 legacy flat-props 동작(BC).
  const slotComposition = resolveSlotComposition(
    templateAnchor?.children?.length
      ? templateAnchor.children
      : templateOriginNode?.children,
  );
  if (slotComposition) {
    // 컨테이너 layout(utils.ts §1.55b listbox 분기)이 행 높이(description 유무)를 같은
    //   구성으로 gating 하도록 owner ListBox scene props 에도 주입 (Layer D 대칭).
    (listBoxSceneNode.props as Record<string, unknown>)._slots =
      slotComposition;
  }
  // ADR-159 P2: 행 텍스트 템플릿 compile — 행 루프 밖 1회 (R5). 소스 precedence 는
  //   shared 단일 헬퍼(§2-3-1): slot text > item children/textValue > null(휴리스틱).
  //   item-level 은 anchor(인스턴스 override) 우선, origin fallback. compile null(토큰
  //   없음)이면 기존 row.label/row.description 그대로 (G3 BC — slot(role) 별 독립 판정).
  const anchorItemProps = isRecord(templateAnchor?.props)
    ? (templateAnchor.props as Record<string, unknown>)
    : null;
  const originItemProps = isRecord(templateOriginNode?.props)
    ? (templateOriginNode.props as Record<string, unknown>)
    : null;
  const compileRowTemplate = (role: "label" | "description") => {
    const source =
      resolveRowTemplateSource(slotComposition, role, anchorItemProps) ??
      resolveRowTemplateSource(null, role, originItemProps);
    return source ? compileFieldTemplate(source) : null;
  };
  const labelTemplate = compileRowTemplate("label");
  const descriptionTemplate = compileRowTemplate("description");
  // ADR-157 gap 배선 (②, 2026-07-21): rowsGroup 이 gap:0 하드코딩이라 ListBox 의 gap 스타일이
  //   무시됐다(GridList 는 rowGap:gap 적용 — 패밀리 비대칭, 사용자 보고). 소유자 gap 을 해석해
  //   rowsGroup rowGap + injection/hatch 공식에 반영한다. style longhand(rowGap) 우선 + shorthand
  //   fallback(style-ssot 정책) + props.gap(GridList 규약) 커버. 기본 0 (RAC ListBox 행 인접).
  const listBoxOwnerProps = listBoxSceneNode.props as Record<string, unknown>;
  // ADR-154 Bug3: mobile/tablet 편집은 owner.responsive.styles 로 저장된다. layout/render
  //   경로는 resolveResponsiveLayoutNode 로 반영하지만 scene projection 은 raw style 을 읽어
  //   projected row gap/padding 이 desktop 값으로 떨어졌다 → 동일 merge 로 activeBreakpoint
  //   override 를 흡수(desktop 또는 responsive 부재면 identity, 무비용).
  const listBoxOwnerStyle = resolveResponsiveStyleMap(
    (listBoxOwnerProps?.style as Record<string, unknown> | undefined) ?? {},
    listBoxSceneNode.responsive,
    activeBreakpoint,
  );
  // 2026-07-22 (사용자 보고): ref 인스턴스가 자체 gap override 를 안 주면 CSS 는 origin ListBox 의
  //   gap 을 상속(CanonicalNodeRenderer ref 해석)하나 Skia 는 여기서 instance scene style +
  //   catalog fallback 만 읽어 origin gap(예: 10)을 놓치고 catalog default(2)로 떨어졌다(D3 asymmetry).
  //   origin ListBox style 을 해석해 instance own → origin → catalog 순 fallback 으로 삽입한다.
  //   (item template origin 을 templateAnchorStyle 로 상속하는 것과 동형 — 컨테이너 gap 판.)
  let originGapValue: unknown;
  if (sourceNode.type === "ref") {
    const originNode = getDocumentNodesById().get((sourceNode as RefNode).ref);
    if (originNode) {
      const originStyle = resolveResponsiveStyleMap(
        (originNode.props?.style as Record<string, unknown> | undefined) ?? {},
        originNode.responsive,
        activeBreakpoint,
      );
      const originProps = originNode.props as
        Record<string, unknown> | undefined;
      originGapValue =
        originStyle.rowGap ??
        originStyle.columnGap ??
        originStyle.gap ??
        originProps?.gap;
    }
  }
  // catalog containerStyles.gap(= "{spacing.2xs}" 등, resolveToken 으로 px)을 fallback 으로 —
  //   CSS(생성 CSS)가 소비하는 동일 소스. resolveContainerStylesFallback 은 element/factory 편집을
  //   우선 처리하므로 여기서도 element style 을 앞에 둔다(명시적 우선 + longhand rowGap 대응).
  const listBoxContainerFallback = resolveContainerStylesFallback(
    "listbox",
    listBoxOwnerStyle,
  );
  const rowGapPx = parsePxValue(
    listBoxOwnerStyle.rowGap ??
      listBoxOwnerStyle.columnGap ??
      listBoxOwnerStyle.gap ??
      listBoxOwnerProps?.gap ??
      originGapValue ??
      listBoxContainerFallback.gap,
    0,
  );

  // ADR-157 Phase 3 (배치 진실성): sample mode(auto-height data-bound) owner 는 layout §1.55b 가
  //   props.items 만 순회해 순수 dataBinding 소유자에서 3-item fallback 으로 clip 된다. scene 이
  //   totalRows 전체 높이를 owner props 에 주입해 §1.55b(또는 ref 소유자는 fix b early-check)가
  //   이를 소비하도록 한다(layout = scene 정합). gap 있으면 inter-row gap 포함:
  //   totalRows × rowHeight + (totalRows-1) × rowGap (= rowsGroup flex 산출 높이).
  //   scroll mode 는 explicit height(§1 우선)라 무시되고, legacy(window null)는 기존 items 경로.
  const ownerWindow = projection.windowResolution;
  if (
    ownerWindow?.mode === "sample" &&
    ownerWindow.totalRows > 0 &&
    ownerWindow.rowHeight > 0
  ) {
    listBoxOwnerProps._projectedRowsContentHeight =
      ownerWindow.totalRows * ownerWindow.rowHeight +
      Math.max(0, ownerWindow.totalRows - 1) * rowGapPx;
  }
  const rowsGroupId = toListBoxRowsGroupProjectionId(listBoxSceneNode.id);
  const rowsGroup: CanvasSceneNode = {
    id: rowsGroupId,
    type: "Rows",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        // ADR-157 gap 배선 (②): 소유자 gap 을 행간 간격으로 소비 (기존 하드코딩 0 제거).
        //   gap 0 이면 종전과 동일(BC). injection/hatch 공식이 같은 rowGapPx 로 정합.
        rowGap: rowGapPx,
        width: "100%",
      },
    },
    parentId: listBoxSceneNode.id,
    pageId: scope.pageId,
    layoutId: scope.layoutId,
    parent_id: listBoxSceneNode.id,
    page_id: scope.pageId,
    projection: {
      kind: "listbox-rows",
      listBoxId: listBoxSceneNode.id,
      templateAnchorId,
      templateOriginId,
    },
    sourceNode: templateAnchor ?? sourceNode,
  };
  addSceneNode(rowsGroup, graph);

  // ADR-150 A2 (ListBox 가상화): window 활성 시 leading/trailing spacer 로 window 밖 행
  //   높이를 채운다 — window 행이 절대 위치(startIndex*rowHeight)에 오도록 밀어내고, 총
  //   content height = totalRows*rowHeight 를 flex column 자식 합으로 보존(스크롤바 정확).
  //   spacer 는 fills 없는 layout-only Box (비-hit/비-시각). window 없으면(legacy cap) 미삽입.
  //   ListBox 는 1열(rowsGroup gap 0)이라 columns 미지정 → visual row = item index.
  const { windowResolution } = projection;
  const rowHeight = windowResolution?.rowHeight ?? 0;
  const spacerRows = windowResolution
    ? resolveCollectionSpacerVisualRows(windowResolution)
    : { lead: 0, trail: 0 };
  const createSpacerNode = (position: "lead" | "trail", height: number) =>
    createCollectionSpacerNode({
      family: "listbox",
      kind: "listbox-spacer",
      ownerId: listBoxSceneNode.id,
      rowsGroupId,
      position,
      height,
      scope,
      sourceNode: templateAnchor ?? sourceNode,
    });
  if (spacerRows.lead > 0 && rowHeight > 0) {
    addSceneNode(createSpacerNode("lead", spacerRows.lead * rowHeight), graph);
  }

  for (const row of rows) {
    const projectionId = toListBoxRowProjectionId(
      listBoxSceneNode.id,
      row.itemKey,
    );
    const isRowSelected = isListBoxRowSelected(
      props,
      row.itemKey,
      row.rowIndex,
    );
    // ADR-147: anchor layout style overlay. 행 폭 기본 100%(list 행 stretch) — 단, origin
    //   ListBoxItem 이 명시 width(예: 50%)를 주면 그 값 존중. CSS(DOM)는 origin width 를 각 행에
    //   적용하므로 Skia 가 100% 를 무조건 강제하면 Skia↔CSS parity 위반(2026-07-22 사용자 보고:
    //   width:50% 인데 Skia 만 100% 렌더). selected 행은 Selected variant origin style overlay
    //   (2026-07-20) — 그쪽 width 도 동일 존중.
    const rowLayoutStyle: Record<string, unknown> = {
      ...templateAnchorStyle,
      ...(isRowSelected ? selectedOriginStyle : {}),
    };
    if (rowLayoutStyle.width == null) rowLayoutStyle.width = "100%";
    // ADR-159 P2: 템플릿 존재 시 row.item(+가상 필드 label/description/icon/value) 보간.
    //   없으면 기존 휴리스틱 산출(row.label) 그대로 — 문서/시각 BC.
    const templateItem =
      labelTemplate || descriptionTemplate
        ? buildCollectionRowTemplateItem(row)
        : null;
    const rowLabel =
      labelTemplate && templateItem
        ? interpolateFieldTemplate(labelTemplate, templateItem)
        : row.label;
    const rowDescription =
      descriptionTemplate && templateItem
        ? interpolateFieldTemplate(descriptionTemplate, templateItem)
        : (row.description ?? "");
    const rowProps: Record<string, unknown> = {
      children: rowLabel,
      description: rowDescription,
      textValue: rowLabel,
      style: rowLayoutStyle,
      // 보편 selection 축(ADR-142 §3) — listbox_item escape 는 props.isSelected 를 읽는다.
      //   구 주입이 _isSelected 뿐이라 Skia selected row-bg/check 가 죽은 분기였다 (2026-07-20).
      isSelected: isRowSelected,
      _isSelected: isRowSelected,
    };
    if (row.value) rowProps.value = row.value;
    if (row.icon) rowProps.icon = row.icon; // ADR-147: icon slot
    if (row.isDisabled) rowProps.isDisabled = true;
    // ADR-148 Phase 0: slot 구성(존재·순서·slot 자식 style) — escape/DOM emit 소비.
    if (slotComposition) rowProps._slots = slotComposition;
    // origin fills 채널 (2026-07-20) — buildSpecNodeData fills→배경 변환 재사용.
    const rowFills = isRowSelected
      ? (selectedOriginFills ?? defaultOriginFills)
      : defaultOriginFills;

    addSceneNode(
      {
        id: projectionId,
        type: "ListBoxItem",
        ...(rowFills ? { fills: rowFills } : {}),
        props: rowProps,
        parentId: rowsGroupId,
        pageId: scope.pageId,
        layoutId: scope.layoutId,
        parent_id: rowsGroupId,
        page_id: scope.pageId,
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

  // ADR-157: sample mode(auto-height/unbounded 소유자)는 trailing 을 빈 spacer 대신 hatch
  //   placeholder 로 emit — 나머지 hiddenRows 영역을 계산된 높이로 채워 컨테이너가 totalRows
  //   전체 높이에 auto-size 되게 하고(배치 진실성), overlay 가 그 위에 사선 + "+N more" 를 그린다.
  //   scroll mode(A2)는 종전대로 빈 trailing spacer(스크롤 content height 보존).
  if (spacerRows.trail > 0 && rowHeight > 0) {
    if (windowResolution?.mode === "sample") {
      addSceneNode(
        createCollectionRemainderNode({
          family: "listbox",
          ownerId: listBoxSceneNode.id,
          rowsGroupId,
          // ADR-157 gap 배선 (②): hatch = hidden 행 영역 + 그 내부 gap. rowsGroup rowGap 이
          //   samples/hatch 사이에 이미 gap 을 넣으므로, hatch 자체는 hidden 행 사이 gap
          //   (trail-1)개만 포함 → 합산 시 owner injection(totalRows-1 gap)과 정확 정합.
          height:
            spacerRows.trail * rowHeight +
            Math.max(0, spacerRows.trail - 1) * rowGapPx,
          hiddenRows: spacerRows.trail,
          scope,
          sourceNode: templateAnchor ?? sourceNode,
        }),
        graph,
      );
    } else {
      addSceneNode(
        createSpacerNode("trail", spacerRows.trail * rowHeight),
        graph,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// ADR-912 단계 4 C1 — GridList projection (origin/anchor 없는 단순 경로)
// ---------------------------------------------------------------------------

/**
 * GridList scene node 판정 — GridList 컴포넌트(또는 그 ref instance).
 * GridList 는 factory children:[] + anchor-less 단일 origin(ADR-148 Phase 4 —
 * ensureGridListTemplateOrigins 리터럴 참조)이므로 ListBox 보다 단순
 * (authoring mode / template anchor 개념 없음).
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
): {
  rows: ListBoxProjectionRow[];
  sourceNode: CanonicalNode;
  /** ADR-150 A2 (GridList 확산): 가상화 window 해석. null=legacy 정적 cap. */
  windowResolution: CollectionWindowResolution | null;
} | null {
  if (!isGridListSceneSource(gridListSceneNode, sourceNode)) return null;

  const dataBinding = getElementDataBinding(sourceNode);
  // ADR-150 A2: BuilderCanvas 가 가상화 대상으로 판정했으면 window 슬라이스(grid 는 numCols
  //   경계 정렬된 절대 index), 아니면 undefined → getListBoxProjectionRows default(정적 cap).
  const windowResolution =
    options.collectionWindows?.get(gridListSceneNode.id) ?? null;
  const rows = getListBoxProjectionRows(
    {
      collections: options.collections,
      dataBinding,
      props: gridListSceneNode.props,
    },
    windowResolution?.window,
  );
  if (rows.length === 0) return null;

  return { rows, sourceNode, windowResolution };
}

/**
 * GridList projected rows-group + 카드(GridListItem) projected node 생성.
 *
 * ListBox 대비 단순: template anchor 없음(templateAnchorId = null) — origin 은 anchor-less
 * 단일(`component-gridlist-item-default`, ADR-148 Phase 4)로 리터럴 해석해 slot 구성(`_slots`)
 * 과 origin style 을 카드에 주입한다. projected GridListItem 은 row 데이터(label/description/
 * value)를 props 로 받아 `gridlist_card` escape 가 카드를 자체 렌더. rowsGroup 은 GridList 의
 * layout(grid/stack) + columns 를 flex 로 반영하여 카드가 grid 배치되게 한다(배치는 layout 엔진 담당).
 */
function appendGridListRowProjection(
  gridListSceneNode: CanvasSceneNode,
  projection: {
    rows: ListBoxProjectionRow[];
    sourceNode: CanonicalNode;
    windowResolution: CollectionWindowResolution | null;
  },
  scope: SceneScopeContext,
  graph: Pick<CanvasSceneGraph, "childrenByParent" | "nodes" | "nodesMap"> & {
    parentById: Map<string, string>;
  },
  getDocumentNodesById: () => Map<string, CanonicalNode>,
): void {
  const props = gridListSceneNode.props;
  const { rows, sourceNode } = projection;
  // 2026-07-29: prop 부재 fallback 도 grid (catalog `GridList.binding.ts` layout.default 정합).
  const layout = (props.layout as string) ?? "grid";
  const numCols =
    layout === "grid" ? Math.max(1, Number(props.columns) || 2) : 1;
  const gap = typeof props.gap === "number" ? (props.gap as number) : 12;

  // ADR-148 Phase 4 — ADR-147 모델 복제 (appendListBoxRowProjection 동형): Components
  //   페이지의 GridListItem 기본 origin 에서 slot 구성(존재·순서·slot 자식 style)과
  //   origin style 을 해석해 projected 카드에 주입한다. origin 미존재/slot 자식 없음
  //   = legacy 문서 → 미주입, consumer 는 기존 flat-props 동작(BC).
  // ADR-161 Phase 3 — 컨테이너 origin(component-gridlist)의 slot[0] 을 소비해 item origin 을
  //   해석한다(리터럴 하드코딩 제거). resolveGridListTemplateOriginId 는 preview(App.tsx
  //   component-gridlist master 해석)와 동일 SSOT — ref-composite 컨테이너 origin authoritative.
  const templateOriginNode = getDocumentNodesById().get(
    resolveGridListTemplateOriginId(sourceNode, getDocumentNodesById),
  );
  const templateOriginId = templateOriginNode ? templateOriginNode.id : null;
  const originStyle =
    (templateOriginNode?.props?.style as Record<string, unknown> | undefined) ??
    {};
  const slotComposition = resolveSlotComposition(templateOriginNode?.children);
  if (slotComposition) {
    // 컨테이너 layout(utils.ts §1.55c gridlist 분기)이 카드 높이(description 유무)를
    //   같은 구성으로 gating 하도록 owner GridList scene props 에도 주입 (Layer D 대칭).
    (gridListSceneNode.props as Record<string, unknown>)._slots =
      slotComposition;
  }
  // ADR-159 P2: 카드 텍스트 템플릿 compile — 행 루프 밖 1회 (R5). ListBox 동형이나
  //   GridList 는 anchor 축이 없어 origin props 단독 fallback (§2-3-1 precedence).
  const gridOriginItemProps = isRecord(templateOriginNode?.props)
    ? (templateOriginNode.props as Record<string, unknown>)
    : null;
  const compileCardTemplate = (role: "label" | "description") => {
    const source = resolveRowTemplateSource(
      slotComposition,
      role,
      gridOriginItemProps,
    );
    return source ? compileFieldTemplate(source) : null;
  };
  const labelTemplate = compileCardTemplate("label");
  const descriptionTemplate = compileCardTemplate("description");
  // ADR-157 Phase 4 (배치 진실성 — GridList 확산): sample mode(auto-height data-bound) owner 는
  //   layout §1.55c 가 props.items 만 순회해 순수 dataBinding 소유자에서 4-item fallback 으로
  //   clip 된다. scene 이 visualRows 전체 높이(= ceil(totalRows/columns) × rowHeight — samples +
  //   hatch 와 동일 window resolver stride)를 owner props 에 주입해 §1.55c 가 이를 소비하도록
  //   한다(layout = scene 정합). ListBox(§1.55b) 선례 동형이나 열 수(grid numCols)를 반영해
  //   visual row 공간으로 환산한다. scroll mode(explicit height)/legacy(window null)는 무주입.
  const gridOwnerWindow = projection.windowResolution;
  if (
    gridOwnerWindow?.mode === "sample" &&
    gridOwnerWindow.totalRows > 0 &&
    gridOwnerWindow.rowHeight > 0
  ) {
    const cols = Math.max(1, gridOwnerWindow.columns ?? 1);
    const visualRows = Math.ceil(gridOwnerWindow.totalRows / cols);
    (
      gridListSceneNode.props as Record<string, unknown>
    )._projectedRowsContentHeight = visualRows * gridOwnerWindow.rowHeight;
  }

  const rowsGroupId = toCollectionRowsGroupProjectionId(
    "gridlist",
    gridListSceneNode.id,
  );
  const rowsGroup: CanvasSceneNode = {
    id: rowsGroupId,
    type: "Rows",
    props: {
      // grid 는 display:grid + gridTemplateColumns(numCols × 1fr track array)로 열을 구성한다
      //   (DOM GridList.css [data-layout="grid"] 및 GridList.tsx display:grid 와 대칭). 과거
      //   flex-row + flex-wrap + 카드 calc((100%-gap)/numCols) 는 폭 순환 의존으로 rows-group
      //   이 1열(169px)로 축소되고 카드 텍스트가 과도 wrap 됐다. grid track 은 순환 없이 열 폭을
      //   먼저 확정 → 카드가 정확한 열 폭(169)에서 측정되어 wrap 정합. stack 은 flex-column 유지.
      style:
        layout === "grid"
          ? {
              display: "grid",
              gridTemplateColumns: Array(numCols).fill("1fr"),
              rowGap: gap,
              columnGap: gap,
              width: "100%",
            }
          : {
              display: "flex",
              flexDirection: "column",
              flexWrap: "nowrap",
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
    projection: {
      kind: "gridlist-rows",
      listBoxId: gridListSceneNode.id,
      templateAnchorId: null,
      templateOriginId,
    },
    sourceNode,
  };
  addSceneNode(rowsGroup, graph);

  // ADR-150 A2 (GridList 확산): 가상화 window 활성 시 leading/trailing spacer. grid 모드는
  //   width:100% spacer 가 wrap-flow 에서 자체 시각 행을 점유해 window 카드가 올바른 열(0번)에서
  //   시작하도록 정렬한다 — resolveCollectionSpacerVisualRows 가 columns=numCols 로 item index →
  //   시각 행 수를 환산. window 없으면(legacy cap) 미삽입.
  const { windowResolution } = projection;
  const rowHeight = windowResolution?.rowHeight ?? 0;
  const spacerRows = windowResolution
    ? resolveCollectionSpacerVisualRows(windowResolution)
    : { lead: 0, trail: 0 };
  if (spacerRows.lead > 0 && rowHeight > 0) {
    addSceneNode(
      createCollectionSpacerNode({
        family: "gridlist",
        kind: "gridlist-spacer",
        ownerId: gridListSceneNode.id,
        rowsGroupId,
        position: "lead",
        height: spacerRows.lead * rowHeight,
        scope,
        sourceNode,
      }),
      graph,
    );
  }

  // 카드 폭: 항상 "100%". grid 는 rows-group display:grid 의 track(1fr)이 열 폭을 확정하고 카드는
  //   track 을 채운다(width:100% = track 폭). 과거 calc((100%-gap)/numCols) 는 display:grid 에서
  //   100%=grid area(=track 169) 라 (169-gap)/2=78 로 이중 분할돼 텍스트 과도 wrap 됐다. stack 도 100%.
  const cardWidthStyle = "100%";

  // 선택 체크박스 가시성 — RAC 는 selectionMode!=="none" && selectionBehavior==="toggle" 일 때만
  //   카드 첫 자식으로 `<Checkbox slot="selection">` 을 낸다. renderGridList 가 넘기는 기본값
  //   ("none" / "toggle")과 같은 인자를 써야 두 표면이 같은 조건에서 체크박스를 그린다.
  const cardIsQuiet = props.isQuiet === true;
  const showSelectionCheckbox = resolveSelectionCheckboxVisible({
    selectionMode: props.selectionMode,
    selectionStyle: props.selectionStyle,
    selectionBehavior: props.selectionBehavior,
    // ADR-923 r23m1 — 기본값 원천은 catalog binding (layout·virtualization 과 같은 값).
    defaultSelectionMode: resolveBindingSelectionMode("GridList", "none"),
    // GridList.tsx 게이트 = `selectionMode === "multiple"` (RAC starter 원본) → single 제외.
    //   Tree 규칙(single 포함)을 여기 쓰면 DOM 에 없는 체크박스를 그리고 카드가 22px 높아진다.
    checkboxModes: ["multiple"],
    fallback: "toggle",
  });

  for (const row of rows) {
    const projectionId = toCollectionRowProjectionId(
      "gridlist",
      gridListSceneNode.id,
      row.itemKey,
    );
    // ADR-159 P2: 템플릿 존재 시 row.item(+가상 필드) 보간 — ListBox 행 동형.
    const templateItem =
      labelTemplate || descriptionTemplate
        ? buildCollectionRowTemplateItem(row)
        : null;
    const rowLabel =
      labelTemplate && templateItem
        ? interpolateFieldTemplate(labelTemplate, templateItem)
        : row.label;
    const rowDescription =
      descriptionTemplate && templateItem
        ? interpolateFieldTemplate(descriptionTemplate, templateItem)
        : (row.description ?? "");
    const rowProps: Record<string, unknown> = {
      children: rowLabel,
      description: rowDescription,
      textValue: rowLabel,
      // ADR-148 Phase 4: origin style overlay (ListBox templateAnchorStyle 동형).
      //   카드 폭은 layout(stack|grid) 산식이 항상 우선.
      style: { ...originStyle, width: cardWidthStyle },
      // 보편 selection 축(ADR-142 §3) — gridlist_card escape 는 `props.isSelected` 를 읽는다
      //   (selected accent border, 체크 표시). ListBox 행이 2026-07-20 에 같은 이유로 두 키를
      //   함께 주입하도록 고쳐졌는데 GridList 는 `_isSelected` 만 남아 있어 dead 였다.
      isSelected: isListBoxRowSelected(props, row.itemKey, row.rowIndex),
      _isSelected: isListBoxRowSelected(props, row.itemKey, row.rowIndex),
    };
    // 체크박스 블록 신호 — catalog `GridListItem.selectionCheckbox` 채널이 소비(폭이 아니라
    //   카드 높이를 늘리는 스택 첫 블록). 컴포넌트 식별 분기 없이 데이터 게이팅.
    if (showSelectionCheckbox) rowProps._showSelectionCheckbox = true;
    // quiet (2026-08-22) — owner 의 `isQuiet` 이 고르는 **카드 variant**. DOM 이 항목에
    //   `data-variant="quiet"` 를 다는 것과 같은 값이고, 시각 정의는 catalog
    //   `GridListItem.variants.quiet` 한 곳이다. 컨테이너 variant(default/accent)와는
    //   다른 축이라 그 값을 카드로 내려보내지 않는다.
    if (cardIsQuiet) rowProps.variant = "quiet";
    if (row.value) rowProps.value = row.value;
    if (row.isDisabled) rowProps.isDisabled = true;
    // ADR-148 Phase 4: slot 구성(존재·순서·slot 자식 style) — gridlist_card escape/DOM emit 소비.
    if (slotComposition) rowProps._slots = slotComposition;

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
        projection: {
          kind: "gridlist-row",
          listBoxId: gridListSceneNode.id,
          itemKey: row.itemKey,
          rowIndex: row.rowIndex,
          templateAnchorId: null,
          templateOriginId,
        },
        sourceNode,
      },
      graph,
    );
  }

  // ADR-157 Phase 4: sample mode 는 trailing 을 빈 spacer 대신 hatch placeholder 로 emit
  //   (ListBox 동형) — 나머지 hiddenRows(시각 행) 영역을 계산된 높이로 채워 컨테이너가 visualRows
  //   전체 높이에 auto-size 되게 하고(배치 진실성), overlay 가 사선 + "+N more" 를 그린다.
  //   scroll mode(A2)는 종전대로 빈 trailing spacer(스크롤 content height 보존).
  if (spacerRows.trail > 0 && rowHeight > 0) {
    if (windowResolution?.mode === "sample") {
      addSceneNode(
        createCollectionRemainderNode({
          family: "gridlist",
          ownerId: gridListSceneNode.id,
          rowsGroupId,
          height: spacerRows.trail * rowHeight,
          hiddenRows: spacerRows.trail,
          scope,
          sourceNode,
        }),
        graph,
      );
    } else {
      addSceneNode(
        createCollectionSpacerNode({
          family: "gridlist",
          kind: "gridlist-spacer",
          ownerId: gridListSceneNode.id,
          rowsGroupId,
          position: "trail",
          height: spacerRows.trail * rowHeight,
          scope,
          sourceNode,
        }),
        graph,
      );
    }
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
 * 빈 데이터 Table (dataBinding/props.rows 모두 없음) 은 data 0행 → null 반환 → standalone
 * render.shapes 유지 = 빈 테이블. reference 정합 (2026-06-22, 샘플 fallback 제거). 실데이터
 * (dataBinding/collections) 있으면 data N행으로 projection active.
 */
function resolveDataBoundTableProjection(
  tableSceneNode: CanvasSceneNode,
  sourceNode: CanonicalNode,
  options: BuildCanvasSceneGraphOptions,
): {
  columns: TableColumnDef[];
  rows: TableProjectionRow[];
  sourceNode: CanonicalNode;
  /** ADR-150 A2 (Table 확산): data 행 가상화 window 해석. null=legacy 정적 cap. */
  windowResolution: CollectionWindowResolution | null;
} | null {
  if (!isTableSceneSource(tableSceneNode, sourceNode)) return null;

  const dataBinding = getElementDataBinding(sourceNode);
  // ADR-150 A2: BuilderCanvas 가 가상화 대상으로 판정했으면 window(=data 행 index 공간)로
  //   data 행 슬라이스. header 행은 항상 포함. 미판정이면 undefined → legacy 정적 cap.
  const windowResolution =
    options.collectionWindows?.get(tableSceneNode.id) ?? null;
  const { columns, rows, totalDataRows } = getTableProjectionRows(
    {
      collections: options.collections,
      dataBinding,
      props: tableSceneNode.props,
    },
    windowResolution?.window,
  );
  // 원본 data 행(header 제외)이 하나도 없으면 projection 의미 없음 → standalone 유지.
  //   totalDataRows 로 gating(window 슬라이스 후 rows 수 아님) — 스크롤로 window 가 비어도
  //   빈 테이블로 오판하지 않는다. (빈 데이터 Table 정상 경로, 2026-06-22)
  if (totalDataRows === 0) return null;

  return { columns, rows, sourceNode, windowResolution };
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
    windowResolution: CollectionWindowResolution | null;
  },
  scope: SceneScopeContext,
  graph: Pick<CanvasSceneGraph, "childrenByParent" | "nodes" | "nodesMap"> & {
    parentById: Map<string, string>;
  },
): void {
  const { columns, rows, sourceNode, windowResolution } = projection;
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
    projection: {
      kind: "table-rows",
      listBoxId: tableSceneNode.id,
      templateAnchorId: null,
      templateOriginId: null,
    },
    sourceNode,
  };
  addSceneNode(rowsGroup, graph);

  const addRow = (row: TableProjectionRow): void => {
    const isHeader = row.kind === "header";
    // striped: data 행 중 홀수(rowIndex 1,3,...)에 _striped (Table.spec: !isEven → rowIndex%2!==0).
    const striped = isStripedVariant && !isHeader && row.rowIndex % 2 !== 0;

    const rowId = toCollectionRowProjectionId(
      "table",
      tableSceneNode.id,
      row.rowKey,
    );
    // ADR-912 Pattern B (TableRow catalog cutover, 2026-06-13): 행 배경 분기(selected/striped/
    //   header/기본)를 projection 이 계산해 style.backgroundColor 보편 D3 데이터로 주입한다.
    //   buildCatalogShapes 는 행 종류를 모른 채 style.backgroundColor 우선 경로로 box 를 그린다
    //   (컴포넌트 식별 분기 0, ADR-142 §3).
    //   selected 배경 = {color.accent} (ADR-909 후속 2026-06-22): reference
    //   (react-aria-starter Table.css [data-selected] = --highlight-background filled accent)
    //   + design.md:314 정본. 이전 {color.accent-subtle} 는 --highlight-overlay 계보 오차용
    //   (reference 선택행 미사용) → filled accent 로 정정. 셀 전경은 {color.on-accent}(아래 cell
    //   projection) 로 contrast 확보 — CSS Table.css --tbl-selected-bg/color 와 D3 symmetric.
    //   striped·header={color.layer-2} / 기본={color.base}.
    const rowBg = row.isSelected
      ? "{color.accent}"
      : isHeader || striped
        ? "{color.layer-2}"
        : "{color.base}";
    addSceneNode(
      {
        id: rowId,
        type: "TableRow",
        props: {
          size,
          // _rowWidth: table_row_divider skiaPrimitive 가 하단 line 폭에 사용(전체 컬럼 합).
          _rowWidth: totalWidth,
          // ADR-912 cutover: 셀 가로 배치(display:flex/row)를 projection 이 직접 주입. 이전엔
          //   TableRowSpec.containerStyles → resolveContainerStylesFallback 경유였으나 spec body
          //   삭제 대비 render-space 명시 주입(ADR-135 정합).
          style: {
            width: totalWidth,
            backgroundColor: rowBg,
            display: "flex",
            flexDirection: "row",
          },
        },
        parentId: rowsGroupId,
        pageId: scope.pageId,
        layoutId: scope.layoutId,
        parent_id: rowsGroupId,
        page_id: scope.pageId,
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
      // ADR-159 P5: array 셀 → TagGroup placeholder / object 셀 → 휴리스틱 label 텍스트.
      //   header 는 항상 텍스트(col.label). 분류는 shared 단일 소스(classifyTableCellDisplay)
      //   — DOM Table 셀 렌더와 동일 판정 (G2 대칭).
      const display = isHeader
        ? { kind: "text" as const, text: col.label }
        : classifyTableCellDisplay(row.rawCells[col.id]);
      const cellId = toCollectionCellProjectionId(
        "table",
        tableSceneNode.id,
        row.rowKey,
        col.id,
      );
      if (display.kind === "tags") {
        // 칩 placeholder 셀: cell 은 flex row 컨테이너(텍스트 없음), Tag 자식이 칩 시각.
        //   paddingX 는 catalog TableCell sizes(sm 8/md 12/lg 16) 와 정렬 — 텍스트 셀의
        //   catalog padding 은 시각 전용이라 자식 layout 에 미적용되므로 명시 주입.
        const cellPaddingX = size === "sm" ? 8 : size === "lg" ? 16 : 12;
        addSceneNode(
          {
            id: cellId,
            type: "TableCell",
            props: {
              size,
              style: {
                width: col.width,
                flexGrow: 0,
                flexShrink: 0,
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                columnGap: 4,
                paddingLeft: cellPaddingX,
                paddingRight: cellPaddingX,
              },
            },
            parentId: rowId,
            pageId: scope.pageId,
            layoutId: scope.layoutId,
            parent_id: rowId,
            page_id: scope.pageId,
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
        const chipLabels =
          display.overflow > 0
            ? [...display.items, `+${display.overflow}`]
            : display.items;
        chipLabels.forEach((chipLabel, chipIndex) => {
          addSceneNode(
            {
              id: `${cellId}::tag-${chipIndex}`,
              type: "Tag",
              props: {
                children: chipLabel,
                size,
                // appendTagRowProjection 동형: chip 폭 = 라벨 + padding (fit-content).
                style: { width: "fit-content" },
              },
              parentId: cellId,
              pageId: scope.pageId,
              layoutId: scope.layoutId,
              parent_id: cellId,
              page_id: scope.pageId,
              // cell 과 동일 메타 — deep hit 시 cell 과 같은 라우팅(owner select redirect).
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
        });
        continue;
      }
      const cellText = display.text;
      addSceneNode(
        {
          id: cellId,
          type: "TableCell",
          props: {
            size,
            children: cellText,
            // ADR-912 Pattern B (TableCell catalog cutover, 2026-06-13): header/data 굵기 분기를
            //   projection 이 style.fontWeight 보편 D3 데이터로 주입(header 600 / data 400).
            //   buildCatalogShapes 는 셀 종류를 모른 채 style.fontWeight 우선 경로로 그린다
            //   (컴포넌트 식별 분기 0, ADR-142 §3). 정렬은 left 기본(spec _align ?? "left" 동형) —
            //   명시 정렬 필요 시 style.textAlign 주입(현재 모든 컬럼 left). 컬럼 폭 내 ellipsis 는
            //   style.width(노드 clip)로 처리(spec maxWidth = columnWidth - paddingX*2 동형 근사).
            //   selected 행 셀 전경 = {color.on-accent} (ADR-909 후속 2026-06-22): filled accent
            //   배경(rowBg {color.accent}) 위 흰 전경 contrast. CSS Table.css [data-selected]
            //   color: var(--tbl-selected-color=--fg-on-accent) 와 D3 symmetric. 미선택 셀은
            //   color 미주입 → catalog TableCell colors.text({color.neutral}) 유지.
            style: {
              width: col.width,
              flexGrow: 0,
              flexShrink: 0,
              fontWeight: isHeader ? 600 : 400,
              textAlign: "left",
              ...(row.isSelected ? { color: "{color.on-accent}" } : {}),
            },
          },
          parentId: rowId,
          pageId: scope.pageId,
          layoutId: scope.layoutId,
          parent_id: rowId,
          page_id: scope.pageId,
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
  };

  // ADR-150 A2 (Table 확산): header 는 항상 투영 + data 행만 window. 첫 data 행 직전에 lead
  //   spacer, 마지막 뒤에 trail spacer 로 window 밖 data 행 높이를 채운다 — window data 행이
  //   절대 위치(startIndex*rowHeight)에 오도록 밀어내고 총 content height(header + 전체 data)를
  //   보존(스크롤바 정확). header 는 스크롤 content 의 일부(sticky 아님)라 spacer 는 header 아래.
  //   Table 은 1열(columns 미지정) — visual row = data row index.
  const rowHeight = windowResolution?.rowHeight ?? 0;
  const spacerRows = windowResolution
    ? resolveCollectionSpacerVisualRows(windowResolution)
    : { lead: 0, trail: 0 };
  const addTableSpacer = (
    position: "lead" | "trail",
    visualRows: number,
  ): void => {
    if (visualRows <= 0 || rowHeight <= 0) return;
    // ADR-157 Phase 4: sample mode 는 trailing data 행 영역을 빈 spacer 대신 hatch placeholder 로
    //   emit(ListBox/GridList 동형). Table owner 높이는 child-sum(header + 샘플 data 행 + hatch)이라
    //   §1.55c 류 layout 주입 불필요 — hatch 노드의 명시 height 가 child-sum 에 그대로 합산된다.
    //   lead 는 항상 spacer(sample 모드에서 startIndex 0 이라 lead=0). scroll mode(A2)는 종전 spacer.
    if (position === "trail" && windowResolution?.mode === "sample") {
      addSceneNode(
        createCollectionRemainderNode({
          family: "table",
          ownerId: tableSceneNode.id,
          rowsGroupId,
          height: visualRows * rowHeight,
          hiddenRows: visualRows,
          scope,
          sourceNode,
        }),
        graph,
      );
      return;
    }
    addSceneNode(
      createCollectionSpacerNode({
        family: "table",
        kind: "table-spacer",
        ownerId: tableSceneNode.id,
        rowsGroupId,
        position,
        height: visualRows * rowHeight,
        scope,
        sourceNode,
      }),
      graph,
    );
  };
  let dataStarted = false;
  for (const row of rows) {
    if (row.kind === "data" && !dataStarted) {
      dataStarted = true;
      addTableSpacer("lead", spacerRows.lead);
    }
    addRow(row);
  }
  addTableSpacer("trail", spacerRows.trail);
}

// ---------------------------------------------------------------------------
// ADR-912 영역 B (A) — TagGroup chip projection (wrap-flow row family)
// ---------------------------------------------------------------------------
//
// GridList(1단 row, origin/anchor 없음, factory children:[]) 와 동형이되 2점 차이:
//   1) **owner = TagList scene node** (TagGroup 이 아님). TagGroup factory 가 Label + TagList
//      중간 컨테이너를 만들고 items/variant/size/allowsRemoving/maxRows 를 TagList 로 propagate
//      (TagGroup.spec propagation, allowsRemoving 은 override:true 로 토글 즉시 반영). chip 좌표계 =
//      TagList node — projection 을 TagList 에 붙인다.
//   2) **rowsGroup = flexWrap:"wrap" row** (세로 stack 아닌 가로 wrap-flow). 수동 wrap 시뮬레이션
//      (구 TagList.spec render.shapes 라인 299-333) 폐기 — chip width:fit-content + Taffy
//      flex-wrap 이 행 배치를 담당(GridList grid 모드의 flexWrap 패턴과 동형).
//   3) chip 의 remove(X)는 chip 본체(Tag)가 catalog cutover 후 **trailing_icon**(buildCatalogShapes
//      가 rule.trailingIcon{name:"x"} 를 text 우측에 icon_font glyph 로 덧그림, props.allowsRemoving
//      조건). X = line 이 아니라 Lucide "x" glyph(SelectIcon/SearchField clear 동일 데이터, DOM Button
//      slot=remove 와 시각 대칭). chip 에 allowsRemoving 전달(아래) → buildCatalogShapes 조건부 렌더.
//      독립 hit/remove mutation 은 후속(현 slice 시각 대칭 — chip select redirect 까지).

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
 * owner TagGroup lookup — TagList sourceNode 를 자식으로 갖는 TagGroup 노드의 props 를 역추적.
 * findOwnerTabsProps 대칭 (Tab 선례).
 */
function findOwnerTagGroupProps(
  tagListSourceId: string,
  getDocumentNodesById: () => Map<string, CanonicalNode>,
): Record<string, unknown> | null {
  for (const node of getDocumentNodesById().values()) {
    if (node.type !== "TagGroup") continue;
    const children = node.children;
    if (
      Array.isArray(children) &&
      children.some((c) => c.id === tagListSourceId)
    ) {
      return (node.props ?? null) as Record<string, unknown> | null;
    }
  }
  return null;
}

/**
 * data-bound TagList 의 projection rows 계산 (gating). items 는 TagGroup.props.items 가
 * propagation 경유로 TagList.props.items 에 전파되어 있다(TagGroup.spec propagation). dataBinding
 * (api/collection) 도 동일 getFlatProjectionRows 3경로로 흡수. rows 0개면 null → 발효 전
 * standalone render.shapes 유지(회귀 0). chip 1개 = 1 row.
 *
 * **owner-first fallback**: propagation rule `{ parentProp:"items", childPath:"TagList",
 * override:true }` 는 부모 TagGroup.items 를 정본으로 두고 자식 TagList.items 를 덮어쓴다.
 * 하지만 Inspector ItemsManager 의 "Add Tag"(store.addItem)는 TagGroup.props.items 만 갱신하고
 * propagation 을 트리거하지 않아 TagList.props.items 가 stale(factory 초기값) 로 남는다. DOM 은
 * TagGroup.props.items 를 직접 소비해 즉시 반영되지만, Skia 는 stale TagList.items 를 읽어 새 chip
 * 이 누락됐다. dataBinding 이 없을 때 owner TagGroup.items 를 우선 사용해 override 정본을 Skia 시점에
 * 방어적으로 복원(Tab 의 owner fallback 대칭, 단 Tab 은 `!hasItems` 조건이고 Tag 는 override:true
 * 정본이라 owner 를 항상 우선). owner 미발견 시 기존 TagList.props 로 회귀.
 */
function resolveDataBoundTagProjection(
  tagListSceneNode: CanvasSceneNode,
  sourceNode: CanonicalNode,
  options: BuildCanvasSceneGraphOptions,
  getDocumentNodesById: () => Map<string, CanonicalNode>,
): { rows: ListBoxProjectionRow[]; sourceNode: CanonicalNode } | null {
  if (!isTagListSceneSource(tagListSceneNode, sourceNode)) return null;

  const dataBinding = getElementDataBinding(sourceNode);

  // owner-first: dataBinding 없을 때만 owner TagGroup.items 로 stale TagList.items 를 대체.
  //   dataBinding(collection/api) 이 있으면 그 경로가 items 보다 우선하므로 owner 조회 skip.
  let resolvedProps = tagListSceneNode.props;
  if (!dataBinding) {
    const ownerProps = findOwnerTagGroupProps(
      sourceNode.id,
      getDocumentNodesById,
    );
    if (ownerProps && Array.isArray(ownerProps.items)) {
      // TagList.props 우선 + owner TagGroup.items 로 override(정본). variant/size/allowsRemoving 등
      //   나머지 chip 속성은 기존 TagList.props 를 존중(propagation 정상 동작 시 이미 채워짐).
      resolvedProps = { ...tagListSceneNode.props, items: ownerProps.items };
    }
  }

  const rows = getListBoxProjectionRows({
    collections: options.collections,
    dataBinding,
    props: resolvedProps,
  });
  if (rows.length === 0) return null;

  return { rows, sourceNode };
}

/**
 * TagGroup chip projected tree 생성: RowsGroup(flex wrap row) → Tag chip[i] (+ remove cell).
 *
 * - rowsGroup: 가로 flex row + flexWrap:wrap → chip 들이 컨테이너 폭에서 자동 줄바꿈(Taffy 위임,
 *   수동 wrap 계산 없음). gap = chip 간격(size 토큰 gap, propagation 으로 TagList 좌표계).
 * - chip(Tag): width:fit-content → 라벨 폭 + padding 만큼만. catalog cutover 후 buildCatalogShapes
 *   가 box+text generic 렌더(_isSelected → selected variant). allowsRemoving=true 시 chip 에
 *   allowsRemoving 전달 → buildCatalogShapes 가 rule.trailingIcon{name:"x"} 를 text 우측에
 *   icon_font glyph 로 덧그림(remove X). X = line 아니라 Lucide "x" glyph. 단일클릭은 owner
 *   (TagGroup) select redirect, remove mutation 은 후속(proof scope).
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
  // ADR-907 Layer D: chip 간 gap 정본 = TagList catalog rule(sm/md=4, lg=6). 이전 `props.gap ?? 4`
  //   하드코딩은 catalog 를 무시해 lg 에서 layout height 계산(resolveTagChipMetric=6)과 배치(4)가
  //   비대칭이었다. 사용자 명시 props.gap 은 존중, 없으면 size 별 catalog gap read-through.
  const gap =
    typeof props.gap === "number"
      ? (props.gap as number)
      : resolveTagListGap(typeof size === "string" ? size : "md");

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
        // alignContent:flex-start — flex-wrap 다중 행을 컨테이너 상단에 붙인다. 미설정 시 Taffy
        //   기본(stretch/분산)이 컨테이너 height > 행 총합일 때 chip 행 사이를 벌려 세로 gap 발산
        //   (maxRows gap 버그 근본, 2026-07-02). height 를 RowsGroup 실측으로 맞춰도 이 분산이
        //   남으므로 flex-start 로 명시 고정. CSS(TagGroup.css .react-aria-TagList)도 동일 상단 정렬.
        alignContent: "flex-start",
      },
    },
    parentId: tagListSceneNode.id,
    pageId: scope.pageId,
    layoutId: scope.layoutId,
    parent_id: tagListSceneNode.id,
    page_id: scope.pageId,
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
      // chip 폭 = 라벨 + padding (+ allowsRemoving 시 trailing X) — Tag rule(catalog cutover) inline-flex.
      //   wrap-flow 에서 각 chip 이 fit-content 로 자연 폭을 갖고 Taffy flexWrap 이 행 배치.
      style: { width: "fit-content" },
      _isSelected: isListBoxRowSelected(props, row.itemKey, row.rowIndex),
    };
    if (variant) chipProps.variant = variant;
    if (size) chipProps.size = size;
    if (row.isDisabled) chipProps.isDisabled = true;
    // 항목별 leading icon (2026-08-21): itemSchema 의 `icon` 을 chip props 로 전달한다.
    //   Tag rule 의 `leadingIcon.nameProp: "icon"` 이 이 값을 읽어 glyph + text shift 를 만들고,
    //   값이 없는 chip 은 아이콘 없이 기존 폭을 유지한다(레이아웃 폭 계산도 같은 조건).
    //   `row.icon` 은 resolveCollectionItems 가 정규화한 필드(ADR-147, ListBox 행과 동일 소스).
    if (row.icon) chipProps.icon = row.icon;
    // 항목별 avatar 이미지 (2026-08-21): Tag rule 의 `leadingAvatar.srcProp: "avatar"` 가 읽는다.
    //   icon 과 **같은 좌측 슬롯**이라 둘 다 실려도 `resolveLeadingSlot` 이 avatar 하나만 그린다
    //   (DOM `renderTagLeadingSlot` 과 같은 우선순위). row.avatar 는 값이 이미지 참조일 때만
    //   채워지므로 glyph 이름이 아바타로 새지 않는다(getItemAvatar/getItemIcon 분리).
    if (row.avatar) chipProps.avatar = row.avatar;
    // ADR-912 영역 B (A) — Tag catalog cutover (2026-06-12): X(remove)는 chip 본체가 line×2 로
    //   직접 그리던 것(Tag.spec)을 폐기하고 **trailing_icon(icon_font "x" Lucide glyph)**으로 그린다
    //   — X = line 이 아니라 icon 데이터(SelectIcon/SearchField clear 와 동일 Lucide "x"), DOM Button
    //   slot=remove ✕ 와 시각 대칭. buildCatalogShapes 가 text 우측에 trailing X 를 덧그린다
    //   (TreeItem leading_icon 의 trailing 변형). allowsRemoving 데이터로 조건부(rule.trailingIcon
    //   정적, allowsRemoving=false 면 skip). 독립 hit/remove mutation 은 후속(현 slice 는 시각 대칭).
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

  // maxRows "Show all" chip — RSP 표준(지정 행 초과 tag 접기 + 펼치기 트리거).
  //   maxRows 설정 시 항상 emit 하되, 실제 표시(접힘 발생) 여부는 render 게이트가 폭 기반
  //   wrap sim(shouldShowAll)으로 판정해 조건부 skip 한다(projection 은 폭 미보유). rowIndex 는
  //   전체 item 뒤(rows.length) — render 게이트의 `rowIndex >= visibleItemCount` skip 대상이
  //   아니도록 `_isShowAll` 마커로 제외. 시각(투명 배경 + accent 텍스트)은 buildCatalogShapes
  //   Tag 분기가 `_isShowAll` 로 분기.
  if (typeof props.maxRows === "number" && props.maxRows > 0) {
    const showAllId = toCollectionRowProjectionId(
      "tag",
      tagListSceneNode.id,
      "__show_all__",
    );
    addSceneNode(
      {
        id: showAllId,
        type: "Tag",
        props: {
          // CSS(TagGroup.tsx)는 "Show all (N)" — 전체 tag 수 표기. rows = 전체 items 기반.
          children: `Show all (${rows.length})`,
          style: { width: "fit-content" },
          _isShowAll: true,
          ...(size ? { size } : {}),
        },
        parentId: rowsGroupId,
        pageId: scope.pageId,
        layoutId: scope.layoutId,
        parent_id: rowsGroupId,
        page_id: scope.pageId,
        projection: {
          kind: "tag-row",
          listBoxId: tagListSceneNode.id,
          itemKey: "__show_all__",
          rowIndex: rows.length,
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
      // ADR-161 (근본 수정): ref 인스턴스의 scene node `type` 을 master origin 의 type 으로
      //   해석한다. 기존엔 `type:"ref"` 를 유지해(toCanvasSceneNode:592) type 기반 projection
      //   gate 가 ref 를 인식하지 못했다 — ListBox 만 `isListBoxSceneSource` 에 개별 ref 분기를
      //   두어 통과했고, GridList `isGridListSceneSource` 는 `sourceNode.type==="ref" → false`
      //   로 오히려 차단했다(신규 GridList 카드 미 projection). master type 을 단일 지점에서
      //   해석하면 모든 collection gate 가 `sceneNode.type` 로 일관 통과 → gate 별 ref 분기
      //   중복이 불요해진다. scene node 는 `.ref` 로 ref-identity 를 계속 보유하며, 외부
      //   프로덕션 코드는 `CanvasSceneNode.type==="ref"` 를 읽지 않는다(전부 canonical
      //   node.type 소비). page placeholder ref 는 별도 렌더 경로라 제외(isRenderableRef 대칭).
      if (node.type === "ref" && !isPagePlaceholderNode(node)) {
        const masterType = getDocumentNodesById().get(
          (node as RefNode).ref,
        )?.type;
        if (typeof masterType === "string" && masterType !== "ref") {
          sceneNode.type = masterType;
        }
      }
      // ADR-148 Phase 0: ListBoxItem 자체(주로 Components 페이지 origin)의 slot 조합
      //   자식 구성을 자기 scene props 에 주입 — 아래 suppression 으로 자식 노드는 scene
      //   에서 빠지므로, `listbox_item` escape 가 origin 자체 렌더에서도 구성(존재/순서/
      //   스타일)을 따르게 한다 (origin 편집 → Components 페이지 즉시 반영).
      if (node.type === "ListBoxItem" && node.children?.length) {
        const ownSlotComposition = resolveSlotComposition(node.children);
        if (ownSlotComposition) {
          (sceneNode.props as Record<string, unknown>)._slots =
            ownSlotComposition;
        }
      }
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

    // data-bound collection projection 컨테이너는 box 경로(buildBoxNodeData)로 렌더돼 catalog
    //   "shell variant" 배경(`{color.raised}`)을 그리지 못한다(catalog 경로만 shell 담당). 사용자
    //   배경이 없을 때만 collectionShellTag 을 심어 render 단이 theme-aware 로 배경을 복원 —
    //   투명 컨테이너에서 컨테이너 box-shadow(drop-shadow)가 자식 행 실루엣을 캡처하던 문제 봉쇄.
    if (sceneNode && !sceneNode.fills?.length) {
      const inlineBg = (
        sceneNode.props?.style as Record<string, unknown> | undefined
      )?.backgroundColor;
      if (inlineBg == null) {
        if (listBoxProjection) sceneNode.collectionShellTag = "ListBox";
        else if (gridListProjection) sceneNode.collectionShellTag = "GridList";
      }
    }

    // ADR-912 영역 B (A): TagGroup chip projection (owner=TagList scene node, wrap-flow row).
    //   TagList factory children:[] (items propagation) → suppression 불필요, append 만.
    const tagProjection = sceneNode
      ? resolveDataBoundTagProjection(
          sceneNode,
          node,
          options,
          getDocumentNodesById,
        )
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
      // ADR-148 Phase 0 (구 ADR-147): ListBoxItem 의 slot 조합 자식(Icon/Label/Description)은
      //   독립 scene 노드로 세우지 않는다 — 구성·스타일이 projection 의 `_slots` 로 접혀
      //   `listbox_item` skiaPrimitive escape(단일 replace paint)와 DOM emit 이 소비하므로,
      //   가시 scene 에 그대로 두면 세로 stacked 이중 렌더가 된다. (구 주석의 "spec
      //   render.shapes 단일 렌더러" 는 ADR-912 가 물리 삭제한 경로 참조라 정정 — 2026-07-17)
      //
      // 단, reusable origin(Components 페이지)은 접지 않는다 (2026-07-17): slot 자식이
      //   scene/interaction node 로 서야 더블클릭 drill/선택/편집이 가능하다 (Card origin ·
      //   DOM renderer children-first 와 동형 authoring 표면). 이중 렌더는 escape 의
      //   `_hasChildren` shell gating 이 차단 (buildSpecNodeData 가 자식 실재 시만 주입).
      if (
        (node.type === "ListBoxItem" ||
          node.type === "GridListItem" ||
          node.type === "MenuItem") &&
        node.reusable !== true &&
        getSlotRole(child) != null
      ) {
        // ADR-148 Phase 4: GridListItem/MenuItem origin 의 slot 조합 자식도 동일 접힘 —
        //   gridlist_card escape / DOM emit 이 `_slots` 로 소비 (독립 scene 노드 금지).
        return;
      }
      // reusable origin(위 fold 미해당)의 label slot 자식은 catalog Text(400) leaf 렌더 →
      //   collection item label 정본 600(catalog {Item}.textWeight + CSS [slot=label] + escape)
      //   과 어긋난다. render-time 에 600 주입해 origin·instance·CSS 정합 (2026-07-21 사용자 보고).
      visit(injectCollectionLabelWeight(node, child), nextParentId, nextScope);
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
        options.activeBreakpoint ?? "desktop",
      );
    }
    if (sceneNode && gridListProjection) {
      appendGridListRowProjection(
        sceneNode,
        gridListProjection,
        nextScope,
        graph,
        getDocumentNodesById,
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

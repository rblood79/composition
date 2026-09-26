/**
 * ADR-150 A2 (ListBox 선행 proof): 가상화 대상 collection owner 의 window 해석.
 *
 * canonical document 를 1회 walk 하여 **bounded height + overflow scroll/auto 인 data-bound
 * ListBox** 를 찾고, 각 owner 의 scrollOffset 기반 window(`resolveCollectionWindow`)를 산출한다.
 * 결과 map 은 `buildCanvasSceneGraph(options.collectionWindows)` 의 단일 소스로 주입되어
 * draw/hit tree 가 **동일 window** 를 공유한다(R2). 미포함 owner 는 legacy 정적 cap 투영(BC).
 *
 * **행 위치 (ADR-150 A2')**: 행 높이는 행마다 잰다 — ListBox 는 행 style (origin ◁ anchor ◁ 선택
 * variant) + description 유무, GridList 는 시각 행의 카드 최대, Table 은 catalog `TableRow.sizes`.
 * layout `calculateContentHeight` 와 같은 metric 함수를 쓰고, window · spacer · 스크롤 범위는
 * `resolveCollectionRowOffsets` 한 곳이 만든다. owner props 는 ref instance 면 origin props 위에
 * instance patch 를 얹은 값이다 (scene 과 같은 규칙). 잔존 한계: label · description **줄바꿈 (wrap)**
 * 과 템플릿 밖 임의 자식 콘텐츠 높이는 layout 전에 알 수 없어 반영하지 않는다 (ADR-150 R1).
 *
 * **비-데이터 ListBox 무영향**: totalRows 0(자식 ListBoxItem 직접 구성)이면 map 에 미포함 →
 * projection 자체가 없어 window 도 무의미. scene 빌더가 data-bound 여부로 실제 투영을 gating 한다.
 */

import type {
  BreakpointName,
  CanonicalNode,
  CompositionDocument,
  StateTemplateEnv,
  VariableDef,
} from "@composition/shared";
import {
  createDefaultValueEnv,
  resolveVisibleVariablesForElement,
  resolveCollectionItems,
  resolveCollectionWindow,
  resolveBindingSelectionMode,
  resolveBindingSelectionStyle,
  resolveSelectionCheckboxVisible,
  resolveSlotComposition,
  isSlotEnabled,
  getTableProjectionRows,
  COLLECTION_ROW_PROJECTION_SAMPLE_LIMIT,
  DEFAULT_COLLECTION_OVERSCAN,
  type CollectionDataSource,
  type CollectionWindow,
} from "@composition/shared";
import {
  resolveCardSelectionExtra,
  resolveGridListItemMetric,
  resolveGridListSpacingMetric,
  getTextLineHeight,
  COLLECTION_TEXT_DEFAULT_FONT_SIZE,
  parsePadding4Way,
  parsePxValue,
  resolveListBoxSpacingMetric,
} from "@composition/specs";

import { getElementDataBinding } from "../../../../adapters/canonical/compositionExtensionFields";
import {
  calculateContentHeight,
  resolveListBoxItemRowHeightFromStyle,
} from "../layout/engines/utils";
import { resolveSkiaRule } from "../skia/resolveSkiaVisualRule";
import { resolveBorderGeometry } from "../styleConversion/borderGeometry";
import { resolveResponsiveStyleMap } from "../layout/resolveResponsive";
import { getListBoxProjectionRows } from "../../../components/listbox/listBoxRowProjectionModel";
import {
  getListBoxTemplateAnchor,
  resolveGridListCardContext,
  resolveCollectionRowDescription,
  resolveListBoxRowContext,
  resolveListBoxRowLayoutStyle,
  isListBoxRowSelected,
  type ListBoxRowContext,
  resolveGridListTemplateOriginId,
  resolveListBoxTemplateOriginId,
  resolveTemplateOriginNode,
  resolveSceneRefChain,
  type CollectionWindowResolution,
} from "./canvasSceneNode";
import { applyPropsPatch } from "../../../../adapters/canonical/instanceResolver";
import { readTableHeaderColumnNodes } from "../../../components/tableColumnInsert";
import { flattenCanonicalDocumentNodes } from "./canonicalSceneModel";
import {
  expandedCardHeightsVersionOf,
  noteExpandedCardWindow,
  pruneExpandedCardOwners,
  resolveExpandedCardHeights,
  toVisualRowHeights,
} from "./expandedCardHeights";
import {
  resolveCollectionRowOffsets,
  type CollectionRowOffsets,
} from "./collectionRowOffsets";

/**
 * catalog ListBoxItem 기본 행 높이(description 없음) = paddingY*2 + label line box = 4*2 + 24 = 32.
 * label 은 react-aria-Text 기본 16 → getTextLineHeight(16)=24 (라이브 실측 2026-07-22). row resolver
 * 와 동일 심볼(resolveListBoxItemRowHeightFromStyle)로 산출해 fallback 상수와 실 stride 를 정합.
 */
export const DEFAULT_LISTBOX_ROW_HEIGHT = resolveListBoxItemRowHeightFromStyle(
  undefined,
  false,
);

/** style 에서 numeric px 높이 추출. `400`/`"400"`/`"400px"` → 400, 그 외 null(=unbounded). */
function readBoundedHeightPx(
  style: Record<string, unknown> | undefined,
): number | null {
  const raw = style?.height ?? style?.maxHeight;
  if (typeof raw === "number") return raw > 0 ? raw : null;
  if (typeof raw === "string") {
    const match = /^(\d+(?:\.\d+)?)(?:px)?$/.exec(raw.trim());
    if (match) {
      const n = Number.parseFloat(match[1]);
      return n > 0 ? n : null;
    }
  }
  return null;
}

/** overflow-y 가 scroll/auto 인지 — 스크롤 컨테이너(가상화 대상) 판정. */
function isScrollOverflow(style: Record<string, unknown> | undefined): boolean {
  const overflowY = style?.overflowY ?? style?.overflow;
  return overflowY === "scroll" || overflowY === "auto";
}

/**
 * ListBox owner node 판정 — 직접(`type:"ListBox"`, Components 페이지 origin) 또는 **ref
 * 인스턴스**(페이지에 놓인 ListBox 는 origin 을 가리키는 `type:"ref"` + `name/componentName
 * "ListBox"`). 후자 누락 시 실제 페이지 ListBox 가 가상화되지 않는다(2026-07-19 live 검증에서
 * 발견 — 유닛 fixture 가 type:"ListBox" 직접 노드만 써서 갭이 은폐됨). scene 빌더의
 * `isListBoxSceneSource`(componentName/name "ListBox") 와 동일 판정.
 */
function isListBoxOwnerNode(node: CanonicalNode): boolean {
  if (node.type === "ListBox") return true;
  if (node.type !== "ref") return false;
  const record = node as unknown as {
    name?: unknown;
    componentName?: unknown;
  };
  return record.name === "ListBox" || record.componentName === "ListBox";
}

/**
 * GridList owner node 판정 — 직접(`type:"GridList"`) 또는 ref 인스턴스(`type:"ref"` +
 * name/componentName "GridList"). scene 빌더 `isGridListSceneSource` 와 동일 판정.
 */
function isGridListOwnerNode(node: CanonicalNode): boolean {
  if (node.type === "GridList") return true;
  if (node.type !== "ref") return false;
  const record = node as unknown as {
    name?: unknown;
    componentName?: unknown;
  };
  return record.name === "GridList" || record.componentName === "GridList";
}

/**
 * Table owner node 판정 — 직접(`type:"Table"`) 또는 ref 인스턴스(`type:"ref"` +
 * name/componentName "Table"). scene 빌더 `isTableSceneSource` 와 동일 판정.
 */
function isTableOwnerNode(node: CanonicalNode): boolean {
  if (node.type === "Table") return true;
  if (node.type !== "ref") return false;
  const record = node as unknown as {
    name?: unknown;
    componentName?: unknown;
  };
  return record.name === "Table" || record.componentName === "Table";
}

/**
 * owner 의 유효 props — ref instance (팔레트 요소) 는 origin props 위에 instance patch 를 얹는다.
 * scene 이 owner scene node props 를 만드는 규칙 (canvasSceneNode visit, ADR-228/234) 과 같다.
 * raw instance props 만 읽으면 origin 에만 있는 `size` (Table origin "sm") · `columns` · `gap` 을
 * 놓쳐 spacer · 스크롤 범위가 Canvas layout 과 갈린다 (ADR-150 Phase 1 live, 2026-09-27).
 */
// view 는 문서 identity 로 캐시한다 — 아래 plan 캐시가 owner 노드 객체를 key 로 쓰므로 스크롤마다
//   새 view 를 만들면 행 높이 목록을 매번 다시 잰다.
const ownerPropsViewCache = new WeakMap<
  CanonicalNode,
  { doc: CompositionDocument; view: CanonicalNode }
>();

function resolveOwnerPropsView(
  node: CanonicalNode,
  doc: CompositionDocument,
  nodesById: ReadonlyMap<string, CanonicalNode>,
): CanonicalNode {
  if (node.type !== "ref") return node;
  const cached = ownerPropsViewCache.get(node);
  if (cached && cached.doc === doc) return cached.view;
  const chain = resolveSceneRefChain(
    (node as unknown as { ref: string }).ref,
    nodesById,
  );
  const view =
    !chain?.props || chain.master.type === "ref"
      ? node
      : ({
          ...node,
          props: applyPropsPatch(
            chain.props,
            (node.props ?? {}) as Record<string, unknown>,
          ),
        } as CanonicalNode);
  ownerPropsViewCache.set(node, { doc, view });
  return view;
}

/** 가상화 대상 collection owner family 판정 (미해당 = null). */
function resolveCollectionOwnerKind(
  node: CanonicalNode,
): "listbox" | "gridlist" | "table" | null {
  if (isListBoxOwnerNode(node)) return "listbox";
  if (isGridListOwnerNode(node)) return "gridlist";
  if (isTableOwnerNode(node)) return "table";
  return null;
}

/**
 * Table 행 높이(px) — catalog `TableRow.sizes[size].height` 를 직접 읽는다 (ADR-150 A2' — 구 상수
 * 미러 36/44/52 는 값만 같은 두 번째 소스였다). header·data 행 모두 같은 size.
 */
function resolveTableRowHeight(
  props: Record<string, unknown> | undefined,
): number {
  const size = props?.size;
  const key = size === "sm" || size === "lg" ? size : "md";
  const sizes = resolveSkiaRule("TableRow")?.sizes as
    Record<string, { height?: unknown }> | undefined;
  const height = sizes?.[key]?.height;
  return typeof height === "number" && height > 0 ? height : 44;
}

/**
 * ADR-150 A2' — ADR-241 요소 헤더 (TableHeader > Column) 의 높이. layout 이 Column 셀 높이를 재는
 * 같은 함수 (`calculateContentHeight` §1.56 — catalog Column md = lineHeight 24 + paddingY 8·2 = 40)
 * 로 Column 마다 재고 최대를 쓴다. 열은 Preview · quick connect 와 같은 reader (`readTableHeaderColumnNodes`)
 * 로 읽는다 — ref instance (팔레트 · quick connect) 는 문서 자식이 없고 열이 origin 또는 mode C
 * `descendants` 에 있다 (2026-09-27 live: 헤더 40 인데 36 으로 읽어 스크롤 범위 4px 부족).
 * 요소 헤더가 없으면 null (projection 헤더 행 = 행 높이).
 */
function resolveTableElementHeaderHeight(
  node: CanonicalNode,
  nodesById: ReadonlyMap<string, CanonicalNode>,
): number | null {
  const columns = readTableHeaderColumnNodes(node, nodesById);
  if (columns.length === 0) return null;
  let max = 0;
  for (const column of columns) {
    const height = calculateContentHeight(
      column as unknown as Parameters<typeof calculateContentHeight>[0],
      undefined,
    );
    if (height > max) max = height;
  }
  return max > 0 ? max : null;
}

/** Table 한 장의 행 위치 입력 — data 행 균일 높이, 헤더는 행 영역 앞 여백 (행 묶음 rowGap 없음). */
function resolveTableRowPlan(
  node: CanonicalNode,
  props: Record<string, unknown> | undefined,
  nodesById: ReadonlyMap<string, CanonicalNode>,
  breakpoint: BreakpointName,
): ListBoxRowPlan & { rowHeight: number } {
  const rowHeight = resolveTableRowHeight(props);
  const headerHeight =
    resolveTableElementHeaderHeight(node, nodesById) ?? rowHeight;
  // owner 여백은 layout 과 같이 responsive override 반영.
  const style = resolveResponsiveStyleMap(
    (props?.style as Record<string, unknown> | undefined) ?? {},
    node.responsive,
    breakpoint,
  );
  const padding = parsePadding4Way(style);
  const [borderTop, , borderBottom] = resolveBorderGeometry(style).widths;
  return {
    heights: [],
    gap: 0,
    rowHeight,
    leadingExtent: borderTop + padding.top + headerHeight,
    trailingExtent: padding.bottom + borderBottom,
  };
}

/**
 * GridList 의 **시각 행 stride**(px) + 열 수(numCols). stride = 카드 높이 + rowGap 이며,
 * grid 모드는 한 시각 행에 numCols 카드가 배치된다(stack 은 numCols 1). 카드 높이는
 * `cardPaddingY*2 + 선택 블록 + labelLine + (desc? descLine + descGap : 0)` 근사 — layout §1.55c 의
 * border-box 높이와 달리 카드 border 를 더하지 않는다. description 유무는 소유자 항목 origin
 * (`resolveGridListTemplateOriginId`) 의 slot 구성으로 gating — appendGridListRowProjection 동형.
 *
 * ADR-150 A2' 뒤로 이 값은 resolution 의 대표 `rowHeight` · 열 수만 채운다 (근사로 충분한 이유).
 * window · spacer · 스크롤 범위 · 주입 높이는 border 를 포함한 시각 행별 높이 목록
 * (`resolveGridListRowPlan`) 과 행 위치 단일 소스가 만든다.
 */
function resolveGridListRowStride(
  node: CanonicalNode,
  sampleDescription: string | null | undefined,
  getDocNodes: () => Map<string, CanonicalNode>,
): { rowHeight: number; columns: number } {
  const props = node.props as Record<string, unknown> | undefined;
  const style = props?.style as Record<string, unknown> | undefined;
  // 2026-07-29: prop 부재 fallback 도 grid (catalog `GridList.binding.ts` layout.default 정합).
  const layout = String(props?.layout ?? "grid") === "grid" ? "grid" : "stack";
  const metric = resolveGridListSpacingMetric({
    style,
    layout,
    columns: Number(props?.columns ?? 2) || 2,
  });
  // ADR-162 Phase 1 — 소유자 자기 항목 origin (scene 투영과 같은 해석 — 상수 기본 origin 아님).
  const origin = getDocNodes().get(
    resolveGridListTemplateOriginId(node, getDocNodes),
  );
  const slotComposition = resolveSlotComposition(origin?.children);
  const hasDescription =
    typeof sampleDescription === "string" &&
    sampleDescription.length > 0 &&
    isSlotEnabled(slotComposition, "description");
  // 2026-07-22 collection-item parity sweep: origin slot 자식(react-aria-Text) 은 label/description
  //   둘 다 기본 16(GridList slot line-height override 없음), line box = 1.5×fs(getTextLineHeight) —
  //   metric.fontSize(14) 아님. resolveListBoxRowHeight 가 slotFontOf 를 읽는 것과 동형. 명시 slot 우선.
  const slotFontOf = (role: "label" | "description"): number | undefined => {
    const fs = slotComposition?.slots[role]?.style?.fontSize;
    return typeof fs === "number" ? fs : undefined;
  };
  const labelFs = slotFontOf("label") ?? COLLECTION_TEXT_DEFAULT_FONT_SIZE;
  const descFs = slotFontOf("description") ?? COLLECTION_TEXT_DEFAULT_FONT_SIZE;
  // 선택 체크박스(2026-08-22) — 카드 스택 첫 블록. layout §1.55c 와 **같은 helper** 로 더한다;
  //   stride 만 빠지면 sample mode 소유자에서 `_projectedRowsContentHeight` 가 카드 합보다
  //   짧아져 마지막 행이 잘린다.
  const selectionExtra = resolveCardSelectionExtra({
    visible: resolveSelectionCheckboxVisible({
      selectionMode: props?.selectionMode,
      // ADR-923 r24m1 — style 축도 기본값 원천은 catalog binding. 아래 `fallback` 은
      //   binding 미선언 타입용 최후 폴백으로만 남는다.
      selectionStyle:
        props?.selectionStyle ?? resolveBindingSelectionStyle("GridList"),
      selectionBehavior: props?.selectionBehavior,
      // ADR-923 r23m1 — 기본값 원천은 catalog binding (layout §1.55c 와 같은 값).
      defaultSelectionMode: resolveBindingSelectionMode("GridList", "none"),
      // GridList.tsx 게이트와 동일 — single 은 DOM 에 체크박스가 없다.
      checkboxModes: ["multiple"],
      fallback: "toggle",
    }),
    selectionBoxSize: resolveGridListItemMetric(labelFs).selectionBoxSize,
    gap: metric.descGap,
  });
  const cardHeight =
    metric.cardPaddingY * 2 +
    selectionExtra +
    getTextLineHeight(labelFs) +
    (hasDescription ? getTextLineHeight(descFs) + metric.descGap : 0);
  return { rowHeight: cardHeight + metric.rowGap, columns: metric.numCols };
}

/**
 * columns 를 반영한 window 산출. 1열(ListBox/Table/GridList stack)은 resolveCollectionWindow
 * 를 그대로. GridList grid 모드(columns>1)는 **시각 행 공간**에서 window 를 구한 뒤 numCols 를
 * 곱해 item 절대 index 로 환산 — start/end 가 numCols 배수로 정렬돼 카드가 열 0에서 시작한다
 * (tail 은 totalRows 로 clamp). columns=1 이면 기존 동작과 동일.
 */
function resolveWindowWithColumns(input: {
  totalRows: number;
  scrollTop: number;
  viewportHeight: number;
  rowHeight: number;
  overscan?: number;
  columns: number;
}): CollectionWindow {
  const columns = Math.max(1, input.columns);
  if (columns === 1) {
    return resolveCollectionWindow(input);
  }
  const totalVisualRows = Math.ceil(input.totalRows / columns);
  const visual = resolveCollectionWindow({
    totalRows: totalVisualRows,
    scrollTop: input.scrollTop,
    viewportHeight: input.viewportHeight,
    rowHeight: input.rowHeight,
    overscan: input.overscan,
  });
  return {
    startIndex: visual.startIndex * columns,
    endIndex: Math.min(input.totalRows, visual.endIndex * columns),
  };
}

export interface ResolveVirtualizedWindowsInput {
  doc: CompositionDocument;
  collections: readonly CollectionDataSource[];
  /** owner id → 현재 수직 스크롤 위치(px). 없으면 0. */
  scrollTops: ReadonlyMap<string, number>;
  /** 균일 행 높이 override(테스트/커스텀). 기본 DEFAULT_LISTBOX_ROW_HEIGHT. */
  rowHeight?: number;
  /** viewport 상/하 여유 행 수. 기본은 resolveCollectionWindow 의 DEFAULT_COLLECTION_OVERSCAN. */
  overscan?: number;
  /** scene projection 과 같은 breakpoint 로 owner · 행 style 을 해석한다 (기본 desktop). */
  activeBreakpoint?: BreakpointName;
  /**
   * ADR-214 프로젝트 변수 — 행 템플릿의 `{{ }}` 를 scene 과 같은 기본값 env 로 먼저 푼다 (행 높이를
   * 가르는 description 유무가 여기에 달린다 — ADR-150 Phase 1 판독 M2).
   */
  projectVariables?: readonly VariableDef[];
}

/**
 * owner 기준 기본값 env — scene `stateEnvFor` 와 같은 shared 함수 (요소 사슬 + 프로젝트). page 보강은
 * 요소 사슬이 page 를 지나지 않는 경우 (layout slot) 만 다르다 — 여기서는 page id 를 넘기지 않는다.
 */
function ownerStateEnv(
  input: ResolveVirtualizedWindowsInput,
  ownerId: string,
): StateTemplateEnv {
  return createDefaultValueEnv(
    resolveVisibleVariablesForElement(
      input.doc,
      ownerId,
      null,
      input.projectVariables ?? [],
    ),
  );
}

/**
 * ADR-150 A2' — ListBox 의 **행별 높이 목록 + 행 묶음 gap + owner inset**. scene 투영과 같은
 * `resolveListBoxRowContext` / `resolveListBoxRowLayoutStyle` · `resolveCollectionRowDescription` 로 행마다 style · description 을
 * 얻고, layout §1.55b-2 와 같은 `resolveListBoxItemRowHeightFromStyle` 로 높이를 잰다 (description
 * 유무 · 선택 variant · 명시 height · 행 border 가 행마다 다를 수 있다 — round 3 h2).
 *
 * 단일 줄 가정: wrap (label · description 줄바꿈) 은 행 폭이 layout 뒤에 정해져 여기서 알 수 없다
 * (ADR-150 R1 — Phase 1 지원 범위 밖). 목록은 문서 · collections · breakpoint 가 바뀔 때만
 * 다시 만든다 — 스크롤은 캐시를 쓴다.
 */
interface ListBoxRowPlan {
  heights: number[];
  gap: number;
  leadingExtent: number;
  trailingExtent: number;
}

/**
 * 행 높이 목록의 입력 서명 — 편집마다 문서가 통째로 복제돼 (canonicalDocumentStore `cloneNode`) 노드
 * identity 로는 캐시가 안 맞는다. 복제는 얕아서 props 값 · dataBinding config 값 (행 데이터 배열) 은
 * 다른 요소를 편집해도 같은 참조다. owner props · dataBinding · config 의 값 참조와 collections,
 * 그리고 행 높이를 가르는 ctx 값 (`extra`) 이 같으면 같은 높이 목록이다 (ADR-150 Phase 1 판독 M1).
 */
function rowInputSignature(
  node: CanonicalNode,
  props: Record<string, unknown>,
  input: ResolveVirtualizedWindowsInput,
  extra: readonly unknown[],
): unknown[] {
  const binding = getElementDataBinding(node) as unknown as
    Record<string, unknown> | undefined;
  const out: unknown[] = [input.collections, ...extra];
  for (const source of [props, binding, binding?.config]) {
    if (!source || typeof source !== "object") {
      out.push(undefined);
      continue;
    }
    const record = source as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    out.push(keys.length);
    // ref instance view 는 style 을 깊은 병합해 (applyPropsPatch) 매번 새 객체라 내용으로 비교한다.
    for (const key of keys) {
      // binding.config 객체는 store 가 복제한다 — 그 값들은 다음 단계 (config) 에서 비교한다.
      if (source === binding && key === "config") continue;
      out.push(
        key,
        key === "style" ? JSON.stringify(record[key] ?? null) : record[key],
      );
    }
  }
  return out;
}

function sameSignature(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}

/** owner id → 마지막 행 높이 목록과 그 입력 서명 (문서가 바뀌어도 서명이 같으면 재사용). */
const rowHeightsBySignature = new Map<
  string,
  { signature: unknown[]; heights: number[] }
>();

/**
 * 문서에서 사라진 owner 의 항목을 지운다 — 서명이 collections · 행 데이터 배열을 잡고 있어 남기면
 * 삭제된 목록의 데이터가 세션 끝까지 보유된다 (ADR-150 Phase 1 수리 검증 M-a). window resolver 한
 * 번이 문서 전체를 돌므로 그 끝에서 부른다 (oracle `resolveCollectionRowPositions` 는 지우지 않는다).
 */
function pruneRowHeightCache(liveOwnerIds: ReadonlySet<string>): void {
  for (const ownerId of rowHeightsBySignature.keys()) {
    if (!liveOwnerIds.has(ownerId)) rowHeightsBySignature.delete(ownerId);
  }
}

/** 테스트 전용 — 서명 캐시 항목 수. */
export function __rowHeightCacheSizeForTest(): number {
  return rowHeightsBySignature.size;
}

function reuseRowHeights(
  ownerId: string,
  signature: unknown[],
  build: () => number[],
): number[] {
  const prev = rowHeightsBySignature.get(ownerId);
  if (prev && sameSignature(prev.signature, signature)) return prev.heights;
  const heights = build();
  rowHeightsBySignature.set(ownerId, { signature, heights });
  return heights;
}

const listBoxRowPlanCache = new WeakMap<
  CanonicalNode,
  {
    doc: CompositionDocument;
    collections: readonly CollectionDataSource[];
    projectVariables: ResolveVirtualizedWindowsInput["projectVariables"];
    breakpoint: BreakpointName;
    plan: ListBoxRowPlan;
  }
>();

/** 행 하나의 border-box 높이 — layout (§1 명시 height · §1.55b-2 + enrich 행 border) 과 같은 규칙. */
function measureListBoxRow(
  ctx: ListBoxRowContext,
  rowLayoutStyle: Record<string, unknown>,
  rowDescription: string,
): number {
  const explicit = parsePxValue(rowLayoutStyle.height, Number.NaN);
  if (Number.isFinite(explicit)) return explicit;
  const hasDescription =
    rowDescription.length > 0 &&
    isSlotEnabled(ctx.slotComposition, "description");
  const slotFontOf = (role: "label" | "description"): number | undefined => {
    const fs = ctx.slotComposition?.slots[role]?.style?.fontSize;
    return typeof fs === "number" ? fs : undefined;
  };
  const [borderTop, , borderBottom] =
    resolveBorderGeometry(rowLayoutStyle).widths;
  const border = borderTop + borderBottom;
  return (
    resolveListBoxItemRowHeightFromStyle(rowLayoutStyle, hasDescription, {
      label: slotFontOf("label"),
      description: slotFontOf("description"),
    }) + border
  );
}

/** ListBox 전 행 높이 — 행 높이는 (선택 여부, description 유무) 로만 갈려 조합마다 한 번 잰다 (scene 과 같은 함수). */
function measureListBoxRows(
  ctx: ListBoxRowContext,
  props: Record<string, unknown>,
  node: CanonicalNode,
  input: ResolveVirtualizedWindowsInput,
  totalRows: number,
): number[] {
  const rows = getListBoxProjectionRows(
    {
      collections: input.collections,
      dataBinding: getElementDataBinding(node),
      props,
    },
    { startIndex: 0, endIndex: totalRows },
  );
  const heightByKey = new Map<number, number>();
  return rows.map((row) => {
    const isRowSelected = isListBoxRowSelected(
      props,
      row.itemKey,
      row.rowIndex,
    );
    const hasDescription = resolveCollectionRowDescription(ctx, row).length > 0;
    const key = (isRowSelected ? 2 : 0) + (hasDescription ? 1 : 0);
    let height = heightByKey.get(key);
    if (height == null) {
      height = measureListBoxRow(
        ctx,
        resolveListBoxRowLayoutStyle(ctx, isRowSelected),
        hasDescription ? "x" : "",
      );
      heightByKey.set(key, height);
    }
    return height;
  });
}

function resolveListBoxRowPlan(
  node: CanonicalNode,
  totalRows: number,
  input: ResolveVirtualizedWindowsInput,
  getDocNodes: () => Map<string, CanonicalNode>,
): ListBoxRowPlan {
  const breakpoint = input.activeBreakpoint ?? "desktop";
  const cached = listBoxRowPlanCache.get(node);
  if (
    cached &&
    cached.doc === input.doc &&
    cached.collections === input.collections &&
    cached.projectVariables === input.projectVariables &&
    cached.breakpoint === breakpoint &&
    cached.plan.heights.length === totalRows
  ) {
    return cached.plan;
  }
  const props = (node.props ?? {}) as Record<string, unknown>;
  const ctx = resolveListBoxRowContext({
    ownerProps: props,
    ownerResponsive: node.responsive,
    sourceNode: node,
    templateAnchor: getListBoxTemplateAnchor(node.children),
    getDocumentNodesById: getDocNodes,
    activeBreakpoint: breakpoint,
    stateEnv: ownerStateEnv(input, node.id),
  });
  // 행 높이를 가르는 ctx 값 — style 은 호출마다 새 객체라 내용으로, 템플릿은 텍스트별 캐시라 참조로 비교한다.
  const ctxKey = JSON.stringify([
    ctx.templateAnchorStyle,
    ctx.selectedOriginStyle,
    ctx.slotComposition,
  ]);
  const heights = reuseRowHeights(
    node.id,
    rowInputSignature(node, props, input, [
      "listbox",
      totalRows,
      ctxKey,
      ctx.descriptionTemplate,
    ]),
    () => measureListBoxRows(ctx, props, node, input, totalRows),
  );
  // owner box — layout 이 쓰는 ListBox spacing metric (catalog padding 4 · border 1 기본).
  const ownerStyle = resolveResponsiveStyleMap(
    (props.style as Record<string, unknown> | undefined) ?? {},
    node.responsive,
    breakpoint,
  );
  const ownerMetric = resolveListBoxSpacingMetric({ style: ownerStyle });
  const plan: ListBoxRowPlan = {
    heights,
    gap: ctx.rowGapPx,
    leadingExtent: ownerMetric.borderWidth + ownerMetric.paddingTop,
    trailingExtent: ownerMetric.paddingBottom + ownerMetric.borderWidth,
  };
  listBoxRowPlanCache.set(node, {
    doc: input.doc,
    collections: input.collections,
    projectVariables: input.projectVariables,
    breakpoint,
    plan,
  });
  return plan;
}

/**
 * ADR-150 A2' — GridList (접힌 카드 = slot-only) 의 **시각 행별 높이 목록 + 행 묶음 gap + owner
 * inset**. scene 투영과 같은 `resolveGridListCardContext` / `resolveCollectionRowDescription` 로 카드마다
 * description · 선택 체크박스를 얻고, 카드 높이 = layout §1.55b2 content (label · description ·
 * 선택 블록, 단일 줄) + 카드 padding · border (카드 origin style, 없으면 catalog metric) 로 잰다.
 * 시각 행 높이 = 그 행 카드들 중 최대 (DOM grid stretch 와 같다). gap 은 scene 행 묶음 rowGap 과
 * 같은 값 (`ctx.gap` — owner `style.rowGap ?? style.gap`, DOM 과 같은 축) 이다.
 *
 * 펼친 카드 (ADR-162 — origin 에 역할 없는 자식) 는 높이가 자식 크기에 달려 공식으로 알 수 없다 —
 * ADR-162 Phase 4 `expandedCardHeights` 가 window 카드의 layout 실측 (없으면 첫 실측 · 공식 추정) 을
 * 공급하고, 그 version 이 plan 캐시 조건이다. slot-only 카드의 wrap 은 ListBox 와 같이 범위 밖 (R1).
 */
const gridListRowPlanCache = new WeakMap<
  CanonicalNode,
  {
    breakpoint: BreakpointName;
    doc: CompositionDocument;
    collections: readonly CollectionDataSource[];
    projectVariables: ResolveVirtualizedWindowsInput["projectVariables"];
    measuredVersion: number;
    plan: ListBoxRowPlan & { columns: number; expanded: boolean };
  }
>();

function resolveGridListRowPlan(
  node: CanonicalNode,
  totalRows: number,
  input: ResolveVirtualizedWindowsInput,
  getDocNodes: () => Map<string, CanonicalNode>,
): ListBoxRowPlan & { columns: number; expanded: boolean } {
  const breakpoint = input.activeBreakpoint ?? "desktop";
  const cached = gridListRowPlanCache.get(node);
  if (
    cached &&
    cached.breakpoint === breakpoint &&
    cached.doc === input.doc &&
    cached.collections === input.collections &&
    cached.projectVariables === input.projectVariables &&
    cached.measuredVersion === expandedCardHeightsVersionOf(node.id) &&
    cached.plan.heights.length === Math.ceil(totalRows / cached.plan.columns)
  ) {
    return cached.plan;
  }
  const props = (node.props ?? {}) as Record<string, unknown>;
  const ctx = resolveGridListCardContext({
    ownerProps: props,
    sourceNode: node,
    getDocumentNodesById: getDocNodes,
    stateEnv: ownerStateEnv(input, node.id),
  });
  // owner 여백은 layout 과 같이 responsive override 반영 (ListBox plan 과 같은 해석).
  const ownerMetric = resolveGridListSpacingMetric({
    style: resolveResponsiveStyleMap(
      (props.style as Record<string, unknown> | undefined) ?? {},
      node.responsive,
      breakpoint,
    ),
    layout: ctx.layout === "grid" ? "grid" : "stack",
    columns: ctx.numCols,
  });
  const slotFontOf = (role: "label" | "description"): number | undefined => {
    const fs = ctx.slotComposition?.slots[role]?.style?.fontSize;
    return typeof fs === "number" ? fs : undefined;
  };
  const labelFs = slotFontOf("label") ?? COLLECTION_TEXT_DEFAULT_FONT_SIZE;
  const descFs = slotFontOf("description") ?? COLLECTION_TEXT_DEFAULT_FONT_SIZE;
  const itemMetric = resolveGridListItemMetric(labelFs);
  const selectionExtra = resolveCardSelectionExtra({
    visible: ctx.showSelectionCheckbox,
    selectionBoxSize: itemMetric.selectionBoxSize,
    gap: itemMetric.descGap,
  });
  // 카드 box — origin style 이 주면 그 값, 아니면 catalog metric (엔진 implicit 과 같은 값).
  const originStyle = ctx.originStyle;
  const hasOriginPadding =
    originStyle.padding != null ||
    originStyle.paddingTop != null ||
    originStyle.paddingBottom != null;
  const cardPadding = hasOriginPadding
    ? parsePadding4Way(originStyle)
    : { top: ownerMetric.cardPaddingY, bottom: ownerMetric.cardPaddingY };
  const cardWidths = resolveBorderGeometry(originStyle, {
    borderWidth: ownerMetric.cardBorderWidth,
  }).widths;
  const cardBorder = cardWidths[0] + cardWidths[2];
  const descriptionSlotEnabled = isSlotEnabled(
    ctx.slotComposition,
    "description",
  );
  const cardBase =
    cardPadding.top +
    cardPadding.bottom +
    cardBorder +
    selectionExtra +
    getTextLineHeight(labelFs);
  const descriptionExtra = itemMetric.descGap + getTextLineHeight(descFs);
  const cardHeights = reuseRowHeights(
    node.id,
    rowInputSignature(node, props, input, [
      "gridlist",
      totalRows,
      cardBase,
      descriptionExtra,
      descriptionSlotEnabled,
      ctx.descriptionTemplate,
    ]),
    () =>
      getListBoxProjectionRows(
        {
          collections: input.collections,
          dataBinding: getElementDataBinding(node),
          props,
        },
        { startIndex: 0, endIndex: totalRows },
      ).map((row) =>
        descriptionSlotEnabled &&
        resolveCollectionRowDescription(ctx, row).length > 0
          ? cardBase + descriptionExtra
          : cardBase,
      ),
  );
  const columns = Math.max(1, ctx.numCols);
  const leadingExtent = ownerMetric.borderWidth + ownerMetric.paddingTop;
  const trailingExtent = ownerMetric.paddingBottom + ownerMetric.borderWidth;
  // ADR-162 Phase 4 — 펼친 카드: 카드마다 실측 ?? 추정 (공식 목록은 첫 실측 전 추정으로만 쓴다).
  const expanded = ctx.expandRowsFromOrigin && ctx.templateOriginNode != null;
  let effectiveCardHeights: readonly number[] = cardHeights;
  if (expanded) {
    const rows = getListBoxProjectionRows(
      {
        collections: input.collections,
        dataBinding: getElementDataBinding(node),
        props,
      },
      { startIndex: 0, endIndex: totalRows },
    );
    effectiveCardHeights = resolveExpandedCardHeights({
      ownerId: node.id,
      templateSig: JSON.stringify([
        ctx.templateOriginNode!.id,
        ctx.templateOriginNode!.props ?? null,
        ctx.templateOriginNode!.children ?? null,
        breakpoint,
      ]),
      itemKeys: rows.map((row) => row.itemKey),
      items: rows.map((row) => row.item),
      formulaCardHeights: cardHeights,
      columns,
      gap: ctx.gap,
      leadingExtent,
      trailingExtent,
      viewportHeight: 0,
    });
  }
  const heights = toVisualRowHeights(effectiveCardHeights, columns);
  const plan = {
    heights,
    gap: ctx.gap,
    columns,
    expanded,
    leadingExtent,
    trailingExtent,
  };
  gridListRowPlanCache.set(node, {
    breakpoint,
    doc: input.doc,
    collections: input.collections,
    projectVariables: input.projectVariables,
    measuredVersion: expandedCardHeightsVersionOf(node.id),
    plan,
  });
  return plan;
}

/** offsets → resolution 의 A2' 필드 (window 는 시각 행 = item index, ListBox 1 열). */
function applyListBoxOffsets(
  offsets: CollectionRowOffsets,
  plan: ListBoxRowPlan,
  totalRows?: number,
  columns = 1,
): Pick<
  CollectionWindowResolution,
  | "window"
  | "rowHeight"
  | "leadSpacerHeight"
  | "trailSpacerHeight"
  | "rowsExtent"
  | "maxScrollTop"
  | "contentHeight"
> {
  return {
    // 시각 행 → item index (GridList grid 는 열 수 배수 — 카드가 열 0 에서 시작).
    window: {
      startIndex: offsets.startVisual * columns,
      endIndex:
        totalRows != null
          ? Math.min(totalRows, offsets.endVisual * columns)
          : offsets.endVisual * columns,
    },
    // legacy 소비자 (spacer 행 수 > 0 판정) 용 — 위치 계산에는 쓰지 않는다.
    rowHeight: plan.heights[0] ?? DEFAULT_LISTBOX_ROW_HEIGHT,
    leadSpacerHeight: offsets.leadSpacer,
    trailSpacerHeight: offsets.trailSpacer,
    rowsExtent: offsets.rowsExtent,
    maxScrollTop: offsets.maxScrollTop,
    contentHeight:
      plan.leadingExtent + offsets.rowsExtent + plan.trailingExtent,
  };
}

/**
 * ListBox owner 의 정확한 균일 행 높이 — template row style(origin ◁ anchor override) +
 * description 유무를 layout 과 **동일 resolver**(`resolveListBoxItemRowHeightFromStyle`)로 산출.
 * spacer 높이 + 총 content height(스크롤바)가 실제 렌더 행 높이와 정합(2026-07-19 A 선택 —
 * live 검증에서 균일-28 nominal 이 description 행에서 어긋남을 확인). description 있는 행은 taller.
 */
function resolveListBoxRowHeight(
  node: CanonicalNode,
  sampleDescription: string | null | undefined,
  getDocNodes: () => Map<string, CanonicalNode>,
): number {
  const anchor = getListBoxTemplateAnchor(node.children);
  const originId = resolveListBoxTemplateOriginId(node, anchor, getDocNodes);
  const origin = originId
    ? resolveTemplateOriginNode(originId, getDocNodes())
    : undefined;
  // appendListBoxRowProjection 의 templateAnchorStyle 과 동일 병합(origin ◁ anchor).
  const rowStyle: Record<string, unknown> = {
    ...((origin?.props?.style as Record<string, unknown> | undefined) ?? {}),
    ...((anchor?.props?.style as Record<string, unknown> | undefined) ?? {}),
  };
  const slotComposition = resolveSlotComposition(
    anchor?.children?.length ? anchor.children : origin?.children,
  );
  const hasDescription =
    typeof sampleDescription === "string" &&
    sampleDescription.length > 0 &&
    isSlotEnabled(slotComposition, "description");
  // label/description size 는 slot 자식 props.size → `_slots` fold(px number)로 authoring.
  //   ListBoxItem 자체 style.fontSize 가 아니라 slot fontSize 를 행 높이에 반영해야 origin
  //   label size(3xl 등) 변경이 instance 행 높이로 전파된다(2026-07-21 사용자 보고).
  const slotFontOf = (role: "label" | "description"): number | undefined => {
    const fs = slotComposition?.slots[role]?.style?.fontSize;
    return typeof fs === "number" ? fs : undefined;
  };
  return resolveListBoxItemRowHeightFromStyle(rowStyle, hasDescription, {
    label: slotFontOf("label"),
    description: slotFontOf("description"),
  });
}

/**
 * ADR-150 A2' — owner 하나의 **전체 행 위치** (시각 행 top · 높이 · 앞 여백 · 행 영역 · 스크롤 범위).
 * window map 과 같은 plan 으로 만든다. G1 oracle 대조 (실 브라우저 DOM · live Canvas layout) 가
 * "window 가 아니라 전 행이 제자리에 있는가" 를 재는 데 쓴다 — 가상화 경로 자체는 이 함수를 부르지 않는다.
 */
export function resolveCollectionRowPositions(
  input: ResolveVirtualizedWindowsInput & { ownerId: string },
): {
  family: "listbox" | "gridlist" | "table";
  columns: number;
  tops: number[];
  heights: number[];
  leadingExtent: number;
  rowsExtent: number;
  maxScrollTop: number;
} | null {
  const nodes = flattenCanonicalDocumentNodes(input.doc);
  const docNodesById = new Map<string, CanonicalNode>(
    nodes.map((n) => [n.id, n]),
  );
  const getDocNodes = () => docNodesById;
  const docNode = docNodesById.get(input.ownerId);
  if (!docNode) return null;
  const family = resolveCollectionOwnerKind(docNode);
  if (!family) return null;
  const node = resolveOwnerPropsView(docNode, input.doc, docNodesById);
  const props = node.props as Record<string, unknown> | undefined;
  const style = (props?.style as Record<string, unknown> | undefined) ?? {};
  const viewportHeight = readBoundedHeightPx(style) ?? 0;
  const dataBinding = getElementDataBinding(node);
  let plan: ListBoxRowPlan & { columns: number };
  if (family === "table") {
    const { totalDataRows } = getTableProjectionRows(
      { collections: input.collections, dataBinding, props },
      { startIndex: 0, endIndex: 1 },
    );
    const tablePlan = resolveTableRowPlan(
      node,
      props,
      docNodesById,
      input.activeBreakpoint ?? "desktop",
    );
    plan = {
      ...tablePlan,
      heights: Array(totalDataRows).fill(tablePlan.rowHeight),
      columns: 1,
    };
  } else {
    const { totalRows } = resolveCollectionItems(
      { collections: input.collections, dataBinding, props },
      { startIndex: 0, endIndex: 1 },
    );
    plan =
      family === "gridlist"
        ? resolveGridListRowPlan(node, totalRows, input, getDocNodes)
        : {
            ...resolveListBoxRowPlan(node, totalRows, input, getDocNodes),
            columns: 1,
          };
  }
  const tops: number[] = [];
  let y = 0;
  for (const h of plan.heights) {
    tops.push(y);
    y += h + plan.gap;
  }
  const rowsExtent = plan.heights.length > 0 ? y - plan.gap : 0;
  return {
    family,
    columns: plan.columns,
    tops,
    heights: plan.heights,
    leadingExtent: plan.leadingExtent,
    rowsExtent,
    maxScrollTop: Math.max(
      0,
      plan.leadingExtent + rowsExtent + plan.trailingExtent - viewportHeight,
    ),
  };
}

/**
 * 가상화 대상 ListBox owner 의 window map 산출. `buildCanonicalSceneModel(collectionWindows)`
 * 로 주입. scroll 변화마다 재호출되지만 doc walk + O(1) count 라 저렴 —
 * rebuild 게이팅은 결과 window 의 [start,end) signature 로 상위에서 처리(BuilderCanvas).
 */
export function resolveVirtualizedCollectionWindows(
  input: ResolveVirtualizedWindowsInput,
): Map<string, CollectionWindowResolution> {
  const result = new Map<string, CollectionWindowResolution>();
  // origin(template) 노드 lookup — resolveListBoxTemplateOriginId 가 소비.
  const docNodesById = new Map<string, CanonicalNode>(
    flattenCanonicalDocumentNodes(input.doc).map((n) => [n.id, n]),
  );
  const getDocNodes = () => docNodesById;

  // 이번 문서에 있는 가상화 owner — 끝에서 나머지 (삭제된 owner) 의 행 높이 서명 캐시를 지운다.
  const liveOwnerIds = new Set<string>();
  // 이번에 펼친 카드 수확 구간을 받은 scroll owner — 나머지는 수확에서 뺀다.
  const expandedWindowOwnerIds = new Set<string>();
  const visit = (docNode: CanonicalNode): void => {
    const family = resolveCollectionOwnerKind(docNode);
    const node = family
      ? resolveOwnerPropsView(docNode, input.doc, docNodesById)
      : docNode;
    if (family) {
      liveOwnerIds.add(node.id);
      // collection 가상화는 raw props.style 만 읽는다(ADR-157 표시 정책 보존): catalog maxHeight
      //   fallback 을 여기서 병합하면 bare ListBox 가 auto-height sample/hatch 대신 bounded 300 으로
      //   바뀌어 ADR-157 정책을 변경한다. ListBox 의 bounded-scroll 기본값은 factory/hydration
      //   materialize(instance 실 props.style, ADR-listbox-scroll)가 담당 — 가상화 정책은 불변.
      const style =
        (node.props?.style as Record<string, unknown> | undefined) ?? {};
      const viewportHeight = readBoundedHeightPx(style);
      if (viewportHeight != null && isScrollOverflow(style)) {
        const dataBinding = getElementDataBinding(node);
        const props = node.props as Record<string, unknown> | undefined;
        const rawScrollTop = input.scrollTops.get(node.id) ?? 0;

        // family 별 총 행 수 + stride(시각 행 높이) + 열 수 + scrollTop 보정.
        let totalRows: number;
        let rowHeight: number;
        let columns: number;
        let scrollTop = rawScrollTop;

        if (family === "table") {
          // Table 소스는 props.rows / dataBinding(props.items 아님) → getTableProjectionRows 로
          //   data 행 수 획득. 행 높이는 size 균일(header·data 동일). window 는 data 행 index 공간.
          const { totalDataRows } = getTableProjectionRows(
            { collections: input.collections, dataBinding, props },
            { startIndex: 0, endIndex: 1 },
          );
          totalRows = totalDataRows;
          rowHeight = input.rowHeight ?? resolveTableRowHeight(props);
          columns = 1;
          // header 행(=1 row 높이)이 스크롤 content 최상단을 차지 → data 행 window 는 header 만큼
          //   내려간 위치. scrollTop 에서 header 높이를 빼 data 행 index 공간으로 정렬한다
          //   (header sticky 아님, overscan 이 잔여 오차 흡수). ADR-150 A2' 경로는 헤더를
          //   leadingExtent 로 다루므로 이 보정은 rowHeight override (테스트) 경로에만 남는다.
          scrollTop = Math.max(0, rawScrollTop - rowHeight);
        } else {
          // ListBox/GridList: props.items/dataBinding 1행 sample 로 totalRows + description 동시 획득.
          const sample = resolveCollectionItems(
            { collections: input.collections, dataBinding, props },
            { startIndex: 0, endIndex: 1 },
          );
          totalRows = sample.totalRows;
          if (input.rowHeight != null) {
            rowHeight = input.rowHeight;
            columns = 1;
          } else if (family === "gridlist") {
            const stride = resolveGridListRowStride(
              node,
              sample.rows[0]?.description,
              getDocNodes,
            );
            rowHeight = stride.rowHeight;
            columns = stride.columns;
          } else {
            rowHeight = resolveListBoxRowHeight(
              node,
              sample.rows[0]?.description,
              getDocNodes,
            );
            columns = 1;
          }
        }

        // ADR-150 A2' — Table: data 행 균일 · 헤더 = 행 영역 앞 여백 (요소 헤더면 Column 높이).
        if (family === "table" && totalRows > 0 && input.rowHeight == null) {
          const plan = resolveTableRowPlan(
            node,
            props,
            docNodesById,
            input.activeBreakpoint ?? "desktop",
          );
          const offsets = resolveCollectionRowOffsets({
            visualRowCount: totalRows,
            rowHeights: plan.rowHeight,
            gap: 0,
            leadingExtent: plan.leadingExtent,
            trailingExtent: plan.trailingExtent,
            viewportHeight,
            scrollTop: rawScrollTop,
            overscan: input.overscan ?? DEFAULT_COLLECTION_OVERSCAN,
          });
          result.set(node.id, {
            window: {
              startIndex: offsets.startVisual,
              endIndex: offsets.endVisual,
            },
            rowHeight: plan.rowHeight,
            leadSpacerHeight: offsets.leadSpacer,
            trailSpacerHeight: offsets.trailSpacer,
            rowsExtent: offsets.rowsExtent,
            maxScrollTop: offsets.maxScrollTop,
            contentHeight:
              plan.leadingExtent + offsets.rowsExtent + plan.trailingExtent,
            totalRows,
            columns: 1,
            viewportHeight,
          });
          node.children?.forEach(visit);
          return;
        }

        // ADR-150 A2' — ListBox · GridList 는 (시각) 행별 높이 목록 + gap + owner inset 으로 행 위치를
        //   한 함수가 정한다.
        if (
          (family === "listbox" || family === "gridlist") &&
          totalRows > 0 &&
          input.rowHeight == null
        ) {
          const plan =
            family === "gridlist"
              ? resolveGridListRowPlan(node, totalRows, input, getDocNodes)
              : {
                  ...resolveListBoxRowPlan(node, totalRows, input, getDocNodes),
                  columns: 1,
                };
          const offsets = resolveCollectionRowOffsets({
            visualRowCount: plan.heights.length,
            rowHeights: plan.heights,
            gap: plan.gap,
            leadingExtent: plan.leadingExtent,
            trailingExtent: plan.trailingExtent,
            viewportHeight,
            scrollTop: rawScrollTop,
            overscan: input.overscan ?? DEFAULT_COLLECTION_OVERSCAN,
          });
          const fields = applyListBoxOffsets(
            offsets,
            plan,
            totalRows,
            plan.columns,
          );
          result.set(node.id, {
            ...fields,
            totalRows,
            columns: plan.columns,
            viewportHeight,
          });
          // ADR-162 Phase 4 — 펼친 카드 수확 구간 (scroll 소유자만 — sample 모드는 스크롤 범위가 없다).
          if ("expanded" in plan && plan.expanded) {
            noteExpandedCardWindow(node.id, fields.window, viewportHeight);
            expandedWindowOwnerIds.add(node.id);
          }
          node.children?.forEach(visit);
          return;
        }

        if (totalRows > 0) {
          const window = resolveWindowWithColumns({
            totalRows,
            scrollTop,
            viewportHeight,
            rowHeight,
            overscan: input.overscan,
            columns,
          });
          // legacy 균일 식 — 호출자가 `input.rowHeight` 를 고정했을 때만 온다 (위 A2' 두 분기가
          //   production 경로). 투영 총 content height (visual row 수 × rowHeight, table 은 header
          //   1행 가산) 에서 viewport 를 빼 maxScrollTop 을 산출 → BuilderCanvas 가 updateMaxScroll 로 주입.
          const visualRows = Math.ceil(totalRows / Math.max(1, columns));
          const headerRows = family === "table" ? 1 : 0;
          const contentHeight = (visualRows + headerRows) * rowHeight;
          const maxScrollTop = Math.max(0, contentHeight - viewportHeight);
          result.set(node.id, {
            window,
            rowHeight,
            totalRows,
            columns,
            viewportHeight,
            contentHeight,
            maxScrollTop,
          });
        }
      } else if (viewportHeight == null) {
        // ADR-157 sample 정책 (Phase 2 ListBox 선행 → Phase 4 GridList/Table 확산):
        //   auto-height/unbounded(명시 height 없음) data-bound collection 소유자 — 앞부분 샘플
        //   N행만 투영하고 나머지는 계산된 높이의 hatch placeholder 로 표시한다. 명시 bounded
        //   height 소유자(scroll=A2 / non-scroll=고정 높이)는 컨테이너 높이가 이미 고정이라 제외
        //   — auto-height(컨테이너가 content 에 auto-size)만 sample 대상. 자식 직접 구성 소유자는
        //   totalRows 0 → 무영향. family 별 총 행 수/stride/열 수 산출은 scroll 분기와 동일 dispatch.
        const dataBinding = getElementDataBinding(node);
        const props = node.props as Record<string, unknown> | undefined;

        let totalRows: number;
        let rowHeight: number;
        let columns = 1;
        if (family === "table") {
          const { totalDataRows } = getTableProjectionRows(
            { collections: input.collections, dataBinding, props },
            { startIndex: 0, endIndex: 1 },
          );
          totalRows = totalDataRows;
          rowHeight = input.rowHeight ?? resolveTableRowHeight(props);
        } else {
          const sample = resolveCollectionItems(
            { collections: input.collections, dataBinding, props },
            { startIndex: 0, endIndex: 1 },
          );
          totalRows = sample.totalRows;
          if (input.rowHeight != null) {
            rowHeight = input.rowHeight;
          } else if (family === "gridlist") {
            const stride = resolveGridListRowStride(
              node,
              sample.rows[0]?.description,
              getDocNodes,
            );
            rowHeight = stride.rowHeight;
            columns = stride.columns;
          } else {
            rowHeight = resolveListBoxRowHeight(
              node,
              sample.rows[0]?.description,
              getDocNodes,
            );
          }
        }

        if (
          (family === "listbox" || family === "gridlist") &&
          totalRows > COLLECTION_ROW_PROJECTION_SAMPLE_LIMIT &&
          input.rowHeight == null
        ) {
          const plan =
            family === "gridlist"
              ? resolveGridListRowPlan(node, totalRows, input, getDocNodes)
              : {
                  ...resolveListBoxRowPlan(node, totalRows, input, getDocNodes),
                  columns: 1,
                };
          const sampleVisualRows = Math.ceil(
            COLLECTION_ROW_PROJECTION_SAMPLE_LIMIT / plan.columns,
          );
          const offsets = resolveCollectionRowOffsets({
            visualRowCount: plan.heights.length,
            rowHeights: plan.heights,
            gap: plan.gap,
            leadingExtent: plan.leadingExtent,
            trailingExtent: plan.trailingExtent,
            viewportHeight: 0,
            scrollTop: 0,
            overscan: 0,
            fixedWindow: { startVisual: 0, endVisual: sampleVisualRows },
          });
          const fields = applyListBoxOffsets(
            offsets,
            plan,
            totalRows,
            plan.columns,
          );
          // sample 모드는 스크롤 범위가 없다 (auto-height 소유자) — maxScrollTop 주입 제외.
          result.set(node.id, {
            window: fields.window,
            rowHeight: fields.rowHeight,
            leadSpacerHeight: fields.leadSpacerHeight,
            trailSpacerHeight: fields.trailSpacerHeight,
            rowsExtent: fields.rowsExtent,
            totalRows,
            columns: plan.columns,
            mode: "sample",
          });
        } else if (totalRows > COLLECTION_ROW_PROJECTION_SAMPLE_LIMIT) {
          result.set(node.id, {
            window: {
              startIndex: 0,
              endIndex: COLLECTION_ROW_PROJECTION_SAMPLE_LIMIT,
            },
            rowHeight,
            totalRows,
            columns,
            mode: "sample",
          });
        }
      }
    }
    node.children?.forEach(visit);
  };
  input.doc.children.forEach(visit);
  pruneRowHeightCache(liveOwnerIds);
  pruneExpandedCardOwners(liveOwnerIds, expandedWindowOwnerIds);
  return result;
}

/**
 * window map → rebuild 게이팅 signature. window [start,end) 가 바뀔 때만 문자열이 변한다
 * (overscan slack 안 스크롤은 불변 → scene rebuild 억제, HC#1: pointer/scroll hot path 무회귀).
 */
export function collectionWindowSignature(
  windows: ReadonlyMap<string, CollectionWindowResolution>,
): string {
  const parts: string[] = [];
  for (const [ownerId, resolution] of windows) {
    // spacer · 행 영역은 window 가 같으면 스크롤과 무관하다 — 넣어도 스크롤 중 rebuild 는 늘지 않고,
    //   window 는 그대로인데 행 높이 목록만 바뀐 경우 (ADR-162 Phase 4 실측 교체) spacer 를 다시 투영한다.
    parts.push(
      `${ownerId}:${resolution.window.startIndex}:${resolution.window.endIndex}:${resolution.leadSpacerHeight ?? ""}:${resolution.trailSpacerHeight ?? ""}:${resolution.rowsExtent ?? ""}`,
    );
  }
  // owner 삽입 순서는 doc walk 순서로 안정적 — 정렬 불필요.
  return parts.join("|");
}

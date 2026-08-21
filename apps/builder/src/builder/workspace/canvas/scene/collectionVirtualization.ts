/**
 * ADR-150 A2 (ListBox 선행 proof): 가상화 대상 collection owner 의 window 해석.
 *
 * canonical document 를 1회 walk 하여 **bounded height + overflow scroll/auto 인 data-bound
 * ListBox** 를 찾고, 각 owner 의 scrollOffset 기반 window(`resolveCollectionWindow`)를 산출한다.
 * 결과 map 은 `buildCanvasSceneGraph(options.collectionWindows)` 의 단일 소스로 주입되어
 * draw/hit tree 가 **동일 window** 를 공유한다(R2). 미포함 owner 는 legacy 정적 cap 투영(BC).
 *
 * **행 높이 측정 (ADR-150 A2 delivered `34c56ea70`)**: rowHeight 는 template row style(origin ◁
 * anchor override) + description 유무를 layout `calculateContentHeight` 와 **동일 심볼**
 * (`resolveListBoxItemRowHeightFromStyle`, `resolveListBoxRowHeight` 경유)로 산출한다 — spacer /
 * 총 content height(스크롤바)가 실제 렌더 행 높이와 정합. 잔존 한계는 template style/description
 * 밖의 **임의 자식 구성 콘텐츠 높이** 미반영 (ADR-157 R1 과 동일 후속 트랙에서 정밀화).
 *
 * **비-데이터 ListBox 무영향**: totalRows 0(자식 ListBoxItem 직접 구성)이면 map 에 미포함 →
 * projection 자체가 없어 window 도 무의미. scene 빌더가 data-bound 여부로 실제 투영을 gating 한다.
 */

import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import {
  resolveCollectionItems,
  resolveCollectionWindow,
  resolveSelectionCheckboxVisible,
  resolveSlotComposition,
  isSlotEnabled,
  getTableProjectionRows,
  COLLECTION_ROW_PROJECTION_SAMPLE_LIMIT,
  type CollectionDataSource,
  type CollectionWindow,
} from "@composition/shared";
import {
  resolveCardSelectionExtra,
  resolveGridListItemMetric,
  resolveGridListSpacingMetric,
  getTextLineHeight,
  COLLECTION_TEXT_DEFAULT_FONT_SIZE,
} from "@composition/specs";

import { getElementDataBinding } from "../../../../adapters/canonical/compositionExtensionFields";
import { GRIDLIST_ITEM_DEFAULT_ORIGIN_ID } from "../../../components/gridlist/gridListTemplateOrigins";
import { resolveListBoxItemRowHeightFromStyle } from "../layout/engines/utils";
import {
  getListBoxTemplateAnchor,
  resolveListBoxTemplateOriginId,
  type CollectionWindowResolution,
} from "./canvasSceneNode";
import { flattenCanonicalDocumentNodes } from "./canonicalSceneModel";

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
 * Table 행 높이(px) — catalog TableRow.sizes 정합(sm 36 / md 44 / lg 52). header·data 행 모두
 * 동일 size 이므로 균일. SSOT = `componentRulesTable.TableRow.sizes` (값 변경 시 동반 갱신 —
 * ListBox/GridList 가 metric resolver 를 쓰는 것과 달리 Table 은 전용 resolver 부재라 상수 미러).
 */
const TABLE_ROW_HEIGHT_BY_SIZE: Record<string, number> = {
  sm: 36,
  md: 44,
  lg: 52,
};

function resolveTableRowHeight(
  props: Record<string, unknown> | undefined,
): number {
  const size = props?.size;
  const key = size === "sm" || size === "lg" ? size : "md";
  return TABLE_ROW_HEIGHT_BY_SIZE[key];
}

/**
 * GridList 의 **시각 행 stride**(px) + 열 수(numCols). stride = 카드 높이 + rowGap 이며,
 * grid 모드는 한 시각 행에 numCols 카드가 배치된다(stack 은 numCols 1). 카드 높이는 layout
 * `calculateContentHeight` gridlist 분기(utils.ts §1.55c)와 **동일 공식**:
 * `cardPaddingY*2 + labelLine + (desc? descLine + descGap : 0)` (Layer D 대칭). description 유무는
 * origin(GRIDLIST_ITEM_DEFAULT_ORIGIN_ID) 의 slot 구성으로 gating — appendGridListRowProjection 동형.
 *
 * **근사(GridList 한정)**: 총 content height = totalVisualRows × stride 는 마지막 시각 행 뒤의
 * gap 을 1개 더 센다(실제 = 행수×카드 + (행수-1)×gap). 스크롤바가 gap 1개만큼 길다 — proof 허용
 * 오차(ListBox/Table 은 rowsGroup gap 0 이라 정확).
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
  const origin = getDocNodes().get(GRIDLIST_ITEM_DEFAULT_ORIGIN_ID);
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
      selectionStyle: props?.selectionStyle,
      selectionBehavior: props?.selectionBehavior,
      defaultSelectionMode: "none",
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
  const origin = originId ? getDocNodes().get(originId) : undefined;
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

  const visit = (node: CanonicalNode): void => {
    const family = resolveCollectionOwnerKind(node);
    if (family) {
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
        let totalRows = 0;
        let rowHeight = 0;
        let columns = 1;
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
          //   (header sticky 아님, overscan 이 잔여 오차 흡수).
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

        if (totalRows > 0) {
          const window = resolveWindowWithColumns({
            totalRows,
            scrollTop,
            viewportHeight,
            rowHeight,
            overscan: input.overscan,
            columns,
          });
          // ADR-150 A2 스크롤 입력 배선: data-bound collection 은 childrenMap element 자식이
          //   0개라 GAP 4(fullTreeLayout.ts maxScroll)가 스크롤 범위를 못 구한다. 투영 총 content
          //   height(visual row 수 × stride, table 은 header 1행 가산)에서 viewport 를 빼
          //   maxScrollTop 을 직접 산출 → BuilderCanvas 가 updateMaxScroll 로 주입.
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

        let totalRows = 0;
        let rowHeight = 0;
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

        if (totalRows > COLLECTION_ROW_PROJECTION_SAMPLE_LIMIT) {
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
    parts.push(
      `${ownerId}:${resolution.window.startIndex}:${resolution.window.endIndex}`,
    );
  }
  // owner 삽입 순서는 doc walk 순서로 안정적 — 정렬 불필요.
  return parts.join("|");
}

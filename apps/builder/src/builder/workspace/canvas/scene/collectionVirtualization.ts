/**
 * ADR-150 A2 (ListBox 선행 proof): 가상화 대상 collection owner 의 window 해석.
 *
 * canonical document 를 1회 walk 하여 **bounded height + overflow scroll/auto 인 data-bound
 * ListBox** 를 찾고, 각 owner 의 scrollOffset 기반 window(`resolveCollectionWindow`)를 산출한다.
 * 결과 map 은 `buildCanvasSceneGraph(options.collectionWindows)` 의 단일 소스로 주입되어
 * draw/hit tree 가 **동일 window** 를 공유한다(R2). 미포함 owner 는 legacy 정적 cap 투영(BC).
 *
 * **proof 단순화 (2026-07-19, 사용자 승인)**: rowHeight 는 catalog ListBoxItem 기본값(균일)을
 * 쓴다 — per-template height override(사용자 커스텀 행 높이)는 후속 정밀화. 총 content height =
 * totalRows × rowHeight 가 실제 렌더(기본 행)와 일치하는 범위에서 유효.
 *
 * **비-데이터 ListBox 무영향**: totalRows 0(자식 ListBoxItem 직접 구성)이면 map 에 미포함 →
 * projection 자체가 없어 window 도 무의미. scene 빌더가 data-bound 여부로 실제 투영을 gating 한다.
 */

import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import {
  resolveCollectionItems,
  resolveCollectionWindow,
  resolveSlotComposition,
  isSlotEnabled,
  type CollectionDataSource,
} from "@composition/shared";
import { resolveListBoxItemMetric } from "@composition/specs";

import { getElementDataBinding } from "../../../../adapters/canonical/compositionExtensionFields";
import { resolveListBoxItemRowHeightFromStyle } from "../layout/engines/utils";
import {
  getListBoxTemplateAnchor,
  resolveListBoxTemplateOriginId,
  type CollectionWindowResolution,
} from "./canvasSceneNode";
import { flattenCanonicalDocumentNodes } from "./canonicalSceneModel";

/** catalog ListBoxItem 기본 행 높이(fontSize 14: paddingY*2 + lineHeight = 28). */
export const DEFAULT_LISTBOX_ROW_HEIGHT =
  resolveListBoxItemMetric(14).itemHeight;

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
  return resolveListBoxItemRowHeightFromStyle(rowStyle, hasDescription);
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
    if (isListBoxOwnerNode(node)) {
      const style =
        (node.props?.style as Record<string, unknown> | undefined) ?? {};
      const viewportHeight = readBoundedHeightPx(style);
      if (viewportHeight != null && isScrollOverflow(style)) {
        const dataBinding = getElementDataBinding(node);
        // 1행 sample 로 totalRows + description 유무 동시 획득(window slice 회피).
        const sample = resolveCollectionItems(
          {
            collections: input.collections,
            dataBinding,
            props: node.props as Record<string, unknown> | undefined,
          },
          { startIndex: 0, endIndex: 1 },
        );
        const totalRows = sample.totalRows;
        if (totalRows > 0) {
          const rowHeight =
            input.rowHeight ??
            resolveListBoxRowHeight(
              node,
              sample.rows[0]?.description,
              getDocNodes,
            );
          const scrollTop = input.scrollTops.get(node.id) ?? 0;
          const window = resolveCollectionWindow({
            totalRows,
            scrollTop,
            viewportHeight,
            rowHeight,
            overscan: input.overscan,
          });
          result.set(node.id, { window, rowHeight, totalRows });
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

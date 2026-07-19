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
  type CollectionDataSource,
} from "@composition/shared";
import { resolveListBoxItemMetric } from "@composition/specs";

import { getElementDataBinding } from "../../../../adapters/canonical/compositionExtensionFields";
import type { CollectionWindowResolution } from "./canvasSceneNode";

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
 * 가상화 대상 ListBox owner 의 window map 산출. `buildCanonicalSceneModel(collectionWindows)`
 * 로 주입. scroll 변화마다 재호출되지만 doc walk + O(1) count 라 저렴 —
 * rebuild 게이팅은 결과 window 의 [start,end) signature 로 상위에서 처리(BuilderCanvas).
 */
export function resolveVirtualizedCollectionWindows(
  input: ResolveVirtualizedWindowsInput,
): Map<string, CollectionWindowResolution> {
  const result = new Map<string, CollectionWindowResolution>();
  const rowHeight = input.rowHeight ?? DEFAULT_LISTBOX_ROW_HEIGHT;

  const visit = (node: CanonicalNode): void => {
    if (node.type === "ListBox") {
      const style =
        (node.props?.style as Record<string, unknown> | undefined) ?? {};
      const viewportHeight = readBoundedHeightPx(style);
      if (viewportHeight != null && isScrollOverflow(style)) {
        const dataBinding = getElementDataBinding(node);
        // totalRows 만 필요 — 빈 window 로 slice 회피(원본 count 는 그대로 반환).
        const { totalRows } = resolveCollectionItems(
          {
            collections: input.collections,
            dataBinding,
            props: node.props as Record<string, unknown> | undefined,
          },
          { startIndex: 0, endIndex: 0 },
        );
        if (totalRows > 0) {
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

import { Element } from "../../../types/core/store.types";
import { supabase } from "../../../env/supabase.client";
import { getDB } from "../../../lib/db";
import {
  getFrameElementMirrorId,
  isPageFrameProjectionElement,
} from "../../../adapters/canonical/frameMirror";

/**
 * legacy order_num mirror 재번호화 업데이트 계산 (순수 함수 — side effect 없음)
 *
 * 페이지의 모든 요소를 부모별 source/projection order 로 그룹화하여 mirror
 * `order_num`을 계산합니다.
 * 변경이 필요한 요소들만 { id, order_num } 배열로 반환합니다.
 *
 * ADR-118: 이 함수는 더 이상 `order_num`을 structural ordering primary key 로
 * 사용하지 않습니다. 현재 `elements` source order 가 canonical `children[]`
 * projection order 이며, `order_num`은 DB/API compatibility mirror 로만
 * 재번호화합니다.
 * props.children/title/label 같은 편집 가능한 값은 구조 순서 복구에 사용하지 않습니다.
 */
export function computeReorderUpdates(
  elements: Element[],
  pageId: string,
): Array<{ id: string; order_num: number }> {
  // 페이지별, 부모별로 그룹화
  const groups = elements
    .filter((el) => {
      if (isPageFrameProjectionElement(el)) return false;
      if (el.page_id === pageId) return true;
      return el.page_id == null && getFrameElementMirrorId(el) === pageId;
    })
    .reduce(
      (acc, element) => {
        const key = element.parent_id || "root";
        if (!acc[key]) acc[key] = [];
        acc[key].push(element);
        return acc;
      },
      {} as Record<string, Element[]>,
    );

  const updates: Array<{ id: string; order_num: number }> = [];

  // 각 그룹별로 order_num 재정렬
  Object.values(groups).forEach((children) => {
    children.forEach((child, index) => {
      // order_num은 0부터 시작 (0-based indexing)
      const newOrderNum = index;
      if (child.order_num !== newOrderNum) {
        updates.push({ id: child.id, order_num: newOrderNum });
      }
    });
  });

  return updates;
}

/**
 * order_num 재정렬 실행 함수
 *
 * computeReorderUpdates()로 계산된 업데이트를 batch로 적용합니다.
 * - 메모리: batchUpdateElementOrders() 단일 set() 호출
 * - DB: Supabase 일괄 업데이트 (백그라운드)
 */
export const reorderElements = async (
  elements: Element[],
  pageId: string,
  batchUpdateElementOrders: (
    updates: Array<{ id: string; order_num: number }>,
  ) => void,
): Promise<void> => {
  const updates = computeReorderUpdates(elements, pageId);

  if (updates.length === 0) return;

  // 1. 메모리 일괄 업데이트 (단일 set())
  batchUpdateElementOrders(updates);

  // 2. IndexedDB 일괄 업데이트 (다음 세션 시 duplicate 재발 방지)
  try {
    const db = await getDB();
    await db.elements.updateMany(
      updates.map((u) => ({ id: u.id, data: { order_num: u.order_num } })),
    );
  } catch (error) {
    console.error("order_num 재정렬 IndexedDB 실패:", error);
  }

  // 3. Supabase 일괄 업데이트 (백그라운드)
  try {
    const updatePromises = updates.map((update) =>
      supabase
        .from("elements")
        .update({ order_num: update.order_num })
        .eq("id", update.id),
    );

    const results = await Promise.all(updatePromises);

    const errors = results.filter((result) => result.error);
    if (errors.length > 0) {
      console.error(
        "order_num 재정렬 DB 실패:",
        errors.map((e) => e.error),
      );
    }
  } catch (error) {
    console.error("order_num 재정렬 중 오류:", error);
  }
};

/**
 * Legacy duplicate order_num 일괄 마이그레이션 (A'').
 *
 * 모든 page_id를 스캔하여 duplicate/gap이 있는 페이지를 한 번에 정리.
 * reorderElements를 각 페이지별로 호출하므로 메모리/IDB/Supabase 3 sink 모두 동기화.
 *
 * 사용:
 *   window.__composition_MIGRATE__.fixAllDuplicateOrderNums()
 *
 * @returns 스캔 통계
 */
export const migrateDuplicateOrderNums = async (
  elements: Element[],
  batchUpdateElementOrders: (
    updates: Array<{ id: string; order_num: number }>,
  ) => void,
): Promise<{
  pagesScanned: number;
  pagesFixed: number;
  updatesApplied: number;
}> => {
  const pageIds = new Set<string>();
  for (const el of elements) {
    if (el.page_id) pageIds.add(el.page_id);
  }

  let pagesFixed = 0;
  let updatesApplied = 0;

  for (const pageId of pageIds) {
    const updates = computeReorderUpdates(elements, pageId);
    if (updates.length === 0) continue;
    pagesFixed += 1;
    updatesApplied += updates.length;
    await reorderElements(elements, pageId, batchUpdateElementOrders);
  }

  return {
    pagesScanned: pageIds.size,
    pagesFixed,
    updatesApplied,
  };
};

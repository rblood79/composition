import { useCallback, useRef } from "react";
import { Element } from "../../types/core/store.types";
import { reorderElements } from "../stores/utils/elementReorder";
import { useStore } from "../stores";
import { sortElementsByOrderThenSource } from "../utils/elementOrdering";
import {
  getFrameElementMirrorId,
  isPageFrameProjectionElement,
} from "../../adapters/canonical/frameMirror";

export interface UseValidationReturn {
  validateOrderNumbers: (elements: Element[]) => void;
}

export const useValidation = (): UseValidationReturn => {
  // 🚀 Phase 17.1: 페이지별 자동 수정 트래킹 (중복 수정 방지)
  const fixedPagesRef = useRef<Set<string>>(new Set());

  const validateOrderNumbers = useCallback((elements: Element[]) => {
    if (process.env.NODE_ENV !== "development") return;

    const persistentElements = elements.filter(
      (element) => !isPageFrameProjectionElement(element),
    );

    // 페이지별/레이아웃별, 부모별로 그룹화
    // ⭐ Layout/Slot System: legacy layout binding도 그룹핑 키에 포함
    const groups = persistentElements.reduce(
      (acc, element) => {
        const contextId =
          element.page_id || getFrameElementMirrorId(element) || "unknown";
        const key = `${contextId}_${element.parent_id || "root"}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(element);
        return acc;
      },
      {} as Record<string, Element[]>,
    );

    // 중복 발견된 페이지 ID 수집
    const pagesWithDuplicates = new Set<string>();

    Object.entries(groups).forEach(([, children]) => {
      // Tabs 하위 요소(Tab/Panel)인지 확인
      // Tabs 하위 요소는 tabId 기반 매칭이므로 order_num 중복이 정상일 수 있음
      const parentId = children[0]?.parent_id;
      const parentElement = parentId
        ? persistentElements.find((el) => el.id === parentId)
        : null;
      const isTabsChildren = parentElement?.type === "Tabs";

      // Tabs 하위 요소는 order_num 중복 검사 제외
      if (isTabsChildren) {
        return;
      }

      // order_num으로 정렬
      const sorted = sortElementsByOrderThenSource(children);

      // ✅ 중복이나 순서 역전만 확인 (0부터 시작할 필요는 없음)
      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];
        const currentOrder = current.order_num || 0;
        const nextOrder = next.order_num || 0;

        // 중복 order_num 확인
        if (currentOrder === nextOrder) {
          const pageId = current.page_id || getFrameElementMirrorId(current);
          if (pageId) {
            pagesWithDuplicates.add(pageId);
          }
          // 경고는 자동 수정되지 않은 경우에만 출력
          if (!pageId || !fixedPagesRef.current.has(pageId)) {
            console.warn(
              `⚠️ Duplicate order_num detected: ${current.type} (${current.id.slice(0, 8)}...) and ${next.type} (${next.id.slice(0, 8)}...) both have order_num=${currentOrder} → Auto-fixing...`,
            );
          }
        }

        // 순서 역전 확인 (정렬 후에는 발생하지 않지만, 데이터 무결성 확인)
        if (currentOrder > nextOrder) {
          console.warn(
            `❌ Order reversal detected: ${current.type} (${current.id.slice(0, 8)}..., order_num=${currentOrder}) > ${next.type} (${next.id.slice(0, 8)}..., order_num=${nextOrder})`,
          );
        }
      }
    });

    // 🚀 Phase 17.1: 중복 발견 시 자동 수정
    if (pagesWithDuplicates.size > 0) {
      pagesWithDuplicates.forEach((pageId) => {
        // 이미 수정한 페이지는 스킵
        if (fixedPagesRef.current.has(pageId)) return;

        // 수정 완료 표시 (재진입 방지)
        fixedPagesRef.current.add(pageId);

        // 비동기로 재정렬 실행 (상태 업데이트 완료 후)
        setTimeout(async () => {
          const { elements: latestElements, batchUpdateElementOrders } =
            useStore.getState();
          console.log(`🔧 Auto-fixing order_num for page: ${pageId}`);
          await reorderElements(
            latestElements,
            pageId,
            batchUpdateElementOrders,
          );
          console.log(`✅ order_num auto-fix completed for page: ${pageId}`);
        }, 0);
      });
    }
  }, []);

  return {
    validateOrderNumbers,
  };
};

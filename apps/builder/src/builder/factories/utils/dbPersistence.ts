import { Element } from "../../../types/core/store.types";
import { elementsApi } from "../../../adapters/canonical/legacyElementsApiService";
// ADR-916 Phase 3 G4 — mutation reverse wrapper (D18=A 정합)
import { createElementCanonicalPrimary } from "@/adapters/canonical/canonicalMutations";
import { HierarchyManager } from "../../utils/HierarchyManager";
import { updateElementId } from "./elementCreation";
import { supabase } from "../../../env/supabase.client";
import { getDB } from "../../../lib/db";

/**
 * 참조 무결성 검증: page_id/layout_id와 parent_id가 Supabase DB에 존재하는지 확인
 * ⭐ Supabase 저장 전용 검증 (IndexedDB는 별도 처리)
 * ⭐ Layout/Slot System: layoutId가 있으면 layout 검증, 없으면 page 검증
 */
async function validateReferences(
  pageId: string,
  parentId: string | null,
  layoutId?: string | null,
): Promise<boolean> {
  try {
    // ⭐ Layout/Slot System: Layout 모드 검증
    if (layoutId) {
      // Layout 존재 여부 확인
      const { data: layout, error: layoutError } = await supabase
        .from("layouts")
        .select("id")
        .eq("id", layoutId)
        .maybeSingle();

      if (layoutError) {
        console.warn(
          `[dbPersistence] Error checking layout ${layoutId}:`,
          layoutError,
        );
        return false;
      }

      if (!layout) {
        // Supabase에 레이아웃이 없으면 로컬 개발 환경으로 간주하고 스킵
        console.log(
          `[dbPersistence] ⏭️ Layout ${layoutId} not in Supabase - skipping cloud save (local-only mode)`,
        );
        return false;
      }
    } else if (pageId) {
      // 1. Page 존재 여부 확인 (Supabase DB만 확인)
      const { data: page, error: pageError } = await supabase
        .from("pages")
        .select("id")
        .eq("id", pageId)
        .maybeSingle();

      if (pageError) {
        console.warn(
          `[dbPersistence] Error checking page ${pageId}:`,
          pageError,
        );
        return false;
      }

      if (!page) {
        // Supabase에 페이지가 없으면 로컬 개발 환경으로 간주하고 스킵
        return false;
      }
    } else {
      // pageId와 layoutId 둘 다 없으면 저장 스킵
      console.warn(
        "[dbPersistence] Neither pageId nor layoutId provided - skipping save",
      );
      return false;
    }

    // 2. Parent 존재 여부 확인 (parentId가 있는 경우만)
    if (parentId) {
      const { data: parentElement, error: parentError } = await supabase
        .from("elements")
        .select("id")
        .eq("id", parentId)
        .maybeSingle();

      if (parentError) {
        console.warn(
          `[dbPersistence] Error checking parent element ${parentId}:`,
          parentError,
        );
        // 에러가 있어도 IndexedDB 확인 계속 진행
      }

      // Supabase DB에 없으면 IndexedDB 확인
      if (!parentElement) {
        try {
          const db = await getDB();
          const indexedDbParent = await db.elements.getById(parentId);
          if (indexedDbParent) {
            console.log(
              `[dbPersistence] Parent element ${parentId} found in IndexedDB (not in Supabase yet) - allowing save`,
            );
            // IndexedDB에 있으면 저장 허용
          } else {
            console.warn(
              `[dbPersistence] Parent element ${parentId} not found in DB or IndexedDB - skipping save`,
            );
            return false;
          }
        } catch (indexedDbError) {
          console.warn(
            `[dbPersistence] Error checking IndexedDB for parent element ${parentId}:`,
            indexedDbError,
          );
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.error("[dbPersistence] Reference validation failed:", error);
    return false;
  }
}

/**
 * 부모 및 자식 요소들을 Supabase DB에 저장
 * ⚠️ 로컬 전용 모드(IndexedDB만)에서는 자동으로 스킵됨
 * ⭐ Layout/Slot System: layoutId 지원
 */
export async function saveElementsToDb(
  parent: Element,
  children: Element[],
  parentId: string | null,
  pageId: string,
  layoutId?: string | null,
): Promise<void> {
  try {
    // ⭐ Supabase 참조 무결성 검증 (외래 키 위반 방지)
    const isValid = await validateReferences(pageId, parentId, layoutId);
    if (!isValid) {
      // 로컬 전용 모드: Supabase 저장 스킵 (IndexedDB에는 이미 저장됨)
      return;
    }

    // ⭐ Layout/Slot System: layout 모드에서는 빈 배열 사용 (pageId가 없음)
    const existingElements = layoutId
      ? [] // Layout 모드: order_num 계산용 요소 없음 (향후 필요시 layoutId로 조회)
      : await elementsApi.getElementsByPageId(pageId);

    // 부모 먼저 저장
    const parentToSave = {
      ...parent,
      parent_id: parentId,
      order_num: HierarchyManager.calculateNextOrderNum(
        parentId,
        existingElements,
      ),
    };

    const savedParent = await createElementCanonicalPrimary(parentToSave);

    // 스토어에서 부모 요소 ID 업데이트 (임시 ID → 실제 DB ID)
    updateElementId(parent.id, savedParent.id);

    // 자식들 순차 저장 (부모 ID 업데이트)
    for (let i = 0; i < children.length; i++) {
      const childToSave = {
        ...children[i],
        parent_id: savedParent.id,
      };
      const savedChild = await createElementCanonicalPrimary(childToSave);

      // 스토어에서 자식 요소 ID 업데이트
      updateElementId(children[i].id, savedChild.id);
    }

    console.log(
      `[dbPersistence] Successfully saved parent ${savedParent.id} and ${children.length} children${layoutId ? ` (Layout: ${layoutId})` : ""}`,
    );
  } catch (error) {
    console.error("Background save failed:", error);
  }
}

/**
 * 백그라운드에서 DB 저장 (setTimeout 사용)
 * ⭐ Layout/Slot System: layoutId 지원
 */
export function saveElementsInBackground(
  parent: Element,
  children: Element[],
  parentId: string | null,
  pageId: string,
  layoutId?: string | null,
): void {
  setTimeout(async () => {
    await saveElementsToDb(parent, children, parentId, pageId, layoutId);
  }, 0);
}

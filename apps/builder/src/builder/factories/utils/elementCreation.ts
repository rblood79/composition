import { Element } from "../../../types/core/store.types";
import { ElementUtils } from "../../../utils/element/elementUtils";
import { useStore } from "../../stores";
import { ComponentDefinition, ChildDefinition } from "../types";
import { generateCustomId } from "../../utils/idGeneration";
import { getDB } from "../../../lib/db";
import { sanitizeElement } from "../../../adapters/canonical/legacyElementSanitizer";
import { applyFactoryPropagation } from "../../utils/propagationEngine";
import { resolveOwnerPageId } from "../../../adapters/canonical/legacyMetadata";
// ADR-916 Phase 3 G4 — mutation reverse pilot caller (D18=A 정합)
import { mergeElementsCanonicalPrimary } from "@/adapters/canonical/canonicalMutations";
import { withFrameElementMirrorId } from "../../../adapters/canonical/frameMirror";

/**
 * 컴포넌트 정의로부터 실제 Element 데이터 생성 시 필요한 컨텍스트.
 *
 * page_id/layout binding 미주입 element 는 canonical mode 의 page-indexed 분기에서
 * 누락되어 화면 렌더 실패 (ADR-911). caller 가 ownership 정보를 명시 전달.
 */
export interface ElementCreationContext {
  pageId: string | null;
  layoutId: string | null | undefined;
}

/**
 * 컴포넌트 정의로부터 실제 Element 데이터 생성
 * 재귀적 중첩 children 지원 (TagGroup → TagList → Tag 등 3레벨 이상)
 */
export function createElementsFromDefinition(
  definition: ComponentDefinition,
  context?: ElementCreationContext,
): {
  parent: Element;
  children: Element[];
} {
  // 현재 페이지의 모든 요소 가져오기 (customId 생성용)
  const store = useStore.getState();
  const currentElements = store.elements;

  const pageId = context?.pageId ?? null;
  const layoutId = context?.layoutId ?? null;
  const resolvedPageId = resolveOwnerPageId(pageId, layoutId);

  // 부모 요소 생성
  const parent: Element = withFrameElementMirrorId(
    {
      ...definition.parent,
      id: ElementUtils.generateId(),
      customId: generateCustomId(definition.parent.type, currentElements),
      page_id: resolvedPageId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    layoutId,
  );

  // 자식 요소들 재귀 생성 (중첩 children 지원)
  const allElementsSoFar = [...currentElements, parent];
  const allChildren: Element[] = [];

  function processChildren(
    childDefs: ChildDefinition[],
    parentId: string,
  ): void {
    childDefs.forEach((childDef) => {
      const { children: nestedChildren, ...elementDef } = childDef;
      const child: Element = withFrameElementMirrorId(
        {
          ...elementDef,
          id: ElementUtils.generateId(),
          customId: generateCustomId(elementDef.type, allElementsSoFar),
          parent_id: parentId,
          page_id: resolvedPageId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        layoutId,
      );
      allChildren.push(child);
      allElementsSoFar.push(child);

      // 중첩 children 재귀 처리
      if (nestedChildren && nestedChildren.length > 0) {
        processChildren(nestedChildren, child.id);
      }
    });
  }

  processChildren(definition.children, parent.id);

  // ADR-048: 부모 props를 자식에 전파 (Factory 생성 시 초기값 보장)
  const propagatedChildren = applyFactoryPropagation(parent, allChildren);

  return { parent, children: propagatedChildren };
}

/**
 * 생성된 요소들을 스토어와 IndexedDB에 추가
 * ⭐ ComponentFactory에서 사용되며, IndexedDB 저장도 함께 처리
 */
export function addElementsToStore(
  parent: Element,
  children: Element[],
): Element[] {
  const store = useStore.getState();
  const currentElements = store.elements;
  const newElements = [...currentElements, parent, ...children];

  // 1. 메모리 스토어 업데이트 (UI 즉시 반영) — ADR-916 G4 wrapper 경유
  mergeElementsCanonicalPrimary([parent, ...children]);

  // 2. 히스토리 기록
  const { saveSnapshot } = store as unknown as {
    saveSnapshot: (elements: Element[], description: string) => void;
  };
  if (saveSnapshot) {
    saveSnapshot(newElements, "복합 컴포넌트 생성");
  }

  // 3. IndexedDB에 저장 (백그라운드, 에러 발생 시에도 UI는 정상 동작)
  const allElements = [parent, ...children];
  setTimeout(async () => {
    try {
      const db = await getDB();
      await db.elements.insertMany(
        allElements.map((el) => sanitizeElement(el)),
      );
    } catch (error) {
      console.warn("⚠️ [IndexedDB] 저장 중 오류 (메모리는 정상):", error);
    }
  }, 0);

  return newElements;
}

/**
 * 스토어에서 요소 ID 업데이트 (임시 ID → 실제 DB ID)
 */
export function updateElementId(oldId: string, newId: string): void {
  const store = useStore.getState();
  store.replaceElementId(oldId, newId);
}

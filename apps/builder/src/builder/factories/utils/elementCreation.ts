import { Element } from "../../../types/core/store.types";
import { ElementUtils } from "../../../utils/element/elementUtils";
import { useStore } from "../../stores";
import { ComponentDefinition, ChildDefinition } from "../types";
import { generateCustomId } from "../../utils/idGeneration";
import { applyFactoryPropagation } from "../../utils/propagationEngine";
import { resolveOwnerPageId } from "../../../adapters/canonical/legacyMetadata";
// ADR-116 Phase 3 G4 — mutation reverse pilot caller (D18=A 정합)
import { mergeElementsCanonicalPrimary } from "@/adapters/canonical/canonicalMutations";
// ADR-184 파일럿 — 4단 순서 (canonical → set → rebuild → history → persist)
// 는 러너가 소유. 종전 수동 순서 + 로컬 persist 헬퍼를 러너가 대체한다.
import { runCanonicalMutation } from "@/adapters/canonical/canonicalMutationRunner";
import { withFrameElementMirrorId } from "../../../adapters/canonical/frameMirror";

/**
 * 컴포넌트 정의로부터 실제 Element 데이터 생성 시 필요한 컨텍스트.
 *
 * page_id/layout binding 미주입 element 는 canonical mode 의 page-indexed 분기에서
 * 누락되어 화면 렌더 실패 (ADR-111). caller 가 ownership 정보를 명시 전달.
 */
export interface ElementCreationContext {
  pageId: string | null;
  layoutId: string | null | undefined;
}

function getCustomIdType(
  elementDef: Pick<Element, "type" | "componentName">,
): string {
  return elementDef.type === "ref" &&
    typeof elementDef.componentName === "string" &&
    elementDef.componentName.length > 0
    ? elementDef.componentName
    : elementDef.type;
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
      customId: generateCustomId(
        getCustomIdType(definition.parent),
        currentElements,
      ),
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
          customId: generateCustomId(
            getCustomIdType(elementDef),
            allElementsSoFar,
          ),
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

  // ADR-184 파일럿 — 종전 수동 4단 순서 (본 함수가 러너 순서의 기준형이었다)
  // 를 러너 경유로 전환. rebuild(③) 와 persist(⑤, 백그라운드 fire-and-forget)
  // 는 러너 소유라 스테이지로 넘기지 않는다.
  runCanonicalMutation({
    // ① canonical document 1차 갱신 — ADR-116 G4 wrapper 경유.
    //    mergeElementsCanonicalPrimary 는 "canonical store mutation only.
    //    Derived store cache updates are caller-owned" 계약 (canonicalMutations.ts).
    canonical: () => mergeElementsCanonicalPrimary([parent, ...children]),
    // ② derived store cache 갱신 — 단순 컴포넌트 경로 createAddElementAction 과 동일.
    //    이 단계를 누락하면 복합 컴포넌트(NumberField/Select 등)가 canonical 에는
    //    들어가 Skia 화면엔 보이지만 legacy elementsMap 에는 없어, Delete 핸들러의
    //    elementsMap.get(id) 가 undefined → "Only body elements selected" 로 삭제
    //    불가 (새로고침 후에야 hydrate 로 회복되던 버그).
    store: () => {
      useStore.setState((prev) => ({
        elements: [...prev.elements, parent, ...children],
        layoutVersion: prev.layoutVersion + 1,
      }));
    },
    // ④ 히스토리 기록
    history: () => {
      const { saveSnapshot } = store as unknown as {
        saveSnapshot: (elements: Element[], description: string) => void;
      };
      if (saveSnapshot) {
        saveSnapshot(newElements, "복합 컴포넌트 생성");
      }
    },
  });

  return newElements;
}

/**
 * 스토어에서 요소 ID 업데이트 (임시 ID → 실제 DB ID)
 */
export function updateElementId(oldId: string, newId: string): void {
  const store = useStore.getState();
  store.replaceElementId(oldId, newId);
}

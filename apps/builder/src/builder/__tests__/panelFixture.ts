/**
 * Builder 패널 테스트의 공통 fixture 시드 (Styles · Properties · property 컴포넌트).
 *
 * 패널 read hook 은 `useCanonicalPropertyElementsMap()` 을 거쳐 **canonical document** 를
 * 읽는다 (ADR-142 — 컴포넌트 SSOT = canonical). 그런데 다수의 기존 테스트는 legacy flat
 * `useStore.elements` 만 시드해서, hook 이 빈 canonical 을 읽고 catalog preset/하드코딩
 * fallback 을 돌려주는 상태로 굳어 있었다 (2026-09-05 시점 10개 파일 54건 실패).
 *
 * 이 헬퍼는 두 축을 **한 번에** 시드해 테스트가 production read 경로와 같은 것을 보게 한다.
 * 새 패널 hook 테스트는 `useStore.setState({ elements })` 를 직접 쓰지 말고 이것을 쓴다.
 */
import type { Element } from "../../types/core/store.types";
import { useStore } from "../stores";
import { useCanonicalDocumentStore } from "../stores/canonical/canonicalDocumentStore";
import {
  mergeElementsCanonicalPrimary,
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "@/adapters/canonical/canonicalMutations";

export const PANEL_FIXTURE_PROJECT_ID = "panel-fixture-test-project";

/** beforeEach 에서 호출 — 두 store 를 모두 빈 상태로 되돌린다. */
export function resetPanelFixture(): void {
  resetCanonicalMutationStoreActions();
  useCanonicalDocumentStore.setState({
    documents: new Map(),
    currentProjectId: null,
    documentVersion: 0,
  });
  useStore.setState({
    elements: [],
    elementsMap: new Map(),
  } as never);
}

/**
 * legacy flat store 와 canonical document 를 같은 요소 집합으로 시드한다.
 *
 * `parent_id` 로 표현된 부모-자식 관계는 canonical 변환이 `children[]` 으로 옮기므로,
 * 부모 체인을 보는 hook (accentColor 상속 · picker DateInput height override 등) 도
 * production 과 같은 트리를 읽는다.
 */
/** canonical 변환에 필요한 최소 필드만 채운 사본 — 원본은 건드리지 않는다. */
function withCanonicalDefaults(element: Element): Element {
  return {
    page_id: "page-1",
    order_num: 0,
    parent_id: null,
    ...element,
    props: element.props ?? {},
  } as Element;
}

export function seedPanelElements(elements: Element[]): void {
  // flat store 에는 **원본 객체 그대로** 넣는다 — 테스트가 mutation 결과를 identity 나
  // 필드 집합으로 단언하므로, 여기서 필드를 채우면 단언이 깨진다.
  useStore.setState({
    elements,
    elementsMap: new Map(elements.map((element) => [element.id, element])),
  } as never);

  const forCanonical = elements.map(withCanonicalDefaults);

  registerCanonicalMutationStoreActions({
    getCurrentProjectId: () => PANEL_FIXTURE_PROJECT_ID,
    // live 읽기여야 한다 — mutation 경로가 현재 store 상태를 다시 읽는다.
    getCurrentLegacySnapshot: () => ({
      elements: useStore.getState().elements.map(withCanonicalDefaults),
      pages: [],
      layouts: [],
    }),
  });
  useCanonicalDocumentStore
    .getState()
    .setCurrentProject(PANEL_FIXTURE_PROJECT_ID);
  mergeElementsCanonicalPrimary(forCanonical);
}

import { beforeEach, describe, expect, it } from "vitest";

import { resetCanonicalMutationStoreActions } from "../../../adapters/canonical/canonicalMutations";
import type { Element } from "../../../types/core/store.types";
import { useStore } from "../index";

function makeElement(
  id: string,
  pageId: string,
  overrides: Partial<Element> = {},
): Element {
  return {
    id,
    type: "div",
    page_id: pageId,
    parent_id: null,
    order_num: 0,
    props: {},
    deleted: false,
    ...overrides,
  } as Element;
}

function resetStoreState(): void {
  resetCanonicalMutationStoreActions();
  useStore.getState().setElements([]);
  useStore.setState({
    pages: [],
    currentPageId: null,
    selectedElementId: null,
    selectedElementIds: [],
    selectedElementIdsSet: new Set<string>(),
    selectedElementProps: {},
    editingContextId: null,
    selectedTab: null,
    multiSelectMode: false,
  });
}

describe("moveElementToContainer", () => {
  beforeEach(resetStoreState);

  it("cross-page reparent는 root와 subtree page_id를 target container 기준으로 갱신한다", () => {
    const page1Body = makeElement("page-1-body", "page-1", {
      type: "body",
    });
    const page2Body = makeElement("page-2-body", "page-2", {
      type: "body",
    });
    const sourceCard = makeElement("card-1", "page-1", {
      type: "Card",
      parent_id: page1Body.id,
      order_num: 0,
    });
    const sourceHeading = makeElement("heading-1", "page-1", {
      type: "Heading",
      parent_id: sourceCard.id,
      order_num: 0,
    });
    const targetButton = makeElement("button-2", "page-2", {
      type: "Button",
      parent_id: page2Body.id,
      order_num: 0,
    });

    useStore
      .getState()
      .setElements([
        page1Body,
        sourceCard,
        sourceHeading,
        page2Body,
        targetButton,
      ]);

    useStore.getState().moveElementToContainer(sourceCard.id, page2Body.id, 1);

    const state = useStore.getState();
    const movedCard = state.elementsMap.get(sourceCard.id);
    const movedHeading = state.elementsMap.get(sourceHeading.id);
    const retainedTargetButton = state.elementsMap.get(targetButton.id);

    expect(movedCard).toMatchObject({
      id: sourceCard.id,
      page_id: "page-2",
      parent_id: page2Body.id,
      order_num: 1,
    });
    expect(movedHeading).toMatchObject({
      id: sourceHeading.id,
      page_id: "page-2",
      parent_id: sourceCard.id,
      order_num: 0,
    });
    expect(retainedTargetButton).toMatchObject({
      id: targetButton.id,
      page_id: "page-2",
      parent_id: page2Body.id,
      order_num: 0,
    });

    expect(
      (state.childrenMap.get(page1Body.id) ?? []).map((el) => el.id),
    ).toEqual([]);
    expect(
      new Set((state.childrenMap.get(page2Body.id) ?? []).map((el) => el.id)),
    ).toEqual(new Set([targetButton.id, sourceCard.id]));

    const page1Ids = new Set(
      state.pageElementsSnapshot["page-1"]?.map((element) => element.id) ?? [],
    );
    const page2Ids = new Set(
      state.pageElementsSnapshot["page-2"]?.map((element) => element.id) ?? [],
    );
    expect(page1Ids.has(sourceCard.id)).toBe(false);
    expect(page1Ids.has(sourceHeading.id)).toBe(false);
    expect(page2Ids.has(sourceCard.id)).toBe(true);
    expect(page2Ids.has(sourceHeading.id)).toBe(true);
  });
});

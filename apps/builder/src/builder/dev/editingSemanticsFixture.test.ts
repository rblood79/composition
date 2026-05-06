// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { Element } from "../../types/core/store.types";
import type { ElementsState } from "../stores/elements";
import { applyEditingSemanticsFixture } from "./editingSemanticsFixture";

function makeStoreStub() {
  return {
    selectElementWithPageTransition: vi.fn(),
    setCurrentPageId: vi.fn(),
    setElements: vi.fn(),
    setPages: vi.fn(),
  } as unknown as Pick<
    ElementsState,
    | "selectElementWithPageTransition"
    | "setCurrentPageId"
    | "setElements"
    | "setPages"
  >;
}

describe("editingSemanticsFixture", () => {
  it("selects a reusable frame with slot recommendations for G4-F screenshot evidence", () => {
    window.history.pushState(
      {},
      "",
      "/builder/adr-112-fixture?editingSemanticsFixture=slot",
    );

    const store = makeStoreStub();
    applyEditingSemanticsFixture(store as ElementsState);

    const elements = vi.mocked(store.setElements).mock.calls[0][0] as Array<
      Element & { slot?: false | string[] }
    >;
    const slotFrame = elements.find(
      (element) => element.id === "adr-112-slot-frame",
    );
    const recommendation = elements.find(
      (element) => element.id === "adr-112-slot-recommendation",
    );

    expect(slotFrame).toMatchObject({
      componentName: "ArticleFrame",
      reusable: true,
      slot: ["adr-112-slot-recommendation"],
      type: "frame",
    });
    expect(recommendation).toMatchObject({
      componentName: "RecommendedNumberField",
      reusable: true,
      type: "NumberField",
    });
    expect(store.selectElementWithPageTransition).toHaveBeenCalledWith(
      "adr-112-slot-frame",
      "adr-112-editing-semantics-page",
    );
  });

  it("selects a ref instance of the slot frame for violet slot marker evidence", () => {
    window.history.pushState(
      {},
      "",
      "/builder/adr-112-fixture?editingSemanticsFixture=slot-instance",
    );

    const store = makeStoreStub();
    applyEditingSemanticsFixture(store as ElementsState);

    const elements = vi.mocked(store.setElements).mock.calls[0][0] as Array<
      Element & { ref?: string }
    >;
    const slotInstance = elements.find(
      (element) => element.id === "adr-112-slot-instance",
    );

    expect(slotInstance).toMatchObject({
      ref: "adr-112-slot-frame",
      type: "ref",
    });
    expect(store.selectElementWithPageTransition).toHaveBeenCalledWith(
      "adr-112-slot-instance",
      "adr-112-editing-semantics-page",
    );
  });
});

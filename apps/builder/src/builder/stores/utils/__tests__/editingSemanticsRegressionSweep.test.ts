import { beforeEach, describe, expect, it } from "vitest";
import {
  SLOT_NAME_MIRROR_FIELD,
  withSlotMirrorName,
} from "@/adapters/canonical/slotMirror";
import type { Element } from "../../../../types/core/store.types";
import { useStore } from "../../elements";
import { historyManager } from "../../history";

function makeElement(id: string, overrides: Partial<Element> = {}): Element {
  return {
    id,
    type: "Button",
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    props: {},
    ...overrides,
  } as Element;
}

function setElements(elements: Element[]): void {
  useStore.setState({
    currentPageId: "page-1",
    elements,
    elementsMap: new Map(elements.map((element) => [element.id, element])),
    childrenMap: new Map(),
    selectedElementId: null,
    selectedElementProps: {},
  } as never);
  useStore.getState()._rebuildIndexes();
}

describe("ADR-112 editing semantics regression sweep", () => {
  beforeEach(() => {
    historyManager.setCurrentPage("page-1");
    setElements([]);
  });

  it("keeps 50 ref instances stable across delete and slot assignment updates", async () => {
    const origin = makeElement("origin", {
      reusable: true,
      componentName: "SweepButton",
      props: { label: "Origin" },
    });
    const instances = Array.from({ length: 50 }, (_, index) =>
      makeElement(`instance-${index}`, {
        type: "ref",
        ref: index % 2 === 0 ? "origin" : "SweepButton",
        props: { label: `Instance ${index}` },
      } as never),
    );
    setElements([origin, ...instances]);

    await useStore
      .getState()
      .removeElements(["instance-0", "instance-1"], { skipHistory: true });

    expect(useStore.getState().elementsMap.get("origin")).toMatchObject({
      reusable: true,
      componentName: "SweepButton",
    });
    expect(useStore.getState().elementsMap.has("instance-0")).toBe(false);
    expect(useStore.getState().elementsMap.has("instance-1")).toBe(false);

    const remainingIds = instances.slice(2).map((instance) => instance.id);
    for (const [index, id] of remainingIds.entries()) {
      const slotName = index % 2 === 0 ? "content" : "footer";
      await useStore
        .getState()
        .updateElementProps(id, { [SLOT_NAME_MIRROR_FIELD]: slotName });
      await useStore
        .getState()
        .updateElement(
          id,
          withSlotMirrorName({} as Partial<Element>, slotName),
        );
    }

    for (const [index, id] of remainingIds.entries()) {
      const slotName = index % 2 === 0 ? "content" : "footer";
      expect(useStore.getState().elementsMap.get(id)).toMatchObject({
        type: "ref",
        props: { [SLOT_NAME_MIRROR_FIELD]: slotName },
        ...withSlotMirrorName({}, slotName),
      });
    }
  });
});

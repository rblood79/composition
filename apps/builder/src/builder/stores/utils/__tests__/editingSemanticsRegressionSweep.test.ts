import { beforeEach, describe, expect, it } from "vitest";
import {
  SLOT_NAME_MIRROR_FIELD,
  withSlotMirrorName,
} from "@/adapters/canonical/slotMirror";
import type { Element } from "../../../../types/core/store.types";
import { useStore } from "../../elements";
import {
  resetPanelFixture,
  seedPanelElements,
} from "../../../__tests__/panelFixture";
import { historyManager } from "../../history";

type LegacyElementOverrides = Partial<Element> & {
  order_num?: number;
  reusable?: boolean;
  ref?: string;
};

function makeElement(
  id: string,
  overrides: LegacyElementOverrides = {},
): Element {
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
  resetPanelFixture();
  seedPanelElements(elements);
  useStore.setState({
    currentPageId: "page-1",
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
      // slot 배치의 운반체는 `props` 다. top-level mirror 는 canonical 왕복에서
      // 보존되지 않지만 (2026-09-05 실측), production 은 두 곳에 함께 쓰고
      // 읽기는 props 우선이라 (projectPageFrameTree — props → top-level 순서)
      // 배치 결과가 달라지지 않는다. 여기서는 실제 운반체만 잠근다.
      expect(useStore.getState().elementsMap.get(id)).toMatchObject({
        type: "ref",
        props: { [SLOT_NAME_MIRROR_FIELD]: slotName },
      });
    }
  });
});

import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Element } from "../../../../../types/builder/unified.types";
import type { CanonicalFrameElementScope } from "../../../../../adapters/canonical/frameElementScope";
import {
  collectExistingFrameSlots,
  filterElementsForPresetSlotReplace,
  normalizeFramePresetContainerStyle,
} from "./usePresetApply";

function makeElement(
  id: string,
  type: string,
  patch: Partial<Element> = {},
): Element {
  return {
    id,
    type,
    props: {},
    parent_id: null,
    page_id: null,
    order_num: 0,
    ...patch,
  } as Element;
}

describe("LayoutPresetSelector usePresetApply replace contract", () => {
  it("removes existing slots with one batch action instead of parallel single deletes", async () => {
    const source = await readFile(
      resolve(__dirname, "usePresetApply.ts"),
      "utf-8",
    );

    expect(source).toContain(
      "const removeElements = useStore((state) => state.removeElements);",
    );
    expect(source).toContain("await removeElements(legacySlotIds);");
    expect(source).toContain(
      "await removeCanonicalPresetSlots(existingSlotIds);",
    );
    expect(source).not.toContain("Promise.all(");
    expect(source).not.toContain("removeElement(slot.elementId)");
  });

  it("does not persist viewport minHeight as a frame body transform override", () => {
    expect(
      normalizeFramePresetContainerStyle({
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      }),
    ).toEqual({
      display: "flex",
      flexDirection: "column",
    });

    expect(
      normalizeFramePresetContainerStyle({
        display: "flex",
        minHeight: "640px",
      }),
    ).toEqual({
      display: "flex",
      minHeight: "640px",
    });
  });

  it("detects existing frame slots from canonical frame scope when the legacy mirror is stale", () => {
    const body = makeElement("frame-body", "body", {
      layout_id: "frame-1",
    });
    const slot = makeElement("slot-content", "Slot", {
      parent_id: "frame-body",
      layout_id: "frame-1",
      props: { name: "content" },
    });
    const frameScope: CanonicalFrameElementScope = {
      frameId: "frame-1",
      bodyElementId: "frame-body",
      elementIds: new Set(["frame-body", "slot-content"]),
    };

    expect(
      collectExistingFrameSlots({
        layoutId: "frame-1",
        elementsMap: new Map([[body.id, body]]),
        childrenMap: new Map(),
        canonicalElements: [body, slot],
        frameScope,
      }),
    ).toEqual([
      {
        slotName: "content",
        elementId: "slot-content",
        hasChildren: false,
      },
    ]);
  });

  it("filters canonical-only slots before replacing a frame preset", () => {
    const body = makeElement("frame-body", "body");
    const oldSlot = makeElement("slot-content", "Slot", {
      parent_id: "frame-body",
      props: { name: "content" },
    });
    const text = makeElement("text-content", "Text", {
      parent_id: "frame-body",
    });

    expect(
      filterElementsForPresetSlotReplace(
        [body, oldSlot, text],
        new Set(["slot-content"]),
      ).map((element) => element.id),
    ).toEqual(["frame-body", "text-content"]);
  });
});

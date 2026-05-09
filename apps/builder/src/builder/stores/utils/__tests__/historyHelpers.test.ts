import { afterEach, describe, expect, it, vi } from "vitest";

import type { Element } from "../../../../types/core/store.types";
import { historyManager } from "../../history";
import { trackGroupCreation, trackUngroup } from "../historyHelpers";

function makeElement(
  id: string,
  type: string,
  parentId: string | null,
): Element {
  return {
    id,
    type,
    parent_id: parentId,
    page_id: "page-1",
    order_num: 0,
    props: {},
  } as Element;
}

describe("historyHelpers canonical event payloads", () => {
  const addEntrySpy = vi.spyOn(historyManager, "addEntry");

  afterEach(() => {
    addEntrySpy.mockClear();
  });

  it("trackGroupCreation records insert/move canonical events without legacy group snapshots", () => {
    const group = makeElement("group-1", "Group", "body-1");
    const before = [
      makeElement("button-1", "Button", "body-1"),
      makeElement("button-2", "Button", "body-1"),
    ];
    const after = before.map((element) => ({
      ...element,
      parent_id: group.id,
    }));

    trackGroupCreation(group, before, after);

    expect(addEntrySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "group",
        elementId: group.id,
        data: expect.objectContaining({
          canonicalEvents: expect.arrayContaining([
            expect.objectContaining({
              type: "insert",
              node: expect.objectContaining({ id: group.id }),
            }),
            expect.objectContaining({
              type: "move",
              nodeId: "button-1",
              fromParentId: "body-1",
              toParentId: group.id,
            }),
          ]),
        }),
      }),
    );
    expect(addEntrySpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          element: expect.anything(),
          elements: expect.anything(),
        }),
      }),
    );
  });

  it("trackUngroup records move/remove canonical events without legacy ungroup snapshots", () => {
    const group = makeElement("group-1", "Group", "body-1");
    const before = [
      makeElement("button-1", "Button", group.id),
      makeElement("button-2", "Button", group.id),
    ];
    const after = before.map((element) => ({
      ...element,
      parent_id: "body-1",
    }));

    trackUngroup(group.id, before, group, after);

    expect(addEntrySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ungroup",
        elementId: group.id,
        data: expect.objectContaining({
          canonicalEvents: expect.arrayContaining([
            expect.objectContaining({
              type: "move",
              nodeId: "button-1",
              fromParentId: group.id,
              toParentId: "body-1",
            }),
            expect.objectContaining({
              type: "remove",
              node: expect.objectContaining({ id: group.id }),
            }),
          ]),
        }),
      }),
    );
    expect(addEntrySpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          element: expect.anything(),
          prevElements: expect.anything(),
        }),
      }),
    );
  });
});

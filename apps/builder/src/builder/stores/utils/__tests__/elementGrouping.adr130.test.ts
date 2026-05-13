/**
 * ADR-130 Phase 3 — elementGrouping `type: "frame"` + transitional collision 방어.
 *
 * Gate G3:
 *  - createGroupFromSelection 결과 element.type === "frame"
 *  - customId `group_N` non-duplicate (legacy "Group" + 신규 "frame" 공존 시)
 */
import { describe, expect, it } from "vitest";
import { createGroupFromSelection, ungroupElement } from "../elementGrouping";
import type { Element } from "../../../../types/core/store.types";

function makeElement(
  id: string,
  type: string,
  parentId: string | null,
  customId?: string,
): Element {
  return {
    id,
    customId,
    type: type as Element["type"],
    props: {},
    parent_id: parentId,
    page_id: "page-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as Element;
}

describe("ADR-130 elementGrouping", () => {
  it("createGroupFromSelection produces type:'frame'", () => {
    const a = makeElement("a", "Button", "root");
    const b = makeElement("b", "Button", "root");
    const map = new Map<string, Element>([
      ["a", a],
      ["b", b],
    ]);

    const result = createGroupFromSelection(["a", "b"], map, "page-1");
    expect(result.groupElement.type).toBe("frame");
    expect(result.groupElement.customId).toBe("group_1");
  });

  it("customId increments past legacy 'Group' elements (transitional collision guard)", () => {
    const legacy = makeElement("legacy", "Group", "root", "group_5");
    const a = makeElement("a", "Button", "root");
    const map = new Map<string, Element>([
      ["legacy", legacy],
      ["a", a],
    ]);

    const result = createGroupFromSelection(["a"], map, "page-1");
    expect(result.groupElement.customId).toBe("group_6");
  });

  it("ungroupElement accepts both legacy 'Group' and new 'frame'", () => {
    const legacy = makeElement("g", "Group", "root", "group_1");
    const newFrame = makeElement("f", "frame", "root", "group_2");
    const map = new Map<string, Element>([
      ["g", legacy],
      ["f", newFrame],
    ]);

    expect(() => ungroupElement("g", map)).not.toThrow();
    expect(() => ungroupElement("f", map)).not.toThrow();
  });
});

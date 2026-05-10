import { describe, expect, it } from "vitest";
import {
  collectDirtyElementSubtree,
  LAYOUT_AFFECTING_PROP_KEYS,
} from "./layoutInvalidation";

function createNode(id: string): { id: string } {
  return { id };
}

describe("layoutInvalidation", () => {
  it("padding and border props are treated as layout-affecting", () => {
    expect(LAYOUT_AFFECTING_PROP_KEYS.has("style")).toBe(true);
    expect(LAYOUT_AFFECTING_PROP_KEYS.has("padding")).toBe(true);
    expect(LAYOUT_AFFECTING_PROP_KEYS.has("paddingTop")).toBe(true);
    expect(LAYOUT_AFFECTING_PROP_KEYS.has("paddingBottom")).toBe(true);
    expect(LAYOUT_AFFECTING_PROP_KEYS.has("borderWidth")).toBe(true);
  });

  it("collects the dirty element and all descendants", () => {
    const root = createNode("root");
    const child = createNode("child");
    const grandchild = createNode("grandchild");
    const sibling = createNode("sibling");
    const unrelated = createNode("unrelated");

    const childrenMap = new Map<string, { id: string }[]>([
      ["root", [child, sibling]],
      ["child", [grandchild]],
      ["unrelated", []],
    ]);

    const dirtyIds = collectDirtyElementSubtree(
      root.id,
      childrenMap,
      new Set<string>(),
    );

    expect([...dirtyIds].sort()).toEqual(
      [root.id, child.id, grandchild.id, sibling.id].sort(),
    );
    expect(dirtyIds.has(unrelated.id)).toBe(false);
  });
});

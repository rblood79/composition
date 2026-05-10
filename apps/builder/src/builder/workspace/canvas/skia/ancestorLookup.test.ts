import { describe, expect, it } from "vitest";
import { findAncestorByTag } from "./ancestorLookup";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";

function el(
  id: string,
  type: string,
  parentId: string | null,
  props: Record<string, unknown> = {},
): CanvasSceneNode {
  return {
    id,
    type,
    props,
    parent_id: parentId,
    page_id: "p1",
    order_num: 0,
  } as CanvasSceneNode;
}

describe("findAncestorByTag", () => {
  it("finds direct parent matching tag", () => {
    const tabs = el("tabs1", "Tabs", null, { size: "lg" });
    const tabList = el("tl1", "TabList", "tabs1");
    const map = new Map([
      ["tabs1", tabs],
      ["tl1", tabList],
    ]);
    expect(findAncestorByTag(tabList, "Tabs", map, 3)).toBe(tabs);
  });

  it("finds grandparent (depth 2)", () => {
    const tabs = el("tabs1", "Tabs", null, { selectedKey: "t1" });
    const tabList = el("tl1", "TabList", "tabs1");
    const tab = el("tab1", "Tab", "tl1");
    const map = new Map([
      ["tabs1", tabs],
      ["tl1", tabList],
      ["tab1", tab],
    ]);
    expect(findAncestorByTag(tab, "Tabs", map, 3)).toBe(tabs);
  });

  it("returns undefined when not found within maxDepth", () => {
    const root = el("root", "Box", null);
    const child = el("c1", "Tab", "root");
    const map = new Map([
      ["root", root],
      ["c1", child],
    ]);
    expect(findAncestorByTag(child, "Tabs", map, 3)).toBeUndefined();
  });

  it("returns undefined for element without parent", () => {
    const orphan = el("o1", "Tab", null);
    const map = new Map([["o1", orphan]]);
    expect(findAncestorByTag(orphan, "Tabs", map, 3)).toBeUndefined();
  });
});

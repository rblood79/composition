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

  // density (2026-08-21): size 와 직교하는 간격 축. TabList 는 gap, TableView 는 자손
  //   Column/Cell 의 세로 padding 을 바꾼다 → Inspector 편집 시 layoutVersion 이 올라야
  //   Skia 가 재계산한다. 계층 B(캐시 시그니처)는 layoutCache.static.test.ts 가 담당 —
  //   둘은 AND 조건이라 한쪽만 등재하면 무반영이다 (layout-engine.md §5-심볼 2계층 체인).
  it("treats density as layout-affecting", () => {
    expect(LAYOUT_AFFECTING_PROP_KEYS.has("density")).toBe(true);
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

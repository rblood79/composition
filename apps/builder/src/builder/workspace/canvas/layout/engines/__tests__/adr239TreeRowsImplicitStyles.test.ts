import { describe, expect, it } from "vitest";

import type { CanvasLayoutNode } from "../../layoutNode";
import { applyImplicitStyles } from "../implicitStyles";

/**
 * ADR-239 Phase 1 — Tree 행 layout (breakdown §5 N1): 중첩 TreeItem 은 Tree 의 형제 행으로 펴지고 (DOM RAC 와 같은 평탄
 * 행), TreeItem 행 상자는 역할 자식만 가로로 — 왼쪽 여백 = chevron 앞까지 (깊이마다 +16).
 */

function node(
  id: string,
  type: string,
  parent_id: string | null,
  props: Record<string, unknown> = {},
): CanvasLayoutNode {
  return { id, type, parent_id, props } as unknown as CanvasLayoutNode;
}

const tree = node("t", "Tree", null, {
  selectionMode: "single",
  expandedKeys: ["a"],
});
const a = node("a", "TreeItem", "t");
const aLabel = node("a-label", "Text", "a", { children: "A" });
const b = node("b", "TreeItem", "a");
const bLabel = node("b-label", "Text", "b", { children: "B" });
const c = node("c", "TreeItem", "t");
const all = [tree, a, aLabel, b, bLabel, c];
const byId = new Map(all.map((n) => [n.id, n]));
const childrenOf = (id: string) => all.filter((n) => n.parent_id === id);

const apply = (container: CanvasLayoutNode) =>
  applyImplicitStyles(container, childrenOf(container.id), childrenOf, byId);

describe("ADR-239 — Tree 행 평탄화 · TreeItem 행 여백", () => {
  it("Tree layout 자식 = TreeItem 자손 DFS (부모 행 → 자식 행 → 다음 행) · 접힌 항목 (`expandedKeys` 밖) 의 자식 행 제외", () => {
    expect(apply(tree).filteredChildren.map((n) => n.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    const collapsed = { ...tree, props: { ...tree.props, expandedKeys: [] } };
    byId.set("t", collapsed);
    try {
      expect(apply(collapsed).filteredChildren.map((n) => n.id)).toEqual([
        "a",
        "c",
      ]);
    } finally {
      byId.set("t", tree);
    }
  });

  it("TreeItem layout 자식 = 역할 자식만 · 왼쪽 여백 = paddingX 8 + chevron 16 + gap 6 (깊이마다 +16) · 최소 높이 32", () => {
    const rowA = apply(a);
    expect(rowA.filteredChildren.map((n) => n.id)).toEqual(["a-label"]);
    expect(rowA.effectiveParent.props.style).toMatchObject({
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: 30,
      paddingRight: 8,
      paddingTop: 4,
      paddingBottom: 4,
      minHeight: 32,
    });
    expect(
      (apply(b).effectiveParent.props.style as Record<string, unknown>)
        .paddingLeft,
    ).toBe(46);
  });

  it("역할 자식 없는 TreeItem (239 전 plain) 은 행 여백을 싣지 않는다 — 글자는 TreeItem shape 가 그린다", () => {
    const style = apply(c).effectiveParent.props.style as
      Record<string, unknown> | undefined;
    expect(style?.paddingLeft).toBeUndefined();
  });
});

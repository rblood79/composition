import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createPresentationLayoutPlan,
  publishPresentationLayout,
  resolveCanonicalNodeWithPresentation,
} from "./editorPresentationLayoutLane";
import type { CanvasLayoutNode } from "../workspace/canvas/layout/layoutNode";

describe("editor presentation layout lane", () => {
  it("promotes only used-size parents and collects the affected subtree", () => {
    const plan = createPresentationLayoutPlan({
      targets: [{ kind: "canonical-node", nodeId: "child" }],
      tree: {
        childrenByParent: new Map([
          ["root", ["parent"]],
          ["parent", ["child", "sibling"]],
        ]),
        parentById: new Map([
          ["root", null],
          ["parent", "root"],
          ["child", "parent"],
          ["sibling", "parent"],
        ]),
      },
      shouldPromoteParent: (parentId) => parentId === "parent",
    });

    expect(plan.roots).toEqual(["parent"]);
    expect(plan.affectedNodeIds).toEqual(
      new Set(["parent", "child", "sibling"]),
    );
  });

  it("preserves unaffected layout object identity when merging a targeted result", () => {
    const unaffected = { x: 1 };
    const changed = { x: 2 };
    const result = publishPresentationLayout({
      plan: { roots: ["child"], affectedNodeIds: new Set(["child"]) },
      previousLayoutMap: new Map([
        ["root", unaffected],
        ["child", { x: 0 }],
      ]),
      resolveNode: () => new Map([["child", changed]]),
    });

    expect(result.layoutMap.get("root")).toBe(unaffected);
    expect(result.layoutMap.get("child")).toBe(changed);
  });

  it("merges style and geometry without mutating the canonical layout node", () => {
    const node = {
      id: "node-1",
      parent_id: null,
      page_id: "page-1",
      props: { style: { width: 100, color: "red" } },
      type: "Box",
      width: 100,
      height: 20,
    } as CanvasLayoutNode & {
      height: number;
      width: number;
    };
    const target = { kind: "canonical-node", nodeId: "node-1" } as const;
    const next = resolveCanonicalNodeWithPresentation(node, target, [
      { patch: { width: 140 }, target, type: "style.patch" },
      { patch: { x: 12 }, target, type: "geometry.patch" },
    ]);

    expect(next).not.toBe(node);
    expect(next.props).toEqual({
      style: { width: 140, color: "red", left: 12 },
    });
    expect(node.props?.style).toEqual({ width: 100, color: "red" });
  });

  it("does not leak paint-only style into the layout input", () => {
    const node: CanvasLayoutNode = {
      id: "node-1",
      props: { style: { color: "red" } },
      type: "Box",
    };
    const target = { kind: "canonical-node", nodeId: "node-1" } as const;
    expect(
      resolveCanonicalNodeWithPresentation(node, target, [
        { patch: { color: "blue" }, target, type: "style.patch" },
      ]),
    ).toBe(node);
  });

  it("ADR-188 G0: targeted layout has no full-sync escape hatch", async () => {
    const source = await readFile(
      resolve(__dirname, "editorPresentationLayoutLane.ts"),
      "utf-8",
    );

    expect(source).not.toMatch(/layoutVersion/);
    expect(source).not.toMatch(/resync\(true\)/);
    expect(source).not.toMatch(/onLayoutPublished/);
    expect(source).not.toMatch(/buildRenderCommandStream/);
  });
});

import { describe, expect, it } from "vitest";
import { projectFillLayoutNodes } from "./projectFillLayout";
import type { CanvasLayoutNode } from "./layoutNode";

const node = (
  id: string,
  extra: Partial<CanvasLayoutNode> & { props?: Record<string, unknown> },
): CanvasLayoutNode =>
  ({
    id,
    type: "Button",
    parent_id: null,
    props: { style: {} },
    ...extra,
  }) as CanvasLayoutNode;

describe("projectFillLayoutNodes — Fill 시스템이 만진 노드 (marker 또는 명시 null) 만 투영", () => {
  it("keeps ratio-dependent stretch protection for explicit null axes (Preview parity)", () => {
    const nodes = new Map<string, CanvasLayoutNode>([
      [
        "row",
        node("row", {
          type: "Frame",
          props: { style: { display: "flex", flexDirection: "row" } },
        }),
      ],
      [
        "a",
        node("a", {
          parent_id: "row",
          sizing: { width: null, height: null },
          props: {
            style: {
              width: "517px",
              height: "auto",
              aspectRatio: "591.33 / 240",
            },
          },
        }),
      ],
    ]);
    projectFillLayoutNodes(nodes);
    expect(nodes.get("a")?.props.style).toMatchObject({ alignSelf: "start" });
  });

  it("does not touch CSS-only nodes without any sizing axis", () => {
    const original = node("b", {
      parent_id: "row",
      props: {
        style: { width: "517px", height: "auto", aspectRatio: "2 / 1" },
      },
    });
    const nodes = new Map<string, CanvasLayoutNode>([
      [
        "row",
        node("row", { type: "Frame", props: { style: { display: "flex" } } }),
      ],
      ["b", original],
    ]);
    projectFillLayoutNodes(nodes);
    expect(nodes.get("b")).toBe(original);
  });

  it("hug column parent → child Height Fill gets flex-basis auto (Preview parity)", () => {
    const nodes = new Map<string, CanvasLayoutNode>([
      [
        "col",
        node("col", {
          type: "Frame",
          props: { style: { display: "flex", flexDirection: "column" } },
        }),
      ],
      ["a", node("a", { parent_id: "col", sizing: { height: { factor: 1 } } })],
    ]);
    projectFillLayoutNodes(nodes);
    expect(nodes.get("a")?.props.style).toMatchObject({
      flexGrow: 1,
      flexBasis: "auto",
    });
    const fixed = new Map<string, CanvasLayoutNode>([
      [
        "col",
        node("col", {
          type: "Frame",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              height: "240px",
            },
          },
        }),
      ],
      ["a", node("a", { parent_id: "col", sizing: { height: { factor: 1 } } })],
    ]);
    projectFillLayoutNodes(fixed);
    expect(fixed.get("a")?.props.style).toMatchObject({ flexBasis: "0px" });
  });
});

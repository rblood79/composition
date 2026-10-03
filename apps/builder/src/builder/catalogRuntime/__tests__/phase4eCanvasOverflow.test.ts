import { describe, expect, it } from "vitest";
import {
  catalogOverflowClips,
  catalogOverflowContent,
  catalogOverflowHatch,
  catalogScrollRange,
  type CatalogOverflowTree,
} from "../canvasOverflow";

/** box (overflow per test) > [inner (visible) > [deep], side]; scene and local rects. */
function tree(overflow: Record<string, string>): CatalogOverflowTree {
  const children: Record<string, string[]> = {
    box: ["inner", "side"],
    inner: ["deep"],
  };
  const parent: Record<string, string> = {
    inner: "box",
    side: "box",
    deep: "inner",
  };
  return {
    overflowOf: (id) => overflow[id] ?? "visible",
    childrenOf: (id) => children[id] ?? [],
    parentOf: (id) => parent[id],
  };
}

const rect = (x: number, y: number, width: number, height: number) => ({
  x,
  y,
  width,
  height,
});

// Scene boxes: box 0,0 100×100; inner inside; deep leaves at the bottom; side leaves on the right.
const scene = new Map([
  ["box", rect(0, 0, 100, 100)],
  ["inner", rect(10, 10, 80, 80)],
  ["deep", rect(20, 60, 40, 70)],
  ["side", rect(90, 10, 30, 20)],
]);
// Local (parent-relative) rects of the same tree.
const local = new Map([
  ["box", rect(0, 0, 100, 100)],
  ["inner", rect(10, 10, 80, 80)],
  ["deep", rect(10, 50, 40, 70)],
  ["side", rect(90, 10, 30, 20)],
]);

describe("catalog Canvas overflow", () => {
  it("clips for every overflow but visible (CSS)", () => {
    expect(
      ["visible", "hidden", "clip", "auto", "scroll", undefined].map(
        catalogOverflowClips,
      ),
    ).toEqual([false, true, true, true, true, false]);
  });

  it("scrolls by the descendants' extent past the box, plus the end padding", () => {
    const t = tree({ box: "auto" });
    // deep ends at 10 + 50 + 70 = 130 down; side at 90 + 30 = 120 right.
    expect(
      catalogScrollRange("box", t, (id) => local.get(id), {
        right: 0,
        bottom: 8,
      }),
    ).toEqual({ maxScrollTop: 38, maxScrollLeft: 20 });
    // A descendant that clips its own content stops the descent.
    expect(
      catalogScrollRange(
        "box",
        tree({ box: "auto", inner: "hidden" }),
        (id) => local.get(id),
        { right: 0, bottom: 0 },
      ),
    ).toEqual({ maxScrollTop: 0, maxScrollLeft: 20 });
  });

  it("shows the descendants that leave a clipping box", () => {
    const info = catalogOverflowContent("box", tree({ box: "hidden" }), scene);
    expect(info?.overflowChildren.map((c) => c.id).sort()).toEqual([
      "deep",
      "side",
    ]);
    expect(info?.overflowType).toBe("hidden");
    expect(catalogOverflowContent("box", tree({}), scene)).toBeNull();
    expect(
      catalogOverflowContent(
        "box",
        tree({ box: "hidden", inner: "clip" }),
        scene,
      )?.overflowChildren.map((c) => c.id),
    ).toEqual(["side"]);
  });

  it("hatches a selected box leaving its nearest scroll/auto ancestor", () => {
    expect(
      catalogOverflowHatch("deep", tree({ box: "scroll" }), scene),
    ).toEqual({
      containerBounds: scene.get("box"),
      childBounds: scene.get("deep"),
      overflowType: "scroll",
    });
    // hidden does not scroll; a box inside the container is not hatched.
    expect(
      catalogOverflowHatch("deep", tree({ box: "hidden" }), scene),
    ).toBeNull();
    expect(
      catalogOverflowHatch("inner", tree({ box: "auto" }), scene),
    ).toBeNull();
    // The nearest clipping ancestor decides (inner clips: deep belongs to inner, not box).
    expect(
      catalogOverflowHatch(
        "deep",
        tree({ box: "auto", inner: "hidden" }),
        scene,
      ),
    ).toBeNull();
  });
});

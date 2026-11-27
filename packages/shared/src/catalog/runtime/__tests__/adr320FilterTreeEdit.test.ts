import { describe, expect, it } from "vitest";
import type { ViewCondition, ViewConditionGroup } from "../../document/types";
import {
  catalogFilterAdded,
  catalogFilterLevelOf,
  catalogFilterMoved,
  catalogFilterShifted,
  catalogFilterSwitched,
  catalogFilterTreeWith,
  catalogFilterUngrouped,
  catalogFilterWrapped,
} from "../filterTreeEdit";

/**
 * ADR-320 G4 — the builder's edits against shapes written out here (breakdown §5.6 · Decision 3):
 * a shape is `id` for a condition, `op(id: …)` for a group.
 */
const c = (id: string): ViewCondition => ({
  id,
  fields: [["data:field:a" as never]],
  op: "equals",
  value: id,
});
const g = (
  id: string,
  op: "and" | "or",
  ...items: (ViewCondition | ViewConditionGroup)[]
): ViewConditionGroup => ({ id, op, items });
const root = (...items: (ViewCondition | ViewConditionGroup)[]) =>
  g("scope", "and", ...items);

const shape = (tree: ViewConditionGroup | null | undefined): string => {
  if (tree === undefined) return "refused";
  if (tree === null) return "none";
  const walk = (item: ViewCondition | ViewConditionGroup): string =>
    "items" in item
      ? `${item.op}(${item.id}: ${item.items.map(walk).join(" ")})`
      : item.id;
  return tree.items.map(walk).join(" ");
};

// a  or(g1: b and(g2: c d))  e
const START = root(
  c("a"),
  g("g1", "or", c("b"), g("g2", "and", c("c"), c("d"))),
  c("e"),
);
// Three levels of groups: or(l1: and(l2: or(l3: x)))
const DEEP = root(g("l1", "or", g("l2", "and", g("l3", "or", c("x")))), c("y"));

describe("ADR-320 G4 — the builder's tree edits", () => {
  it("moves before · after · into a group (a drag)", () => {
    expect(shape(catalogFilterMoved(START, ["e"], "g1", "on"))).toBe(
      "a or(g1: b and(g2: c d) e)",
    );
    expect(shape(catalogFilterMoved(START, ["a"], "c", "after"))).toBe(
      "or(g1: b and(g2: c a d)) e",
    );
    // (Out of a nested group to the root's front.)
    expect(shape(catalogFilterMoved(START, ["d"], "a", "before"))).toBe(
      "d a or(g1: b and(g2: c)) e",
    );
    // (A whole group, into its parent's sibling position.)
    expect(shape(catalogFilterMoved(START, ["g2"], "e", "after"))).toBe(
      "a or(g1: b) e and(g2: c d)",
    );
  });

  it("a group the move empties goes (storage refuses an empty group)", () => {
    expect(shape(catalogFilterMoved(START, ["c", "d"], "a", "after"))).toBe(
      "a c d or(g1: b) e",
    );
    expect(shape(catalogFilterTreeWith(START, "b", () => []))).toBe(
      "a or(g1: and(g2: c d)) e",
    );
    expect(
      shape(
        catalogFilterTreeWith(
          catalogFilterTreeWith(root(g("g", "or", c("z"))), "z", () => []) ??
            undefined,
          "nothing",
          (item) => [item],
        ),
      ),
    ).toBe("none");
  });

  it("refuses a drop on a condition, into a moved group, or deeper than three levels", () => {
    expect(shape(catalogFilterMoved(START, ["a"], "b", "on"))).toBe("refused");
    expect(shape(catalogFilterMoved(START, ["g1"], "g2", "on"))).toBe(
      "refused",
    );
    expect(shape(catalogFilterMoved(START, ["g1"], "c", "before"))).toBe(
      "refused",
    );
    // g1 (two levels) into l2 (level 2) would make four.
    const both = root(...DEEP.items, START.items[1]!);
    expect(shape(catalogFilterMoved(both, ["g1"], "l2", "on"))).toBe("refused");
    // …into l1 makes three — taken.
    expect(shape(catalogFilterMoved(both, ["g1"], "l1", "on"))).toBe(
      "or(l1: and(l2: or(l3: x)) or(g1: b and(g2: c d))) y",
    );
  });

  it("「Move up」 · 「Move down」 among the group's items only", () => {
    expect(shape(catalogFilterShifted(START, "e", -1))).toBe(
      "a e or(g1: b and(g2: c d))",
    );
    expect(shape(catalogFilterShifted(START, "c", 1))).toBe(
      "a or(g1: b and(g2: d c)) e",
    );
    expect(shape(catalogFilterShifted(START, "b", -1))).toBe("refused");
    expect(shape(catalogFilterShifted(START, "e", 1))).toBe("refused");
  });

  it("「Group」 wraps in the opposite op · 「Ungroup」 · the and / or switch", () => {
    expect(shape(catalogFilterWrapped(START, "a", "n"))).toBe(
      "or(n: a) or(g1: b and(g2: c d)) e",
    );
    expect(shape(catalogFilterWrapped(START, "b", "n"))).toBe(
      "a or(g1: and(n: b) and(g2: c d)) e",
    );
    expect(shape(catalogFilterWrapped(DEEP, "x", "n"))).toBe("refused");
    expect(shape(catalogFilterUngrouped(START, "g2"))).toBe(
      "a or(g1: b c d) e",
    );
    expect(shape(catalogFilterSwitched(START, "g1"))).toBe(
      "a and(g1: b and(g2: c d)) e",
    );
  });

  it("「Add condition」 · 「Add group」 — no group below the third level", () => {
    expect(shape(catalogFilterAdded(START, undefined, c("n")))).toBe(
      "a or(g1: b and(g2: c d)) e n",
    );
    expect(shape(catalogFilterAdded(START, "g1", c("n"), "ng"))).toBe(
      "a or(g1: b and(g2: c d) and(ng: n)) e",
    );
    expect(shape(catalogFilterAdded(undefined, undefined, c("n"), "ng"))).toBe(
      "or(ng: n)",
    );
    expect(catalogFilterLevelOf(DEEP, "l3")).toBe(3);
    expect(shape(catalogFilterAdded(DEEP, "l3", c("n"), "ng"))).toBe("refused");
    expect(shape(catalogFilterAdded(DEEP, "l3", c("n")))).toBe(
      "or(l1: and(l2: or(l3: x n))) y",
    );
    expect(shape(catalogFilterAdded(START, "a", c("n")))).toBe("refused");
  });
});

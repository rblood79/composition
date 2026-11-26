import { describe, expect, it } from "vitest";
import type { CatalogBoundRow } from "../../resolution/resolver";
import { catalogStripedRows } from "../tableStripes";

/**
 * ADR-317 Phase 5 — which rows a 「Striped rows」 Table shades (breakdown §5.5): every second data
 * row in the order shown. The expected stripes are written out by hand from the rules.
 */
const row = (
  key: string,
  extra: Partial<CatalogBoundRow> = {},
): CatalogBoundRow => ({ key, values: {}, ...extra });

/** Each row's key and stripe (`-` none · `0` not shaded · `1` shaded), depth first. */
function stripes(rows: readonly CatalogBoundRow[]): string[] {
  return rows.flatMap((item) => [
    `${item.key}:${item.stripe === undefined ? "-" : item.stripe.on ? "1" : "0"}`,
    ...stripes(item.children ?? []),
  ]);
}

describe("ADR-317 Phase 5 — catalogStripedRows", () => {
  it("every second data row in the order given; the list's meta stays; the same list is the same answer", () => {
    const rows = Object.assign([row("a"), row("b"), row("c"), row("d")], {
      total: 40,
    });
    const out = catalogStripedRows(rows);
    expect(stripes(out)).toEqual(["a:0", "b:1", "c:0", "d:1"]);
    expect((out as unknown as { total: number }).total).toBe(40);
    expect(catalogStripedRows(rows)).toBe(out);
  });

  it("a group's rows start again; a group row · a placeholder is not counted", () => {
    const out = catalogStripedRows([
      row("g1", {
        group: { column: "type", count: 3, depth: 0, expanded: true },
        children: [row("a"), row("b"), row("c")],
      }),
      row("g2", {
        group: { column: "type", count: 2, depth: 0, expanded: true },
        children: [row("d"), row("e")],
      }),
      row("g3", {
        group: { column: "type", count: 2, depth: 0, expanded: false },
        children: [row("g3-placeholder", { placeholder: true })],
      }),
    ]);
    expect(stripes(out)).toEqual([
      "g1:-",
      "a:0",
      "b:1",
      "c:0",
      "g2:-",
      "d:0",
      "e:1",
      "g3:-",
      "g3-placeholder:-",
    ]);
  });

  it("a tree's child rows go on counting depth first; a detail row takes its row's; a pinned row stands apart", () => {
    const tree = { depth: 0, expanded: true, parent: true };
    const out = catalogStripedRows([
      row("top", { pinned: "top" }),
      row("a", {
        tree,
        children: [
          row("a1", { tree: { ...tree, depth: 1, parent: false } }),
          row("a2", { tree: { ...tree, depth: 1, parent: false } }),
        ],
      }),
      row("b", { children: [row("b-detail", { detail: true })] }),
      row("c"),
      row("bottom", { pinned: "bottom" }),
    ]);
    expect(stripes(out)).toEqual([
      "top:-",
      "a:0",
      "a1:1",
      "a2:0",
      "b:1",
      "b-detail:1",
      "c:0",
      "bottom:-",
    ]);
  });

  it("a merged Column's run takes its first row's stripe: the rows whose own differs say so by Column key", () => {
    // (type: A A A B B — runs p1..p3 · p4..p5; name never merges.)
    const out = catalogStripedRows([
      row("p1", { merge: { down: ["type"] } }),
      row("p2", { merge: { up: ["type"], down: ["type"] } }),
      row("p3", { merge: { up: ["type"] } }),
      row("p4", { merge: { down: ["type"] } }),
      row("p5", { merge: { up: ["type"] } }),
    ]);
    expect(stripes(out)).toEqual(["p1:0", "p2:1", "p3:0", "p4:1", "p5:0"]);
    // (p2 · p5 stand in a run whose stripe is not their own — p1's off, p4's on.)
    expect(out.map((item) => item.stripe?.runs)).toEqual([
      undefined,
      ["type"],
      undefined,
      undefined,
      ["type"],
    ]);
  });
});

describe("ADR-317 Phase 5 — the DOM's stripe blocks sit under the row's states", () => {
  it("the Table rule's stripe blocks come before its row state block (the same `:where` weight — the later wins)", async () => {
    const { COMPONENT_RULES_TABLE } = await import(
      "../../generated/componentRulesTable"
    );
    const keys = Object.keys(
      (COMPONENT_RULES_TABLE.Table as { partStateStyles: object })
        .partStateStyles,
    );
    const rowStates = keys.indexOf("& .react-aria-Row%");
    const stripes = keys.filter((key) => /data-strip/.test(key));
    expect(stripes).toHaveLength(3);
    expect(rowStates).toBeGreaterThan(-1);
    for (const key of stripes)
      expect(keys.indexOf(key)).toBeLessThan(rowStates);
  });
});

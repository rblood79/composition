import { describe, expect, it } from "vitest";
import { catalogTableSortedRows } from "../tableSort";

/**
 * ADR-315 Phase 2 — an authored Table's Rows (not data rows) in a sort of several columns: by the
 * text of their cells, entry after entry — the same order function as the data rows
 * (`viewSortOrder`). Expected orders are written by hand.
 */
interface Rec {
  id: string;
  parentId: string;
  children: string[];
  props: Record<string, unknown>;
  type: string;
}
const records = new Map<string, Rec>();
const add = (
  id: string,
  type: string,
  parentId: string,
  props: Record<string, unknown> = {},
) => {
  records.set(id, { id, type, parentId, children: [], props });
  records.get(parentId)?.children.push(id);
};
add("table", "Table", "");
add("header", "TableHeader", "table");
add("c-team", "Column", "header", { children: "Team" });
add("c-score", "Column", "header", {
  children: "Score",
  sortEmptyValues: "first",
});
add("body", "TableBody", "table");
// r1 B 5 · r2 A 7 · r3 A 10 · r4 B (none) · r5 A 7
for (const [id, team, score] of [
  ["r1", "B", "5"],
  ["r2", "A", "7"],
  ["r3", "A", "10"],
  ["r4", "B", ""],
  ["r5", "A", "7"],
] as const) {
  add(id, "Row", "body");
  add(`${id}-team`, "Cell", id, { children: team });
  add(`${id}-score`, "Cell", id, { children: score });
}
const get = (id: string) => records.get(id);
const typeOf = (record: Rec) => record.type;
const sorted = (
  sorts: { column: string; direction: "ascending" | "descending" }[],
) => catalogTableSortedRows(records.get("body")!, sorts, get, typeOf);

describe("catalogTableSortedRows — a sort of several columns", () => {
  it("orders the Rows by each entry's cell text in turn (digits by value)", () => {
    // team ↑ then score ↓: A 10 (r3) · A 7 (r2) · A 7 (r5) · B — r4 has no score, and the Score
    // Column puts its empty values first: r4 · r1.
    expect(
      sorted([
        { column: "c-team", direction: "ascending" },
        { column: "c-score", direction: "descending" },
      ]),
    ).toEqual(["r3", "r2", "r5", "r4", "r1"]);
    // score ↑ alone: (none) r4 · 5 (r1) · 7 (r2) · 7 (r5) · 10 (r3) — 10 after 7, not as text.
    expect(sorted([{ column: "c-score", direction: "ascending" }])).toEqual([
      "r4",
      "r1",
      "r2",
      "r5",
      "r3",
    ]);
  });

  it("is no order with no entry or no known column", () => {
    expect(sorted([])).toBeUndefined();
    expect(
      sorted([{ column: "gone", direction: "ascending" }]),
    ).toBeUndefined();
    // (An unknown column among known ones is dropped: the rest still sort.)
    expect(
      sorted([
        { column: "gone", direction: "ascending" },
        { column: "c-team", direction: "descending" },
      ]),
    ).toEqual(["r1", "r4", "r2", "r3", "r5"]);
  });
});

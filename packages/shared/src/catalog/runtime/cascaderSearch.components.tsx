import { viewCompare } from "../../collections/view/comparison";
import type { CascaderEntry, CascaderTable } from "./cascader";

/**
 * ADR-322 Phase 5 — a Cascader's search (breakdown §4.4): with a query, every mode shows one flat
 * list of the pickable items whose name holds it, each with its path — the list box node's results
 * `Menu` under the search field node, in RAC `Autocomplete` (ADR-326 — `cascaderMenu.components.tsx`).
 * The comparison is the data view's `contains` (one search rule — Hangul read as the collator does).
 * 200 shown, then 「N more — type more」. Without a query the mode's levels show.
 */

/** At most this many results (breakdown §4.4). */
export const CASCADER_SEARCH_LIMIT = 200;

/** The search's words (the field's · its results' — shared with the `columns` list box). */
export const CASCADER_SEARCH_STRINGS: Readonly<
  Record<
    string,
    {
      readonly search: string;
      readonly empty: string;
      readonly more: (count: number) => string;
      /** Phase 6 — levels loaded one by one: only the items loaded are searched (breakdown §4.3). */
      readonly loadedOnly: string;
    }
  >
> = {
  en: {
    search: "Search",
    empty: "No results",
    more: (count) => `${count} more — type more to narrow`,
    loadedOnly: "Searching the loaded items only",
  },
  ko: {
    search: "검색",
    empty: "결과 없음",
    more: (count) => `${count} 건 더 — 더 입력해 좁히기`,
    loadedOnly: "불러온 항목에서만 찾는다",
  },
};

/** The pickable items whose name holds the query, in the table's order. */
export function cascaderSearch(
  table: CascaderTable,
  query: string,
  locale?: string,
): CascaderEntry[] {
  if (!query) return [];
  return table.entries.filter(
    (entry) =>
      entry.pickable &&
      viewCompare("contains", entry.name, query, { kind: "text", locale }),
  );
}

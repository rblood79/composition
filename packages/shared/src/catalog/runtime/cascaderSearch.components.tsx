import { viewCompare } from "../../collections/view/comparison";
import type { CascaderEntry, CascaderTable } from "./cascader";

/**
 * ADR-322 Phase 5 — a Cascader's search (breakdown §4.4), by its `searchScope` (사용자 결정
 * 2026-11-29 — the reference's): `level` (default) — the query narrows the rows of the level shown
 * (`drill` the open level, `columns` the first; branches stay to go into); `deep` · `global` — one
 * flat list of the pickable items whose name holds it (under the level shown · of every level), each
 * with its path — the list box node's results `Menu` under the search field node, in RAC
 * `Autocomplete` (ADR-326 — `cascaderMenu.components.tsx`). A `tree` field always shows the flat list.
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

/** Whether a name holds the query (the data view's `contains`; no query holds every name). */
export function cascaderNameMatch(
  name: string,
  query: string,
  locale?: string,
): boolean {
  return (
    !query || viewCompare("contains", name, query, { kind: "text", locale })
  );
}

/**
 * The pickable items whose name holds the query, in the table's order — every level's, or with
 * `under` (a level's path id — `searchScope: "deep"`) the items of that level and the ones below it.
 */
export function cascaderSearch(
  table: CascaderTable,
  query: string,
  locale?: string,
  under: string | null = null,
): CascaderEntry[] {
  if (!query) return [];
  const below = (entry: CascaderEntry) => {
    for (
      let at = entry.parentPathId;
      at !== null;
      at = table.byPathId.get(at)?.parentPathId ?? null
    )
      if (at === under) return true;
    return false;
  };
  return table.entries.filter(
    (entry) =>
      entry.pickable &&
      // (The name first — the walk up the levels is for the few that hold the query, 판독 1 #10.)
      cascaderNameMatch(entry.name, query, locale) &&
      (under === null || below(entry)),
  );
}

/**
 * ADR-315 Phase 5 증분 5g — a Table's grouping · totals row as the group queries its server answers
 * (breakdown §4.3.2): a level of the grouping (by its field — each group's row count and its
 * Columns' aggregates), a totals row (a group query without fields). Read by the Preview session
 * only — kept out of `tableStateQuery.ts`, which the Builder's panels read on the first screen.
 */
import type { ViewAggregate, ViewQuery } from "../document/types";
import {
  CATALOG_TABLE_STATE_VIEW_ID,
  catalogFieldIdOf as fieldIdOf,
} from "./tableStateQuery";
import {
  CATALOG_GROUP_ROW_COUNT,
  type CatalogRowGroups,
  type CatalogRowSlices,
} from "./tableRowSlices";

/** A grouping's level · a totals row as the view that groups the rows (`groupBy` · aggregates). */
export type CatalogTableGroupView = Required<
  Pick<ViewQuery, "groupBy" | "aggregates">
>;

/**
 * ADR-315 Phase 5 증분 5g — a grouping's level as a group query (breakdown §4.3.2): by that
 * level's field, the group's row count and each Column's aggregate (as the Column key — a group
 * row's values are its Columns'). Undefined = a key names no field of the rows.
 */
export function catalogRowGroupLevelView(
  groups: CatalogRowGroups,
  level: number,
  schema: readonly { id?: string; key?: string }[],
): CatalogTableGroupView | undefined {
  const key = groups.keys[level];
  const field = key === undefined ? undefined : fieldIdOf(schema, key);
  if (!field) return undefined;
  const aggregates = aggregatesOf(groups.aggregates, schema);
  return (
    aggregates && {
      groupBy: [[field]],
      aggregates: [{ fn: "count", as: CATALOG_GROUP_ROW_COUNT }, ...aggregates],
    }
  );
}

/** ADR-315 Phase 5 증분 5g — a totals row as a group query without fields (one row, §4.3.2). */
export function catalogRowTotalsView(
  totals: NonNullable<CatalogRowSlices["totals"]>,
  schema: readonly { id?: string; key?: string }[],
): CatalogTableGroupView | undefined {
  const aggregates = aggregatesOf(
    totals.flatMap((entry) =>
      entry.fn ? [{ key: entry.key, fn: entry.fn }] : [],
    ),
    schema,
  );
  return aggregates && { groupBy: [], aggregates };
}

function aggregatesOf(
  entries: readonly { key: string; fn: ViewAggregate["fn"] }[],
  schema: readonly { id?: string; key?: string }[],
): ViewAggregate[] | undefined {
  const out: ViewAggregate[] = [];
  for (const entry of entries) {
    const field = fieldIdOf(schema, entry.key);
    if (!field) return undefined;
    out.push({ fn: entry.fn, field: [field], as: entry.key });
  }
  return out;
}

/**
 * ADR-315 Phase 5 증분 5g — a view chain grouped as `view` (a level · a totals row): its last view
 * groups (a chain without one: the state's view alone).
 */
export function catalogTableGroupedQueries(
  queries: readonly ViewQuery[] | undefined,
  view: CatalogTableGroupView,
): readonly ViewQuery[] {
  const last: ViewQuery = queries?.at(-1) ?? {
    where: { id: CATALOG_TABLE_STATE_VIEW_ID, op: "and", items: [] },
  };
  return [...(queries?.slice(0, -1) ?? []), { ...last, ...view }];
}

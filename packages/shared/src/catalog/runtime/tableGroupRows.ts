/**
 * ADR-315 Phase 5 — a bound Table's group rows (TanStack grouped row model, breakdown §5.4): the
 * rows a Table's state keeps (filtered · searched · sorted — all of them, before a window · page
 * cuts) grouped by its grouping's fields, outer level first. A group row holds its group value,
 * its row count and each Column's aggregate over every data row under it (the evaluator's
 * aggregates — `viewAggregateOf`); its children are the next level's group rows or its data rows.
 *
 * Groups stand in the order their first row has — a sort on a grouped Column stands first in the
 * sort list (`catalogTableStateRowSlices`), so the groups follow it. Values group by exact equality
 * (`catalogTableGroupKey` — the evaluator's grouping): `"A"` · `"a"` are two groups.
 *
 * A collapsed group's rows are not read out: it holds one placeholder child (react-aria counts a
 * row with a child row as expandable — `aria-expanded` and the ← → keys — breakdown §5.4 S2), so
 * a collapsed group costs one record however many rows it holds. The Builder's Canvas asks for
 * none (`CatalogRowGroups.closedChild`) — its closed group is one row.
 */
import { viewAggregateOf } from "../../collections/view/evaluate";
import type { CatalogBoundRow } from "../resolution/resolver";
import {
  CATALOG_GROUP_PLACEHOLDER_SUFFIX,
  CATALOG_GROUP_ROW_COUNT,
  catalogTableGroupKey,
  type CatalogRowGroups,
} from "./tableRowSlices";

/**
 * ADR-315 Phase 5 증분 5g — a server's group rows (breakdown §4.3.2): `rows` are its group query's
 * answer (the top level), an open group's children its answer to that group's rows (`served` —
 * the next level's group rows, or the group's rows as `leaves` binds them). Its count and its
 * aggregates are the server's, at every level — nothing is folded here (mean · median stay right).
 * An open group not answered yet holds one placeholder child, as a closed one does.
 */
export function catalogServedGroupBoundRows(
  rows: readonly unknown[],
  groups: CatalogRowGroups,
  leaves: (rows: readonly unknown[]) => CatalogBoundRow[],
): CatalogBoundRow[] {
  const expanded =
    groups.expanded === "all" ? undefined : new Set(groups.expanded);
  const served = groups.served!;
  const level = (
    answer: readonly unknown[],
    depth: number,
    outer: readonly unknown[],
  ): CatalogBoundRow[] => {
    const column = groups.keys[depth]!;
    return answer.map((item) => {
      const record = (item ?? {}) as Record<string, unknown>;
      const value = record[column] ?? null;
      const path = [...outer, value];
      const key = catalogTableGroupKey(path);
      const open = !expanded || expanded.has(key);
      const values: Record<string, unknown> = {};
      for (const aggregate of groups.aggregates)
        values[aggregate.key] = record[aggregate.key];
      values[column] = value;
      const placeholder = [
        {
          key: `${key}${CATALOG_GROUP_PLACEHOLDER_SUFFIX}`,
          values: {},
          placeholder: true as const,
        },
      ];
      const children = open ? served(path) : undefined;
      const count = Number(record[CATALOG_GROUP_ROW_COUNT]);
      return {
        key,
        values,
        ...(open
          ? {
              children: !children
                ? placeholder
                : depth + 1 < groups.keys.length
                  ? level(children.rows, depth + 1, path)
                  : leaves(children.rows),
            }
          : groups.closedChild === false
            ? {}
            : { children: placeholder }),
        group: {
          column,
          count: Number.isFinite(count) ? count : 0,
          depth,
          expanded: open,
          ...(children?.mismatch !== undefined
            ? { mismatch: children.mismatch }
            : {}),
        },
      };
    });
  };
  return level(rows, 0, []);
}

/** The group rows of `rows` (a grouping without fields gives the rows back). */
export function catalogGroupBoundRows(
  rows: readonly CatalogBoundRow[],
  groups: CatalogRowGroups,
): CatalogBoundRow[] {
  if (!groups.keys.length) return [...rows];
  const expanded =
    groups.expanded === "all" ? undefined : new Set(groups.expanded);
  const level = (
    members: readonly CatalogBoundRow[],
    depth: number,
    outer: readonly unknown[],
  ): CatalogBoundRow[] => {
    const column = groups.keys[depth]!;
    const byValue = new Map<
      string,
      { value: unknown; rows: CatalogBoundRow[] }
    >();
    for (const row of members) {
      const value = row.values[column] ?? null;
      const id = JSON.stringify(value);
      let group = byValue.get(id);
      if (!group) byValue.set(id, (group = { value, rows: [] }));
      group.rows.push(row);
    }
    return [...byValue.values()].map(({ value, rows: leaves }) => {
      const path = [...outer, value];
      const key = catalogTableGroupKey(path);
      const open = !expanded || expanded.has(key);
      const values: Record<string, unknown> = {};
      for (const aggregate of groups.aggregates)
        values[aggregate.key] = viewAggregateOf(
          aggregate.fn,
          () => leaves.map((row) => row.values[aggregate.key]),
          leaves.length,
        );
      values[column] = value;
      const children = !open
        ? groups.closedChild === false
          ? undefined
          : [
              {
                key: `${key}${CATALOG_GROUP_PLACEHOLDER_SUFFIX}`,
                values: {},
                placeholder: true as const,
              },
            ]
        : depth + 1 < groups.keys.length
          ? level(leaves, depth + 1, path)
          : leaves;
      return {
        key,
        values,
        ...(children ? { children } : {}),
        group: { column, count: leaves.length, depth, expanded: open },
      };
    });
  };
  return level(rows, 0, []);
}

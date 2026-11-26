/**
 * ADR-317 Phase 5 — a Table's striped rows (「Striped rows」 — breakdown §5.5): every second data
 * row in the order shown takes the stripe. The order is the data layer's (sorted · filtered ·
 * grouped, before a window · a box height · a page cuts it — never CSS `:nth-child`: a virtual
 * Table's DOM rows are a reused window, a pinned · group row stands elsewhere in the DOM).
 *
 * - a group's rows start again (its first data row is never striped); a tree's child rows go on
 *   counting in the order shown (depth first);
 * - a group row · a placeholder is not counted and draws no stripe; a detail row takes its row's;
 * - a pinned row stands apart (not counted, no stripe — as it stands apart from a merge);
 * - a merged Column's run (ADR-315 Phase 6 — one cell to the eye over several rows) takes its
 *   first row's: a row whose own stripe differs there says so by Column key (`runs`).
 *
 * The rows carry it (`CatalogBoundRow.stripe`), the resolver on each Row record
 * (`CATALOG_ROW_STRIPED_PROP` · `…STRIPE_RUNS…`) and the column projection on its Cells
 * (`CATALOG_CELL_STRIPE_PROP`) — the Canvas (the Row · Cell rule's `striped` · `stripe` blocks) and
 * the DOM (`data-striped` · `data-stripe` → the Table rule) read those.
 */
import type { CatalogBoundRow } from "../resolution/resolver";

/** A striped Table's data Row record: `true` = shaded, `false` = not (a bound row — counted). */
export const CATALOG_ROW_STRIPED_PROP = "_striped";
/** Its Column keys whose merged run's stripe is not its own: key → the run's (`true` = shaded). */
export const CATALOG_ROW_STRIPE_RUNS_PROP = "_stripeRuns";
/** Such a row's Cell: `on` · `off` — its run's stripe over the row's. */
export const CATALOG_CELL_STRIPE_PROP = "_cellStripe";

const STRIPED = new WeakMap<object, readonly CatalogBoundRow[]>();

/** A row the stripes count: a data row (not a group's, a detail, a placeholder, a pinned one). */
const counted = (row: CatalogBoundRow): boolean =>
  !row.placeholder && !row.group && !row.detail && !row.pinned;

/**
 * `rows` with each data row's stripe (`CatalogBoundRow.stripe`). The list's meta (counts · totals ·
 * sort · window) stays.
 */
export function catalogStripedRows(
  rows: readonly CatalogBoundRow[],
): readonly CatalogBoundRow[] {
  const held = STRIPED.get(rows);
  if (held) return held;
  const visit = (
    list: readonly CatalogBoundRow[],
    counter: { n: number },
    parentOn: boolean | undefined,
  ): CatalogBoundRow[] => {
    /** The previous data row of this list — its merged runs' stripe by Column key. */
    let before:
      | { readonly row: CatalogBoundRow; readonly run: Map<string, boolean> }
      | undefined;
    return list.map((row) => {
      if (row.placeholder) return row;
      if (row.detail) {
        // (A detail row is its row's: drawn with its stripe.)
        const children = row.children
          ? visit(row.children, counter, parentOn)
          : undefined;
        return parentOn === undefined && !children
          ? row
          : {
              ...row,
              ...(children ? { children } : {}),
              ...(parentOn !== undefined ? { stripe: { on: parentOn } } : {}),
            };
      }
      if (row.group) {
        before = undefined;
        const children = row.children
          ? visit(row.children, { n: 0 }, undefined)
          : undefined;
        return children ? { ...row, children } : row;
      }
      if (!counted(row)) {
        const children = row.children
          ? visit(row.children, counter, undefined)
          : undefined;
        return children ? { ...row, children } : row;
      }
      counter.n += 1;
      const on = counter.n % 2 === 0;
      // (A merged Column's run: the stripe of its first row — the row above's run, else its own.)
      const run = new Map<string, boolean>();
      const runs: Record<string, boolean> = {};
      for (const key of row.merge?.up ?? []) {
        const first = before
          ? (before.run.get(key) ?? before.row.stripe!.on)
          : on;
        run.set(key, first);
        if (first !== on) runs[key] = first;
      }
      const stripe: NonNullable<CatalogBoundRow["stripe"]> = Object.keys(runs)
        .length
        ? { on, runs }
        : { on };
      const marked: CatalogBoundRow = { ...row, stripe };
      before = { row: marked, run };
      const children = row.children
        ? visit(row.children, counter, on)
        : undefined;
      // (A row with rows open under it ends its merge run — `catalogMergedRows`.)
      if (children?.some((child) => !child.placeholder)) before = undefined;
      return children ? { ...marked, children } : marked;
    });
  };
  const out = visit(rows, { n: 0 }, undefined);
  for (const key of Object.keys(rows))
    if (!/^\d+$/.test(key))
      (out as unknown as Record<string, unknown>)[key] = (
        rows as unknown as Record<string, unknown>
      )[key];
  STRIPED.set(rows, out);
  return out;
}

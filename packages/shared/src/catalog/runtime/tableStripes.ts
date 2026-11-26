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
import { catalogRowListMeta } from "./dataBinding";
import { catalogDataRow, catalogRowOpened } from "./tableCellMerge";

/** A striped Table's data Row record: `true` = shaded, `false` = not (a bound row — counted). */
export const CATALOG_ROW_STRIPED_PROP = "_striped";
/** Its Column keys whose merged run's stripe is not its own (the run's = the opposite). */
export const CATALOG_ROW_STRIPE_RUNS_PROP = "_stripeRuns";
/** Such a row's Cell: `on` · `off` — its run's stripe over the row's. */
export const CATALOG_CELL_STRIPE_PROP = "_cellStripe";

/** A Cell record's run stripe (`CATALOG_CELL_STRIPE_PROP`), if it has one. */
export function catalogCellStripe(
  props: Readonly<Record<string, unknown>>,
): "on" | "off" | undefined {
  const stripe = props[CATALOG_CELL_STRIPE_PROP];
  return stripe === "on" || stripe === "off" ? stripe : undefined;
}

type RowStripe = NonNullable<CatalogBoundRow["stripe"]>;

/** A row's stripe in the Column `key`: its merged run's (`runs` — the opposite), else its own. */
const stripeIn = (stripe: RowStripe, key: string): boolean =>
  stripe.runs?.includes(key) ? !stripe.on : stripe.on;

const STRIPED = new WeakMap<object, readonly CatalogBoundRow[]>();

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
    /** The previous data row's stripe in this list — its merged runs go on from it. */
    let above: RowStripe | undefined;
    const under = (
      row: CatalogBoundRow,
      rowCounter: { n: number },
      on: boolean | undefined,
    ): CatalogBoundRow[] | undefined =>
      row.children ? visit(row.children, rowCounter, on) : undefined;
    return list.map((row) => {
      if (row.placeholder) return row;
      if (row.detail) {
        // (A detail row is its row's: drawn with its stripe.)
        const children = under(row, counter, parentOn);
        return parentOn === undefined && !children
          ? row
          : {
              ...row,
              ...(children ? { children } : {}),
              ...(parentOn !== undefined ? { stripe: { on: parentOn } } : {}),
            };
      }
      if (row.group) above = undefined;
      if (!catalogDataRow(row)) {
        // (A group's rows start again; a pinned row's go on uncounted.)
        const children = under(row, row.group ? { n: 0 } : counter, undefined);
        return children ? { ...row, children } : row;
      }
      counter.n += 1;
      const on = counter.n % 2 === 0;
      // (A merged Column's run: the stripe of its first row — the row above's run, else its own.)
      const from = above;
      const runs =
        from && row.merge?.up
          ? row.merge.up.filter((key) => stripeIn(from, key) !== on)
          : undefined;
      const stripe: RowStripe = runs?.length ? { on, runs } : { on };
      above = stripe;
      const children = under(row, counter, on);
      // (A row with rows open under it ends its merge run — `catalogMergedRows`.)
      if (catalogRowOpened(row)) above = undefined;
      return { ...row, stripe, ...(children ? { children } : {}) };
    });
  };
  const out = Object.assign(
    visit(rows, { n: 0 }, undefined),
    catalogRowListMeta(rows),
  );
  STRIPED.set(rows, out);
  return out;
}

import type {
  ViewCondition,
  ViewConditionGroup,
} from "../../../../../../packages/shared/src/catalog/document/types";

/**
 * ADR-320 Decision 1 — a Table Column's filter as the state holds it: the filter tree's root
 * condition of that Column (`table-filter:<Column key>` on the Column's field). The fixtures' field
 * ids are `f-<key>` and a Column's key is its field's.
 */
export interface ColumnFilterEntry {
  readonly column: string;
  readonly condition: Pick<
    ViewCondition,
    "op" | "value" | "sensitivity" | "unit"
  >;
}
export const columnCondition = ({
  column,
  condition,
}: ColumnFilterEntry): ViewCondition => ({
  id: `table-filter:${column}`,
  fields: [[`data:field:f-${column}`]],
  ...condition,
});
/** The filter tree of these Columns' filters, in order. */
export const columnFilters = (
  ...entries: readonly ColumnFilterEntry[]
): ViewConditionGroup => ({
  id: "filter-scope",
  op: "and",
  items: entries.map(columnCondition),
});

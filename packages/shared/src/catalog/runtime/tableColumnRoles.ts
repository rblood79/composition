/**
 * A Table header's Columns by role — one rule for the DOM (`isRowHeader` of each RAC Column) and
 * the session's Table state (ADR-315 — which Columns a state names, which one never hides).
 *
 * - A **selection** column holds `Checkbox[slot=selection]`: it names no row and is not a data
 *   column (a Table state does not sort · hide · order · pin it).
 * - The **row header** column: the ones the author set (`isRowHeader`), else the first data column
 *   the author did not turn off — RAC throws on a Table without one (ADR-256 Phase 5i).
 */
export interface CatalogTableColumnRole {
  /** Holds the selection Checkbox — not a data column. */
  readonly selection: boolean;
  /** RAC `isRowHeader` as the DOM gives it. */
  readonly rowHeader: boolean;
}

export function catalogTableColumnRoles<
  T extends {
    readonly id: string;
    readonly props: Readonly<Record<string, unknown>>;
    readonly children: readonly string[];
  },
>(
  /** The header's Column records, in order. */
  columns: readonly T[],
  /** Whether a Column's child is the selection Checkbox (`Checkbox[slot=selection]`). */
  isSelectionBox: (childId: string) => boolean,
): CatalogTableColumnRole[] {
  const selection = columns.map((column) =>
    column.children.some(isSelectionBox),
  );
  const authored = columns.some((column) => column.props.isRowHeader === true);
  const named = columns.filter((_, index) => !selection[index]);
  const first = authored
    ? undefined
    : (named.find((column) => column.props.isRowHeader !== false) ??
      named[0] ??
      columns[0]);
  return columns.map((column, index) => ({
    selection: selection[index]!,
    rowHeader: authored
      ? column.props.isRowHeader === true
      : first?.id === column.id,
  }));
}

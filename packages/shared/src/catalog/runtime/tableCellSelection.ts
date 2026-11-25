/**
 * ADR-315 Phase 6 — a Table's cell ranges (breakdown §5.6 — the D1 exception, its whole list): a
 * Table 「Cell selection」 lets its viewers select ranges of body cells and copy them. Read only by
 * a Table that has it (a lazy chunk — `CatalogTable` imports it).
 *
 * What it handles itself (and nothing else):
 * - the cells' `aria-selected` (`data-selected` for the sheet's look) and the grid's
 *   `aria-multiselectable` (the APG grid pattern);
 * - keys: Shift + arrow keys extend (RAC moves the focus — the range follows it), Ctrl / Cmd + A
 *   selects every cell, Ctrl / Cmd + C copies (the browser's `copy` — tab-separated text), Esc
 *   clears;
 * - pointer: a drag selects a range, Shift + click extends it, Ctrl / Cmd + click adds a range.
 * What it leaves to RAC: the cells' focus and its moves, the rows' · cells' DOM, sorting, resizing.
 *
 * A range is two points — a row key and a Column key each — so a virtual Table's range reaches rows
 * outside its window (their membership is by their place in the rows shown); the copy reads the
 * rows' data, not the cells drawn (`CatalogCellSelectionSource.text`).
 */

/** A cell: its row's key (RAC's `data-key`) and its Column's key. */
export interface CatalogCellPoint {
  readonly row: string;
  readonly column: string;
}
/** A range: from where it started to where it reaches (either way). */
export interface CatalogCellRange {
  readonly anchor: CatalogCellPoint;
  readonly focus: CatalogCellPoint;
}
/** What the Table gives its selection, read when it is used (the rows' order changes). */
export interface CatalogCellSelectionSource {
  /** Every row key in the order shown, every Column key in the order drawn. */
  order(): { rows: readonly string[]; columns: readonly string[] };
  /** The rows by the Columns as tab-separated text (the rows' data). */
  text(rows: readonly string[], columns: readonly string[]): string;
}
export interface CatalogCellSelection {
  ranges(): readonly CatalogCellRange[];
  has(row: string, column: string): boolean;
  /** A drawn cell (its Column's key): its `aria-selected` follows the ranges until undone. */
  mark(element: HTMLElement, column: string): () => void;
  detach(): void;
}

const CELL =
  '[role="gridcell"][data-column-key], [role="rowheader"][data-column-key]';

export function attachCatalogCellSelection(
  table: HTMLElement,
  source: { readonly current: CatalogCellSelectionSource | undefined },
): CatalogCellSelection {
  let ranges: readonly CatalogCellRange[] = [];
  const marked = new Map<HTMLElement, string>();
  /**
   * The rows' · Columns' places now (the order may have changed since the ranges were made). Read
   * again only for another order — a new row key list (a virtual Table holds its list while its
   * rows are the same) or other Columns: every cell drawn under a range is marked, and a Map of
   * every row key per cell cost 1,569 of 9,562 ms of a 10,000-row scroll (2026-11-25).
   */
  let held:
    | {
        order: ReturnType<CatalogCellSelectionSource["order"]>;
        row: Map<string, number>;
        column: Map<string, number>;
      }
    | undefined;
  const places = () => {
    const order = source.current?.order() ?? { rows: [], columns: [] };
    if (
      held?.order.rows === order.rows &&
      held.order.columns.length === order.columns.length &&
      held.order.columns.every((key, index) => key === order.columns[index])
    )
      return held;
    return (held = {
      order,
      row: new Map(order.rows.map((key, index) => [key, index])),
      column: new Map(order.columns.map((key, index) => [key, index])),
    });
  };
  const inside = (
    at: ReturnType<typeof places>,
    row: string,
    column: string,
  ): boolean => {
    const r = at.row.get(row);
    const c = at.column.get(column);
    if (r === undefined || c === undefined) return false;
    return ranges.some(({ anchor, focus }) => {
      const r0 = at.row.get(anchor.row);
      const r1 = at.row.get(focus.row);
      const c0 = at.column.get(anchor.column);
      const c1 = at.column.get(focus.column);
      return (
        r0 !== undefined &&
        r1 !== undefined &&
        c0 !== undefined &&
        c1 !== undefined &&
        r >= Math.min(r0, r1) &&
        r <= Math.max(r0, r1) &&
        c >= Math.min(c0, c1) &&
        c <= Math.max(c0, c1)
      );
    });
  };
  const rowOf = (element: HTMLElement) =>
    element.closest('[role="row"]')?.getAttribute("data-key") ?? undefined;
  const paint = (
    element: HTMLElement,
    column: string,
    at: ReturnType<typeof places> | undefined,
  ) => {
    const row = rowOf(element);
    const on = !!at && row !== undefined && inside(at, row, column);
    element.setAttribute("aria-selected", on ? "true" : "false");
    if (on) element.setAttribute("data-selected", "");
    else element.removeAttribute("data-selected");
  };
  const repaint = () => {
    const at = ranges.length ? places() : undefined;
    for (const [element, column] of marked) paint(element, column, at);
  };
  const set = (next: readonly CatalogCellRange[]) => {
    ranges = next;
    repaint();
  };
  // (The rows move under a range — a sort, a filter, a window: the DOM's rows change, the cells
  //  drawn before stay. Their membership is read again once the DOM has settled.)
  let pending = false;
  const observer =
    typeof MutationObserver === "function"
      ? new MutationObserver(() => {
          if (pending || !ranges.length) return;
          pending = true;
          queueMicrotask(() => {
            pending = false;
            repaint();
          });
        })
      : undefined;
  observer?.observe(table, { childList: true, subtree: true });
  const pointAt = (target: EventTarget | null) => {
    const cell = (target as Element | null)?.closest?.(CELL) as
      HTMLElement | null | undefined;
    if (!cell || !table.contains(cell)) return undefined;
    const row = rowOf(cell);
    const column = cell.getAttribute("data-column-key");
    return row !== undefined && column
      ? { point: { row, column }, cell }
      : undefined;
  };
  const extend = (to: CatalogCellPoint) =>
    set(
      ranges.length
        ? [...ranges.slice(0, -1), { anchor: ranges.at(-1)!.anchor, focus: to }]
        : [{ anchor: to, focus: to }],
    );
  let dragging = false;
  const onPointerDown = (event: PointerEvent) => {
    const hit = pointAt(event.target);
    if (!hit || event.button !== 0) return;
    if (event.shiftKey) extend(hit.point);
    else if (event.metaKey || event.ctrlKey)
      set([...ranges, { anchor: hit.point, focus: hit.point }]);
    else set([{ anchor: hit.point, focus: hit.point }]);
    dragging = true;
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!dragging) return;
    const hit = pointAt(
      typeof document.elementFromPoint === "function"
        ? document.elementFromPoint(event.clientX, event.clientY)
        : event.target,
    );
    if (!hit) return;
    const last = ranges.at(-1)?.focus;
    if (last?.row !== hit.point.row || last.column !== hit.point.column)
      extend(hit.point);
  };
  const onPointerUp = () => {
    dragging = false;
  };
  // Keys: the focus moves are RAC's. An arrow key with Shift held extends the range to the cell the
  // focus moves to; without Shift, that cell alone.
  let arrow: { shift: boolean } | undefined;
  const onKeyDown = (event: KeyboardEvent) => {
    arrow = event.key.startsWith("Arrow")
      ? { shift: event.shiftKey }
      : undefined;
    if (event.key === "Escape" && ranges.length) {
      set([]);
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
      const { rows, columns } = source.current?.order() ?? {
        rows: [],
        columns: [],
      };
      if (!rows.length || !columns.length) return;
      event.preventDefault();
      event.stopPropagation();
      set([
        {
          anchor: { row: rows[0]!, column: columns[0]! },
          focus: { row: rows.at(-1)!, column: columns.at(-1)! },
        },
      ]);
    }
  };
  const onFocusIn = (event: FocusEvent) => {
    const hit = pointAt(event.target);
    const moved = arrow;
    arrow = undefined;
    if (!hit || hit.cell !== event.target || !moved) return;
    if (moved.shift) extend(hit.point);
    else set([{ anchor: hit.point, focus: hit.point }]);
  };
  // Ctrl / Cmd + C: the browser's copy, of the last range — its rows by its Columns.
  const onCopy = (event: ClipboardEvent) => {
    const range = ranges.at(-1);
    if (!range || !event.clipboardData) return;
    const { order, row, column } = places();
    const r = [row.get(range.anchor.row), row.get(range.focus.row)];
    const c = [column.get(range.anchor.column), column.get(range.focus.column)];
    if (r.includes(undefined) || c.includes(undefined)) return;
    const rows = order.rows.slice(
      Math.min(r[0]!, r[1]!),
      Math.max(r[0]!, r[1]!) + 1,
    );
    const columns = order.columns.slice(
      Math.min(c[0]!, c[1]!),
      Math.max(c[0]!, c[1]!) + 1,
    );
    event.clipboardData.setData(
      "text/plain",
      source.current?.text(rows, columns) ?? "",
    );
    event.preventDefault();
  };
  table.setAttribute("aria-multiselectable", "true");
  table.setAttribute("data-cell-selection", "");
  table.addEventListener("pointerdown", onPointerDown, true);
  table.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
  table.addEventListener("keydown", onKeyDown, true);
  table.addEventListener("focusin", onFocusIn, true);
  table.addEventListener("copy", onCopy);
  return {
    ranges: () => ranges,
    has: (row, column) => inside(places(), row, column),
    mark(element, column) {
      marked.set(element, column);
      paint(element, column, ranges.length ? places() : undefined);
      return () => {
        if (marked.get(element) === column) marked.delete(element);
      };
    },
    detach() {
      observer?.disconnect();
      table.removeAttribute("aria-multiselectable");
      table.removeAttribute("data-cell-selection");
      table.removeEventListener("pointerdown", onPointerDown, true);
      table.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      table.removeEventListener("keydown", onKeyDown, true);
      table.removeEventListener("focusin", onFocusIn, true);
      table.removeEventListener("copy", onCopy);
      for (const element of marked.keys()) {
        element.removeAttribute("aria-selected");
        element.removeAttribute("data-selected");
      }
      marked.clear();
    },
  };
}

import { splitTabText } from "../../collections/intake/tabText";

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
 *
 * ADR-317 Phase 2 — a Table that writes (its 「Paste」 — `CatalogCellSelectionSource.write`) also
 * handles (breakdown §4, the widened list):
 * - the browser's `paste` (Ctrl / Cmd + V — its `text/plain`, tab-separated: from the last range's
 *   top-left cell, the rows shown by the Columns drawn; one value fills the whole range; what runs
 *   past the Table's end is dropped and counted — 사용자 결정 4), `cut` (Ctrl / Cmd + X — the copy,
 *   then the range emptied) and Delete · Backspace (the ranges emptied — 사용자 결정 3);
 * - `beforecopy` · `beforecut` · `beforepaste` on the document while the focus is in the Table —
 *   kept from their default, which turns Safari's Edit menu (and its keys) on (react-aria
 *   `useClipboard`).
 * The writes go to the data (`write` — the session's several-cell write); a cell the Table does not
 * let be written is counted, never written. The focus stays RAC's.
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
  /**
   * ADR-317 — the Table's 「Paste」: cells written to its data at once (absent = the Table writes
   * nothing). `outside` = the cells that ran past the Table's end (not written).
   */
  write?(cells: readonly CatalogCellWrite[]): {
    readonly written: readonly unknown[];
    readonly skipped: Readonly<Record<string, number | undefined>>;
  };
  /** ADR-317 — the Table's status region (`role="status"`): a write's result, said once. */
  announce?(text: string): void;
  /** The site's language (the status text's). */
  readonly locale?: string;
}
/** ADR-317 — a cell's new value (text — read by its field's type where it is written). */
export interface CatalogCellWrite {
  readonly row: string;
  readonly column: string;
  readonly value: string;
}
export type CatalogCellWriteAction = "paste" | "cut" | "clear";

/** ADR-317 — a write's status text (S2 intl's languages; English otherwise). */
const WRITE_STRINGS: Readonly<
  Record<
    string,
    Record<CatalogCellWriteAction, (n: number) => string> & {
      skipped: (n: number) => string;
    }
  >
> = {
  en: {
    paste: (n) => `Pasted into ${n} ${n === 1 ? "cell" : "cells"}`,
    cut: (n) => `Cut ${n} ${n === 1 ? "cell" : "cells"}`,
    clear: (n) => `Cleared ${n} ${n === 1 ? "cell" : "cells"}`,
    skipped: (n) => `${n} skipped`,
  },
  ko: {
    paste: (n) => `칸 ${n}개에 붙여넣음`,
    cut: (n) => `칸 ${n}개 잘라냄`,
    clear: (n) => `칸 ${n}개 비움`,
    skipped: (n) => `${n}개 건너뜀`,
  },
  ja: {
    paste: (n) => `${n} 個のセルに貼り付けました`,
    cut: (n) => `${n} 個のセルを切り取りました`,
    clear: (n) => `${n} 個のセルをクリアしました`,
    skipped: (n) => `${n} 個をスキップ`,
  },
  zh: {
    paste: (n) => `已粘贴到 ${n} 个单元格`,
    cut: (n) => `已剪切 ${n} 个单元格`,
    clear: (n) => `已清除 ${n} 个单元格`,
    skipped: (n) => `已跳过 ${n} 个`,
  },
};

/** ADR-317 — 「칸 12개에 붙여넣음 · 3개 건너뜀」: the cells written, and the rest (each reason). */
export function catalogCellWriteStatus(
  action: CatalogCellWriteAction,
  written: number,
  skipped: number,
  locale = "en",
): string {
  const strings =
    WRITE_STRINGS[locale.split("-")[0] ?? "en"] ?? WRITE_STRINGS.en!;
  return skipped
    ? `${strings[action](written)} · ${strings.skipped(skipped)}`
    : strings[action](written);
}
export interface CatalogCellSelection {
  ranges(): readonly CatalogCellRange[];
  has(row: string, column: string): boolean;
  /** A drawn cell (its Column's key): its `aria-selected` follows the ranges until undone. */
  mark(element: HTMLElement, column: string): () => void;
  detach(): void;
}

const BEFORE_CLIPBOARD = ["beforecopy", "beforecut", "beforepaste"] as const;

const CELL =
  '[role="gridcell"][data-column-key], [role="rowheader"][data-column-key]';

/** A text entry (an input · a text area · an editable element) — its keys and clipboard are its own. */
const typing = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  return (
    !!element &&
    (element.tagName === "INPUT" ||
      element.tagName === "TEXTAREA" ||
      element.isContentEditable === true)
  );
};

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
  /** ADR-317 — cells written through the Table, the result said in its status region. */
  const write = (
    cells: readonly CatalogCellWrite[],
    action: CatalogCellWriteAction,
    outside: number,
  ) => {
    const at = source.current;
    if (!at?.write) return;
    const result = cells.length
      ? at.write(cells)
      : { written: [], skipped: {} };
    const skipped =
      outside +
      Object.values(result.skipped).reduce<number>(
        (sum, count) => sum + (count ?? 0),
        0,
      );
    at.announce?.(
      catalogCellWriteStatus(action, result.written.length, skipped, at.locale),
    );
  };
  /** A range's rows (keys, in order) and Columns (keys, in order) — undefined if one end is gone. */
  const spanOf = (at: ReturnType<typeof places>, range: CatalogCellRange) => {
    const r = [at.row.get(range.anchor.row), at.row.get(range.focus.row)];
    const c = [
      at.column.get(range.anchor.column),
      at.column.get(range.focus.column),
    ];
    if (r.includes(undefined) || c.includes(undefined)) return undefined;
    return {
      rows: at.order.rows.slice(
        Math.min(r[0]!, r[1]!),
        Math.max(r[0]!, r[1]!) + 1,
      ),
      columns: at.order.columns.slice(
        Math.min(c[0]!, c[1]!),
        Math.max(c[0]!, c[1]!) + 1,
      ),
    };
  };
  /** A range's cells — (row key, Column key), row by row. */
  const cellsOf = (
    at: ReturnType<typeof places>,
    range: CatalogCellRange,
  ): [string, string][] => {
    const span = spanOf(at, range);
    return span
      ? span.rows.flatMap((row) =>
          span.columns.map((column): [string, string] => [row, column]),
        )
      : [];
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
    // ADR-317 사용자 결정 3 — Delete · Backspace empty the ranges' cells (a cell's own controls —
    // an input — keep their keys).
    if (
      (event.key === "Delete" || event.key === "Backspace") &&
      ranges.length &&
      source.current?.write &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !typing(event.target)
    ) {
      event.preventDefault();
      const at = places();
      const cells: CatalogCellWrite[] = [];
      const seen = new Set<string>();
      for (const range of ranges)
        for (const [row, column] of cellsOf(at, range)) {
          const id = `${row}\u0000${column}`;
          if (seen.has(id)) continue;
          seen.add(id);
          cells.push({ row, column, value: "" });
        }
      write(cells, "clear", 0);
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
    const span = spanOf(places(), range);
    if (!span) return;
    event.clipboardData.setData(
      "text/plain",
      source.current?.text(span.rows, span.columns) ?? "",
    );
    event.preventDefault();
  };
  // ADR-317 사용자 결정 3 — Ctrl / Cmd + X: the copy, then the last range emptied.
  const onCut = (event: ClipboardEvent) => {
    const range = ranges.at(-1);
    if (!range || !source.current?.write || !event.clipboardData) return;
    onCopy(event);
    write(
      cellsOf(places(), range).map(([row, column]) => ({
        row,
        column,
        value: "",
      })),
      "cut",
      0,
    );
  };
  // ADR-317 Decision 3 — Ctrl / Cmd + V: the browser's paste (its `text/plain` — no permission
  // prompt, HC8), from the last range's top-left cell (else the focused cell).
  const onPaste = (event: ClipboardEvent) => {
    const text = event.clipboardData?.getData("text/plain");
    if (!source.current?.write || text === undefined) return;
    const focused = pointAt(document.activeElement)?.point;
    const range =
      ranges.at(-1) ??
      (focused ? { anchor: focused, focus: focused } : undefined);
    if (!range) return;
    const at = places();
    const r = [at.row.get(range.anchor.row), at.row.get(range.focus.row)];
    const c = [
      at.column.get(range.anchor.column),
      at.column.get(range.focus.column),
    ];
    if (r.includes(undefined) || c.includes(undefined)) return;
    event.preventDefault();
    const r0 = Math.min(r[0]!, r[1]!);
    const c0 = Math.min(c[0]!, c[1]!);
    const grid = splitTabText(text);
    const cells: CatalogCellWrite[] = [];
    let outside = 0;
    // (One value fills the whole range.)
    if (grid.length === 1 && grid[0]!.length === 1) {
      const value = grid[0]![0]!;
      for (const [row, column] of cellsOf(at, range))
        cells.push({ row, column, value });
    } else
      grid.forEach((line, dr) =>
        line.forEach((value, dc) => {
          const row = at.order.rows[r0 + dr];
          const column = at.order.columns[c0 + dc];
          if (row === undefined || column === undefined) outside++;
          else cells.push({ row, column, value });
        }),
      );
    if (!cells.length && !outside) return;
    // (The range becomes what was written.)
    if (cells.length) {
      const last = cells.reduce(
        (end, cell) => ({
          r: Math.max(end.r, at.row.get(cell.row)!),
          c: Math.max(end.c, at.column.get(cell.column)!),
        }),
        { r: r0, c: c0 },
      );
      set([
        {
          anchor: { row: at.order.rows[r0]!, column: at.order.columns[c0]! },
          focus: {
            row: at.order.rows[last.r]!,
            column: at.order.columns[last.c]!,
          },
        },
      ]);
    }
    write(cells, "paste", outside);
  };
  // (Safari enables its Edit menu's copy · cut · paste — and their keys — for a focused element
  //  only when these are kept from their default: react-aria `useClipboard`.)
  const onBefore = (event: Event) => {
    if (
      !table.contains(document.activeElement) ||
      typing(document.activeElement)
    )
      return;
    if (event.type === "beforecopy" ? ranges.length : source.current?.write)
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
  table.addEventListener("cut", onCut);
  table.addEventListener("paste", onPaste);
  for (const type of BEFORE_CLIPBOARD)
    document.addEventListener(type, onBefore);
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
      table.removeEventListener("cut", onCut);
      table.removeEventListener("paste", onPaste);
      for (const type of BEFORE_CLIPBOARD)
        document.removeEventListener(type, onBefore);
      for (const element of marked.keys()) {
        element.removeAttribute("aria-selected");
        element.removeAttribute("data-selected");
      }
      marked.clear();
    },
  };
}

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
   * ADR-317 — cells written to the Table's data at once (absent = the Table writes nothing): its
   * 「Paste」 (`pastes` — paste · cut · Delete) and its 「Fill handle」 (`fills` — the handle and
   * Ctrl / Cmd + D).
   */
  write?(cells: readonly CatalogCellWrite[]): {
    readonly written: readonly unknown[];
    readonly skipped: Readonly<Record<string, number | undefined>>;
  };
  /** ADR-317 — the Table's status region (`role="status"`): a write's result, said once. */
  announce?(text: string): void;
  /** The site's language (the status text's). */
  readonly locale?: string;
  /** ADR-317 Phase 2 — 「Paste」 on. */
  readonly pastes?: boolean;
  /** ADR-317 Phase 3 — 「Fill handle」 on. */
  readonly fills?: boolean;
  /** ADR-317 Phase 3 — the rows' values by the Columns (the data — what a fill copies). */
  values?(
    rows: readonly string[],
    columns: readonly string[],
  ): readonly (readonly unknown[])[];
}
/**
 * ADR-317 — a cell's new value: a paste's text (read by its field's type where it is written) or a
 * fill's copied value (kept as it is — another type's value is not written).
 */
export interface CatalogCellWrite {
  readonly row: string;
  readonly column: string;
  readonly value: unknown;
}
export type CatalogCellWriteAction = "paste" | "cut" | "clear" | "fill";

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
    fill: (n) => `Filled ${n} ${n === 1 ? "cell" : "cells"}`,
    skipped: (n) => `${n} skipped`,
  },
  ko: {
    paste: (n) => `칸 ${n}개에 붙여넣음`,
    cut: (n) => `칸 ${n}개 잘라냄`,
    clear: (n) => `칸 ${n}개 비움`,
    fill: (n) => `칸 ${n}개 채움`,
    skipped: (n) => `${n}개 건너뜀`,
  },
  ja: {
    paste: (n) => `${n} 個のセルに貼り付けました`,
    cut: (n) => `${n} 個のセルを切り取りました`,
    clear: (n) => `${n} 個のセルをクリアしました`,
    fill: (n) => `${n} 個のセルを埋めました`,
    skipped: (n) => `${n} 個をスキップ`,
  },
  zh: {
    paste: (n) => `已粘贴到 ${n} 个单元格`,
    cut: (n) => `已剪切 ${n} 个单元格`,
    clear: (n) => `已清除 ${n} 个单元格`,
    fill: (n) => `已填充 ${n} 个单元格`,
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
  // ADR-317 Phase 3 — the fill handle: one element of ours in the last range's bottom-right cell
  // (breakdown §4 — `aria-hidden`: Ctrl / Cmd + D does the same by keys).
  const handle = document.createElement("span");
  handle.setAttribute("aria-hidden", "true");
  handle.setAttribute("data-fill-handle", "");
  handle.className = "table-fill-handle";
  /** The last range's bottom-right cell (rows shown · Columns drawn) — a Table that fills. */
  const cornerOf = (at: ReturnType<typeof places>) => {
    const range = ranges.at(-1);
    if (!range || !source.current?.fills) return undefined;
    const r = Math.max(
      at.row.get(range.anchor.row) ?? -1,
      at.row.get(range.focus.row) ?? -1,
    );
    const c = Math.max(
      at.column.get(range.anchor.column) ?? -1,
      at.column.get(range.focus.column) ?? -1,
    );
    if (r < 0 || c < 0) return undefined;
    return { row: at.order.rows[r]!, column: at.order.columns[c]! };
  };
  /** A drag of the fill handle: the range it started from (places) and where it reaches. */
  let fill:
    | {
        r0: number;
        r1: number;
        c0: number;
        c1: number;
        /** The axis — the one the pointer left the range along first. */
        axis?: "rows" | "columns";
        to: number;
        x: number;
        y: number;
        frame: number;
      }
    | undefined;
  /** Whether a cell is in the fill's reach (outside the range, along its axis). */
  const fillReaches = (
    at: ReturnType<typeof places>,
    row: string,
    column: string,
  ): boolean => {
    if (!fill?.axis) return false;
    const r = at.row.get(row);
    const c = at.column.get(column);
    if (r === undefined || c === undefined) return false;
    const { r0, r1, c0, c1, to } = fill;
    return fill.axis === "rows"
      ? c >= c0 && c <= c1 && (to > r1 ? r > r1 && r <= to : r < r0 && r >= to)
      : r >= r0 && r <= r1 && (to > c1 ? c > c1 && c <= to : c < c0 && c >= to);
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
    // ADR-317 Phase 3 — the fill handle's cell and, while it is dragged, the cells it reaches.
    const corner = at && cornerOf(at);
    const isCorner = !!corner && corner.row === row && corner.column === column;
    if (isCorner) {
      element.setAttribute("data-fill-corner", "");
      if (handle.parentElement !== element) element.appendChild(handle);
    } else element.removeAttribute("data-fill-corner");
    const target =
      !!fill && !!at && row !== undefined && fillReaches(at, row, column);
    if (target) element.setAttribute("data-fill-target", "");
    else element.removeAttribute("data-fill-target");
  };
  const repaint = () => {
    const at = ranges.length ? places() : undefined;
    for (const [element, column] of marked) paint(element, column, at);
    // (The corner cell is not drawn — a virtual Table's window: no handle.)
    const corner = at && cornerOf(at);
    const holder = handle.parentElement;
    if (
      holder &&
      (!corner ||
        !holder.hasAttribute("data-fill-corner") ||
        !marked.has(holder))
    )
      handle.remove();
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
    if (
      event.button === 0 &&
      (event.target as Element | null)?.closest?.("[data-fill-handle]")
    ) {
      // (The handle's drag is not a range's — the range stays.)
      event.preventDefault();
      event.stopPropagation();
      startFill(event);
      return;
    }
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
    // (ADR-317 Phase 3 — while RAC scrolls a virtual Table its content takes no pointer, so the
    //  point finds no cell: the rows' boxes say where it is, as the fill handle's drag reads them.)
    let point = hit?.point;
    if (!point && typeof document.elementFromPoint === "function") {
      const place = placeAt(event.clientX, event.clientY);
      const at = places();
      if (place.row !== undefined && place.column !== undefined)
        point = {
          row: at.order.rows[place.row]!,
          column: at.order.columns[place.column]!,
        };
    }
    if (!point) return;
    const last = ranges.at(-1)?.focus;
    if (last?.row !== point.row || last.column !== point.column) extend(point);
  };
  const onPointerUp = () => {
    dragging = false;
  };
  // ADR-317 Phase 3 — the fill handle's drag. The pointer is read against the rows drawn (their
  // boxes — RAC turns the content's pointer events off while it scrolls, so `elementFromPoint`
  // finds no row then: breakdown §9 Phase 0 (1)); the listeners are the document's (the handle's
  // cell may leave a virtual Table's window). Near the Table's edge it scrolls.
  /** The row (shown place) and Column (drawn place) under a point — clamped into the Table. */
  const placeAt = (x: number, y: number) => {
    const at = places();
    const box = table.getBoundingClientRect();
    const head = table
      .querySelector('[role="rowgroup"]')
      ?.getBoundingClientRect();
    const top = head && head.bottom > box.top ? head.bottom : box.top;
    const cy = Math.min(Math.max(y, top + 1), box.bottom - 1);
    const cx = Math.min(Math.max(x, box.left + 1), box.right - 1);
    let row: number | undefined;
    let column: number | undefined;
    for (const element of table.querySelectorAll<HTMLElement>(
      '[role="row"][data-key]',
    )) {
      const frame = (
        element.parentElement?.getAttribute("role") === "presentation"
          ? element.parentElement
          : element
      ).getBoundingClientRect();
      if (cy < frame.top || cy >= frame.bottom) continue;
      const index = at.row.get(element.getAttribute("data-key") ?? "");
      if (index === undefined) continue;
      row = index;
      for (const cell of element.querySelectorAll<HTMLElement>(
        "[data-column-key]",
      )) {
        const rect = cell.getBoundingClientRect();
        if (cx >= rect.left && cx < rect.right)
          column = at.column.get(cell.getAttribute("data-column-key") ?? "");
      }
      break;
    }
    return { row, column };
  };
  const startFill = (event: PointerEvent) => {
    const range = ranges.at(-1);
    if (!range || !source.current?.fills) return;
    const at = places();
    const r = [at.row.get(range.anchor.row), at.row.get(range.focus.row)];
    const c = [
      at.column.get(range.anchor.column),
      at.column.get(range.focus.column),
    ];
    if (r.includes(undefined) || c.includes(undefined)) return;
    fill = {
      r0: Math.min(r[0]!, r[1]!),
      r1: Math.max(r[0]!, r[1]!),
      c0: Math.min(c[0]!, c[1]!),
      c1: Math.max(c[0]!, c[1]!),
      to: 0,
      x: event.clientX,
      y: event.clientY,
      frame: 0,
    };
    document.addEventListener("pointermove", onFillMove);
    document.addEventListener("pointerup", onFillUp);
    document.addEventListener("pointercancel", onFillCancel);
    fill.frame = requestAnimationFrame(fillStep);
  };
  const fillStep = () => {
    const now = fill;
    if (!now) return;
    // (Near the edge: scroll the Table — a virtual one draws the rows it reaches.)
    const box = table.getBoundingClientRect();
    const edge = 24;
    let dy = 0;
    if (now.y > box.bottom - edge)
      dy = Math.min(40, (now.y - (box.bottom - edge)) / 2 + 4);
    else if (now.y < box.top + edge)
      dy = -Math.min(40, (box.top + edge - now.y) / 2 + 4);
    if (dy && table.scrollHeight > table.clientHeight) table.scrollTop += dy;
    const { row, column } = placeAt(now.x, now.y);
    const outRows =
      row === undefined
        ? 0
        : row > now.r1
          ? row - now.r1
          : row < now.r0
            ? now.r0 - row
            : 0;
    const outColumns =
      column === undefined
        ? 0
        : column > now.c1
          ? column - now.c1
          : column < now.c0
            ? now.c0 - column
            : 0;
    if (!now.axis && (outRows || outColumns))
      now.axis = outRows >= outColumns ? "rows" : "columns";
    const to =
      now.axis === "rows"
        ? (row ?? now.to)
        : now.axis === "columns"
          ? (column ?? now.to)
          : now.to;
    if (to !== now.to) {
      now.to = to;
      repaint();
    }
    now.frame = requestAnimationFrame(fillStep);
  };
  const onFillMove = (event: PointerEvent) => {
    if (!fill) return;
    fill.x = event.clientX;
    fill.y = event.clientY;
  };
  const endFill = () => {
    const now = fill;
    if (now) cancelAnimationFrame(now.frame);
    fill = undefined;
    document.removeEventListener("pointermove", onFillMove);
    document.removeEventListener("pointerup", onFillUp);
    document.removeEventListener("pointercancel", onFillCancel);
    repaint();
    return now;
  };
  const onFillCancel = () => {
    endFill();
  };
  const onFillUp = () => {
    const now = endFill();
    if (!now?.axis) return;
    const at = places();
    const planned = catalogFillPlan(
      at.order,
      now,
      now.axis,
      now.to,
      (rows, columns) => source.current?.values?.(rows, columns) ?? [],
    );
    if (!planned) return;
    set([planned.range]);
    write(planned.cells, "fill", 0);
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
      source.current?.pastes &&
      source.current.write &&
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
    // ADR-317 사용자 결정 2 — Ctrl / Cmd + D: the last range's first row down its rows (one row:
    // the row above it into it).
    if (
      (event.metaKey || event.ctrlKey) &&
      !event.shiftKey &&
      !event.altKey &&
      event.key.toLowerCase() === "d" &&
      ranges.length &&
      source.current?.fills &&
      !typing(event.target)
    ) {
      event.preventDefault();
      event.stopPropagation();
      const at = places();
      const span = spanOf(at, ranges.at(-1)!);
      if (!span) return;
      const first = at.row.get(span.rows[0]!)!;
      const from = span.rows.length > 1 ? first : first - 1;
      if (from < 0) return;
      const sourceRow = at.order.rows[from]!;
      const values =
        source.current.values?.([sourceRow], span.columns)[0] ?? [];
      const cells: CatalogCellWrite[] = [];
      for (const row of span.rows)
        if (row !== sourceRow)
          span.columns.forEach((column, j) =>
            cells.push({ row, column, value: values[j] }),
          );
      write(cells, "fill", 0);
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
    if (!range || !source.current?.pastes || !event.clipboardData) return;
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
    if (!source.current?.pastes || text === undefined) return;
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
    if (event.type === "beforecopy" ? ranges.length : source.current?.pastes)
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
      endFill();
      handle.remove();
      for (const element of marked.keys()) {
        element.removeAttribute("aria-selected");
        element.removeAttribute("data-selected");
        element.removeAttribute("data-fill-corner");
        element.removeAttribute("data-fill-target");
      }
      marked.clear();
    },
  };
}

/**
 * ADR-317 Phase 3 — a fill: the range (`r0`..`r1` rows shown, `c0`..`c1` Columns drawn) carried
 * along one axis to `to` (a row's place for `rows`, a Column's for `columns`; either side). The
 * cells it reaches take the range's values repeated in order from the range's edge it leaves
 * (사용자 결정 5 — a copy, no series); the range grows to them. Undefined = `to` is in the range.
 */
export function catalogFillPlan(
  order: {
    readonly rows: readonly string[];
    readonly columns: readonly string[];
  },
  range: { r0: number; r1: number; c0: number; c1: number },
  axis: "rows" | "columns",
  to: number,
  values: (
    rows: readonly string[],
    columns: readonly string[],
  ) => readonly (readonly unknown[])[],
): { cells: CatalogCellWrite[]; range: CatalogCellRange } | undefined {
  const { r0, r1, c0, c1 } = range;
  if (axis === "rows" ? to >= r0 && to <= r1 : to >= c0 && to <= c1)
    return undefined;
  const rows = order.rows.slice(r0, r1 + 1);
  const columns = order.columns.slice(c0, c1 + 1);
  const held = values(rows, columns);
  const cells: CatalogCellWrite[] = [];
  /** The range's index for a reached place `i` of `n` (from the edge left — going back, the last). */
  const repeat = (i: number, n: number, size: number, forward: boolean) =>
    forward ? i % size : (size - ((n - i) % size)) % size;
  if (axis === "rows") {
    const forward = to > r1;
    const reached = forward
      ? order.rows.slice(r1 + 1, to + 1)
      : order.rows.slice(to, r0);
    reached.forEach((row, i) => {
      const from = repeat(i, reached.length, rows.length, forward);
      columns.forEach((column, j) =>
        cells.push({ row, column, value: held[from]?.[j] }),
      );
    });
    return {
      cells,
      range: {
        anchor: {
          row: order.rows[Math.min(r0, to)]!,
          column: order.columns[c0]!,
        },
        focus: {
          row: order.rows[Math.max(r1, to)]!,
          column: order.columns[c1]!,
        },
      },
    };
  }
  const forward = to > c1;
  const reached = forward
    ? order.columns.slice(c1 + 1, to + 1)
    : order.columns.slice(to, c0);
  rows.forEach((row, i) =>
    reached.forEach((column, j) => {
      const from = repeat(j, reached.length, columns.length, forward);
      cells.push({ row, column, value: held[i]?.[from] });
    }),
  );
  return {
    cells,
    range: {
      anchor: {
        row: order.rows[r0]!,
        column: order.columns[Math.min(c0, to)]!,
      },
      focus: { row: order.rows[r1]!, column: order.columns[Math.max(c1, to)]! },
    },
  };
}

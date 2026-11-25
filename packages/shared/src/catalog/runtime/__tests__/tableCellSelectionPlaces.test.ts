// @vitest-environment jsdom
/**
 * ADR-315 Phase 6 「Cell selection」 — the rows' · Columns' places a range reads (2026-11-25 효율 측정
 * 1번): while a range exists every cell drawn is marked, and each mark read the places afresh — a Map
 * of every row key (a virtual Table's whole order, 10,000 rows) per cell. Live (10,000 rows, a range
 * of 4 cells, 600 scroll frames): 1,569 of 9,562 ms sampled. The places are read again only when the
 * order is another list (a virtual Table holds its window's key list while its rows are the same —
 * `heldRowWindow`).
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  attachCatalogCellSelection,
  type CatalogCellSelectionSource,
} from "../tableCellSelection";

afterEach(() => {
  document.body.innerHTML = "";
});

/** A grid of rows (`data-key`) by Columns — its body cells. */
function grid(rows: readonly string[], columns: readonly string[]) {
  const table = document.createElement("div");
  table.setAttribute("role", "grid");
  const cells = new Map<string, HTMLElement>();
  for (const row of rows) {
    const tr = document.createElement("div");
    tr.setAttribute("role", "row");
    tr.setAttribute("data-key", row);
    for (const column of columns) {
      const cell = document.createElement("div");
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("data-column-key", column);
      tr.appendChild(cell);
      cells.set(`${row}:${column}`, cell);
    }
    table.appendChild(tr);
  }
  document.body.appendChild(table);
  return { table, cells };
}

/** A key list that counts the places read off it (`places` maps it to its indexes). */
function counted(keys: readonly string[]) {
  const list = [...keys] as string[] & { reads: number };
  list.reads = 0;
  const map = list.map.bind(list);
  Object.defineProperty(list, "map", {
    value: (...args: Parameters<typeof map>) => {
      list.reads += 1;
      return map(...args);
    },
  });
  return list;
}

const press = (cell: HTMLElement, init: PointerEventInit = {}) =>
  cell.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, button: 0, ...init }),
  );

describe("a Table's cell ranges read the order's places once per order", () => {
  it("marking every cell drawn under a range reads the places once, not once a cell", () => {
    const rowKeys = Array.from({ length: 50 }, (_, i) => `r${i}`);
    const columns = ["a", "b", "c"];
    const { table, cells } = grid(rowKeys, columns);
    const rows = counted(rowKeys);
    const source = {
      current: {
        order: () => ({ rows, columns: [...columns] }),
        text: () => "",
      } satisfies CatalogCellSelectionSource,
    };
    const selection = attachCatalogCellSelection(table, source);
    press(cells.get("r1:a")!);
    press(cells.get("r3:b")!, { shiftKey: true });
    rows.reads = 0;
    for (const [key, cell] of cells) selection.mark(cell, key.split(":")[1]!);
    // (Read when the range was made — the marks read the same places.)
    expect(rows.reads).toBeLessThanOrEqual(1);
    // (The marks are the range's — rows r1 … r3, Columns a … b.)
    expect(
      [...cells]
        .filter(([, cell]) => cell.getAttribute("aria-selected") === "true")
        .map(([key]) => key),
    ).toEqual(["r1:a", "r1:b", "r2:a", "r2:b", "r3:a", "r3:b"]);
    selection.detach();
  });

  it("another order (a sort — a new key list, or the Columns moved) is read again", () => {
    const columns = ["a", "b"];
    const { table, cells } = grid(["r0", "r1", "r2", "r3"], columns);
    let order = { rows: ["r0", "r1", "r2", "r3"], columns: [...columns] };
    const source = {
      current: {
        order: () => order,
        text: () => "",
      } satisfies CatalogCellSelectionSource,
    };
    const selection = attachCatalogCellSelection(table, source);
    press(cells.get("r0:a")!);
    press(cells.get("r1:a")!, { shiftKey: true });
    const selected = () =>
      [...cells]
        .filter(([key, cell]) => {
          selection.mark(cell, key.split(":")[1]!);
          return cell.getAttribute("aria-selected") === "true";
        })
        .map(([key]) => key);
    expect(selected()).toEqual(["r0:a", "r1:a"]);
    // (Sorted: r1 · r3 · r0 · r2 — the range r0 … r1 now spans r3 too.)
    order = { rows: ["r1", "r3", "r0", "r2"], columns: [...columns] };
    expect(selected()).toEqual(["r0:a", "r1:a", "r3:a"]);
    // (The same rows, the Columns swapped: the range a … a is the Column a still.)
    order = { rows: order.rows, columns: ["b", "a"] };
    expect(selected()).toEqual(["r0:a", "r1:a", "r3:a"]);
    expect(selection.has("r3", "a")).toBe(true);
    expect(selection.has("r2", "a")).toBe(false);
    selection.detach();
  });
});

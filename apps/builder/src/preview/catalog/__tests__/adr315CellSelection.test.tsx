import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands/fields";
import { setRowDisplay } from "../../../../../../packages/shared/src/catalog/commands/rowDisplay";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-315 Phase 6 — a Table 「Cell selection」 (breakdown §5.6 — the D1 exception): its viewers
 * select ranges of body cells (drag · Shift + click · Ctrl/Cmd + click, Shift + arrow keys,
 * Ctrl/Cmd + A, Esc) and copy them (the browser's copy — tab-separated text of the rows' data). The
 * grid says `aria-multiselectable`, each cell `aria-selected`; RAC keeps the focus and its moves.
 * Never with row selection (사용자 결정 5).
 *
 * Fixture (Name · Type · Status): p1 Bora B 2 · p2 Chan A 1 · p3 Ara B 3 · p4 Dana A 5 · p5 Eun A —
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

const USERS = {
  id: "users",
  name: "Users",
  schema: [
    { id: "f-id", key: "id", type: "string" },
    { id: "f-name", key: "name", type: "string" },
    { id: "f-type", key: "type", type: "string" },
    { id: "f-status", key: "status", type: "number" },
  ],
  mockData: [
    { id: "p1", name: "Bora", type: "B", status: 2 },
    { id: "p2", name: "Chan", type: "A", status: 1 },
    { id: "p3", name: "Ara", type: "B", status: 3 },
    { id: "p4", name: "Dana", type: "A", status: 5 },
    { id: "p5", name: "Eun", type: "A", status: null },
  ],
  useMockData: true,
};

async function openTable(
  props: Record<string, unknown> = { allowsCellSelection: true },
  users = USERS,
  virtual = false,
) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["Table"]);
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [users],
      variables: [],
      apiEndpoints: [],
    } as never);
  });
  const id = h.ids[0] as NodeId;
  h.workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id }],
      catalogBindingRef({
        source: "dataTable",
        collectionId: "users",
        name: "Users",
      })!,
    ),
  );
  if (virtual) {
    vi.spyOn(h.session, "showRows").mockImplementation(() => {});
    h.workspace.execute(setRowDisplay(id, { mode: "virtual" }));
  }
  for (const [key, value] of Object.entries(props))
    h.workspace.execute(
      setFields({
        targets: [{ kind: "node", id }],
        props: { [key]: { kind: "set", value } } as never,
      }),
    );
  h.flush();
  await settle();
  const grid = () =>
    h.view.container.querySelector<HTMLElement>(
      '[role="grid"], [role="treegrid"]',
    )!;
  /** The body cell of a row (its key) in a Column (its key). */
  const cell = (row: string, column: string) =>
    h.view.container.querySelector<HTMLElement>(
      `[role="row"][data-key="${row}"] [data-column-key="${column}"]`,
    )!;
  /** The selected cells, each `row:column`, in DOM order. */
  const selected = () =>
    [...h.view.container.querySelectorAll('[aria-selected="true"]')]
      .filter((element) => element.hasAttribute("data-column-key"))
      .map(
        (element) =>
          `${element.closest('[role="row"]')!.getAttribute("data-key")}:${element.getAttribute("data-column-key")}`,
      );
  const press = (
    target: HTMLElement,
    modifiers: { shiftKey?: boolean; ctrlKey?: boolean } = {},
  ) => {
    act(() => {
      fireEvent.pointerDown(target, { button: 0, ...modifiers });
      fireEvent.pointerUp(target, { button: 0 });
    });
  };
  /** The browser's copy on a cell: what the Table put on the clipboard. */
  /** Whether the last copy was the Table's (the browser's own copy prevented). */
  let copied = false;
  const copy = (target: HTMLElement) => {
    const put = vi.fn();
    act(() => {
      copied = !fireEvent.copy(target, { clipboardData: { setData: put } });
    });
    return put.mock.calls.at(-1)?.[1] as string | undefined;
  };
  const took = () => copied;
  return { h, grid, cell, selected, press, copy, took, errors };
}

describe("a Table's cell ranges (ADR-315 Phase 6)", () => {
  it("a click · Shift + click selects a range; the copy is its rows' data, tab-separated", async () => {
    const t = await openTable();
    expect(t.grid().getAttribute("aria-multiselectable")).toBe("true");
    expect(t.cell("p1", "name").getAttribute("aria-selected")).toBe("false");

    t.press(t.cell("p2", "type"));
    expect(t.selected()).toEqual(["p2:type"]);
    t.press(t.cell("p4", "status"), { shiftKey: true });
    expect(t.selected()).toEqual([
      "p2:type",
      "p2:status",
      "p3:type",
      "p3:status",
      "p4:type",
      "p4:status",
    ]);
    // The sheet's look rides `data-selected`.
    expect(t.cell("p3", "type").hasAttribute("data-selected")).toBe(true);
    expect(t.cell("p3", "name").hasAttribute("data-selected")).toBe(false);
    expect(t.copy(t.cell("p4", "status"))).toBe("A\t1\nB\t3\nA\t5");
    expect(t.took()).toBe(true);

    // Ctrl + click adds a range; the copy is the last one's.
    t.press(t.cell("p5", "name"), { ctrlKey: true });
    expect(t.selected()).toContain("p5:name");
    expect(t.selected()).toContain("p2:type");
    expect(t.copy(t.cell("p5", "name"))).toBe("Eun");

    // Esc clears; a copy without a range leaves the clipboard alone.
    act(() => {
      fireEvent.keyDown(t.cell("p5", "name"), { key: "Escape" });
    });
    expect(t.selected()).toEqual([]);
    expect(t.copy(t.cell("p5", "name"))).toBeUndefined();
    expect(t.took()).toBe(false);

    // Ctrl + A: every cell.
    act(() => {
      fireEvent.keyDown(t.cell("p1", "name"), { key: "a", ctrlKey: true });
    });
    expect(t.selected()).toHaveLength(15);
    expect(t.copy(t.cell("p1", "name"))).toBe(
      "Bora\tB\t2\nChan\tA\t1\nAra\tB\t3\nDana\tA\t5\nEun\tA\t",
    );
    expect(t.errors).not.toHaveBeenCalled();
    t.h.view.unmount();
  }, 120_000);

  it("a sort reorders the rows the range spans; a drag extends it; Shift + an arrow key extends it to the focused cell", async () => {
    const t = await openTable();
    t.press(t.cell("p1", "name"));
    // (A drag: the pointer moves over another cell with the button held.)
    act(() => {
      fireEvent.pointerDown(t.cell("p1", "name"), { button: 0 });
      fireEvent.pointerMove(t.cell("p2", "type"), { button: 0 });
      fireEvent.pointerUp(t.cell("p2", "type"), { button: 0 });
    });
    expect(t.selected()).toEqual(["p1:name", "p1:type", "p2:name", "p2:type"]);

    // The range is two points — rows by their place now: sorted by Type, p1 · p2 are far apart.
    act(() =>
      t.h.session.setTableState(
        [...t.h.session.root!.domInputs.values()].find(
          (record) => record.ruleId === "Table",
        )!.id,
        { sort: [{ column: "type", direction: "ascending" }] },
      ),
    );
    await settle();
    // A A A B B — p2 p4 p5 p1 p3: p1 … p2 spans p2 · p4 · p5 · p1.
    expect(t.selected()).toEqual([
      "p2:name",
      "p2:type",
      "p4:name",
      "p4:type",
      "p5:name",
      "p5:type",
      "p1:name",
      "p1:type",
    ]);

    // Shift + an arrow key: RAC moves the focus, the range follows it.
    t.press(t.cell("p4", "name"));
    act(() => {
      t.cell("p4", "name").focus();
    });
    act(() => {
      fireEvent.keyDown(document.activeElement!, {
        key: "ArrowRight",
        shiftKey: true,
      });
    });
    expect(document.activeElement).toBe(t.cell("p4", "type"));
    expect(t.selected()).toEqual(["p4:name", "p4:type"]);
    expect(t.errors).not.toHaveBeenCalled();
    t.h.view.unmount();
  }, 120_000);

  it("never with row selection (사용자 결정 5); off by default", async () => {
    const multiple = await openTable({
      allowsCellSelection: true,
      selectionMode: "multiple",
    });
    expect(multiple.grid().hasAttribute("data-cell-selection")).toBe(false);
    expect(
      multiple.h.view.container.querySelector("[data-column-key]"),
    ).toBeNull();
    multiple.h.view.unmount();
    const off = await openTable({});
    expect(off.grid().hasAttribute("aria-multiselectable")).toBe(false);
    expect(off.h.view.container.querySelector("[data-column-key]")).toBeNull();
    off.h.view.unmount();
  }, 120_000);

  it("a virtual Table: Ctrl + A copies every row, its window's outside too", async () => {
    const users = {
      ...USERS,
      mockData: Array.from({ length: 250 }, (_, index) => ({
        id: `p${index + 1}`,
        name: `Person${index + 1}`,
        type: `T${index % 5}`,
        status: index,
      })),
    };
    const t = await openTable({ allowsCellSelection: true }, users, true);
    // (The window is 60 rows: p250 has no cell drawn.)
    expect(t.cell("p250", "name")).toBeNull();
    act(() => {
      fireEvent.keyDown(t.cell("p1", "name"), { key: "a", ctrlKey: true });
    });
    const text = t.copy(t.cell("p1", "name"))!;
    const lines = text.split("\n");
    expect(lines).toHaveLength(250);
    expect(lines[0]).toBe("Person1\tT0\t0");
    expect(lines[249]).toBe("Person250\tT4\t249");
    expect(t.errors).not.toHaveBeenCalled();
    t.h.view.unmount();
  }, 120_000);
});

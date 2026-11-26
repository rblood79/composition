import { act, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands/fields";
import type {
  NodeId,
  NodeParent,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogFillPlan } from "../../../../../../packages/shared/src/catalog/runtime/tableCellSelection";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { catalogColumnEditableCommand } from "../../../builder/catalogRuntime/tableEditableCell";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-317 Phase 3 (G3) — a Table 「Fill handle」: the handle in the last range's bottom-right cell,
 * its drag's plan (`catalogFillPlan` — down · up · right · left, the range's values repeated — a
 * copy, 사용자 결정 5) and Ctrl / Cmd + D (사용자 결정 2). (The drag's pointer · scroll is the
 * browser's — live `adr317-p3-fill-live.mjs`.) Harness as Phase 2's:
 *
 * ADR-317 Phase 2 (G2) — a Table 「Paste」 (breakdown §4 · §5.2): the browser's paste into the
 * selected cells (from the last range's top-left, one value filling the range, what runs past the
 * Table's end dropped — 사용자 결정 4), cut and Delete · Backspace (사용자 결정 3). Only the
 * 「Editable」 Columns' data cells are written (Name · Status here — not Type), through one
 * several-cell write; the result is said in the Table's status region.
 *
 * Fixture (Name · Type · Status): p1 Bora B 2 · p2 Chan A 1 · p3 Ara B 3 · p4 Dana A 5 · p5 Eun A —.
 * The wanted values are written by hand.
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
  props: Record<string, unknown> = { allowsFilling: true },
) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["Table"]);
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [USERS],
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
  for (const [key, value] of Object.entries({
    allowsCellSelection: true,
    ...props,
  }))
    h.workspace.execute(
      setFields({
        targets: [{ kind: "node", id }],
        props: { [key]: { kind: "set", value } } as never,
      }),
    );
  h.flush();
  await settle();
  const root = () => h.workspace.root;
  const column = (key: string): NodeParent => {
    const header = [...root().canvasInputs.values()].find(
      (record) => root().typeOf(record as never) === "TableHeader",
    )!;
    const record = header.children
      .map((child) => root().canvasInputs.get(child)!)
      .find((each) => each.props.key === key)!;
    return h.workspace.positionOfRecord(record.id)!.target as NodeParent;
  };
  for (const key of ["name", "status"]) {
    h.workspace.execute(
      catalogColumnEditableCommand(
        h.workspace.runtime.graph,
        column(key),
        true,
        h.workspace.newId,
        { edit: (label) => `Edit ${label}` },
      ),
    );
    h.flush();
    await settle();
  }
  const container = h.view.container;
  const cell = (row: string, columnKey: string) =>
    container.querySelector<HTMLElement>(
      `[role="row"][data-key="${row}"] [data-column-key="${columnKey}"]`,
    )!;
  const selected = () =>
    [...container.querySelectorAll('[aria-selected="true"]')]
      .filter((element) => element.hasAttribute("data-column-key"))
      .map(
        (element) =>
          `${element.closest('[role="row"]')!.getAttribute("data-key")}:${element.getAttribute("data-column-key")}`,
      );
  const press = (target: HTMLElement, modifiers: { shiftKey?: boolean } = {}) =>
    act(() => {
      fireEvent.pointerDown(target, { button: 0, ...modifiers });
      fireEvent.pointerUp(target, { button: 0 });
    });
  /** The browser's paste of `text` on a cell — whether the Table took it (default prevented). */
  const paste = (target: HTMLElement, text: string) => {
    let took = false;
    act(() => {
      took = !fireEvent.paste(target, {
        clipboardData: {
          getData: (type: string) => (type === "text/plain" ? text : ""),
        },
      });
    });
    return took;
  };
  const item = (key: string) =>
    (h.session.collectionItems("users") as Record<string, unknown>[]).find(
      (each) => each.id === key,
    )!;
  const status = () =>
    container.querySelector('[role="status"][data-table-write-status]');
  const said = async (text: string) =>
    waitFor(() => expect(status()?.textContent).toBe(text));
  const internals = h.session as unknown as {
    currentRoot: { refreshRows: (...args: unknown[]) => unknown[] };
  };
  const refreshes = vi.spyOn(internals.currentRoot, "refreshRows");
  return {
    h,
    cell,
    selected,
    press,
    paste,
    item,
    status,
    said,
    refreshes,
    errors,
  };
}

describe("ADR-317 Phase 3 — the fill's plan", () => {
  const order = {
    rows: ["a", "b", "c", "d", "e", "f"],
    columns: ["x", "y", "z"],
  };
  const values = (rows: readonly string[], columns: readonly string[]) =>
    rows.map((row) => columns.map((column) => `${row}${column}`));
  const cells = (plan: ReturnType<typeof catalogFillPlan>) =>
    plan?.cells.map(
      (cell) => `${cell.row}${cell.column}=${String(cell.value)}`,
    );

  it("down · up repeat the range's rows from the edge they leave", () => {
    // Range b..c × x: down to f → d=b · e=c · f=b. Range c..d up to a → the pattern runs on
    // backwards: b=d · a=c (Excel).
    expect(
      cells(
        catalogFillPlan(
          order,
          { r0: 1, r1: 2, c0: 0, c1: 0 },
          "rows",
          5,
          values,
        ),
      ),
    ).toEqual(["dx=bx", "ex=cx", "fx=bx"]);
    expect(
      cells(
        catalogFillPlan(
          order,
          { r0: 2, r1: 3, c0: 0, c1: 0 },
          "rows",
          0,
          values,
        ),
      ),
    ).toEqual(["ax=cx", "bx=dx"]);
    expect(
      catalogFillPlan(order, { r0: 2, r1: 3, c0: 0, c1: 0 }, "rows", 3, values),
    ).toBeUndefined();
  });

  it("right · left repeat the range's Columns; the range grows to the cells reached", () => {
    const right = catalogFillPlan(
      order,
      { r0: 0, r1: 1, c0: 0, c1: 0 },
      "columns",
      2,
      values,
    );
    expect(cells(right)).toEqual(["ay=ax", "az=ax", "by=bx", "bz=bx"]);
    expect(right?.range).toEqual({
      anchor: { row: "a", column: "x" },
      focus: { row: "b", column: "z" },
    });
    expect(
      cells(
        catalogFillPlan(
          order,
          { r0: 0, r1: 0, c0: 1, c1: 2 },
          "columns",
          0,
          values,
        ),
      ),
    ).toEqual(["ax=az"]);
  });
});

describe("ADR-317 Phase 3 — a Table 「Fill handle」", () => {
  it("puts the handle in the last range's bottom-right cell; its press keeps the range", async () => {
    const t = await openTable();
    t.press(t.cell("p1", "name"));
    t.press(t.cell("p2", "status"), { shiftKey: true });
    const handles = () => [
      ...t.h.view.container.querySelectorAll("[data-fill-handle]"),
    ];
    expect(handles()).toHaveLength(1);
    expect(handles()[0]!.closest("[data-column-key]")).toBe(
      t.cell("p2", "status"),
    );
    expect(handles()[0]!.getAttribute("aria-hidden")).toBe("true");
    expect(t.cell("p2", "status").hasAttribute("data-fill-corner")).toBe(true);
    act(() => {
      fireEvent.pointerDown(handles()[0]!, { button: 0 });
      fireEvent.pointerUp(document, { button: 0 });
    });
    expect(t.selected()).toEqual([
      "p1:name",
      "p1:type",
      "p1:status",
      "p2:name",
      "p2:type",
      "p2:status",
    ]);
    // The range moves — so does the handle.
    t.press(t.cell("p4", "name"));
    expect(handles()).toHaveLength(1);
    expect(handles()[0]!.closest("[data-column-key]")).toBe(
      t.cell("p4", "name"),
    );
    t.h.view.unmount();
  }, 120_000);

  it("Ctrl / Cmd + D copies the range's first row down it (사용자 결정 2), one write", async () => {
    const t = await openTable();
    t.press(t.cell("p1", "name"));
    t.press(t.cell("p3", "status"), { shiftKey: true });
    t.refreshes.mockClear();
    let kept = true;
    act(() => {
      kept = fireEvent.keyDown(t.cell("p3", "status"), {
        key: "d",
        ctrlKey: true,
      });
    });
    await settle();
    expect(kept).toBe(false);
    expect(t.refreshes).toHaveBeenCalledTimes(1);
    expect(
      [t.item("p2"), t.item("p3")].map((x) => [x.name, x.type, x.status]),
    ).toEqual([
      ["Bora", "A", 2],
      ["Bora", "B", 2],
    ]);
    await t.said("Filled 4 cells · 2 skipped");

    // One row: the row above it into it.
    t.press(t.cell("p5", "name"));
    act(() => {
      fireEvent.keyDown(t.cell("p5", "name"), { key: "d", metaKey: true });
    });
    await settle();
    expect(t.item("p5").name).toBe("Dana");
    await t.said("Filled 1 cell");
    t.h.view.unmount();
  }, 120_000);

  it("a Table without 「Fill handle」 has no handle and leaves Ctrl / Cmd + D alone", async () => {
    const t = await openTable({ allowsPasting: true });
    t.press(t.cell("p1", "name"));
    t.press(t.cell("p2", "name"), { shiftKey: true });
    expect(t.h.view.container.querySelector("[data-fill-handle]")).toBeNull();
    let kept = false;
    act(() => {
      kept = fireEvent.keyDown(t.cell("p2", "name"), {
        key: "d",
        ctrlKey: true,
      });
    });
    await settle();
    expect(kept).toBe(true);
    expect(t.item("p2").name).toBe("Chan");
    t.h.view.unmount();
  }, 120_000);
});

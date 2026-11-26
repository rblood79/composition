import { act, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands/fields";
import type {
  NodeId,
  NodeParent,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { splitTabText } from "../../../../../../packages/shared/src/collections/intake/tabText";
import { parsePastedRows } from "../../../builder/panels/datatable/utils/pasteRows";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { catalogColumnEditableCommand } from "../../../builder/catalogRuntime/tableEditableCell";
import { openAdr280Preview } from "./support/adr280Harness";

/**
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

async function openTable(pasting = true) {
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
    ...(pasting ? { allowsPasting: true } : {}),
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

describe("ADR-317 Phase 2 — a Table 「Paste」", () => {
  it("pastes a block from the range's top-left: Editable Columns' readable values, one write", async () => {
    const t = await openTable();
    t.press(t.cell("p2", "name"));
    t.refreshes.mockClear();
    expect(t.paste(t.cell("p2", "name"), "Ana\tX\t9\nBo\tY\tabc\n")).toBe(true);
    await settle();
    expect(t.refreshes).toHaveBeenCalledTimes(1);
    // Type is not 「Editable」; 「abc」 is no number — both kept, counted.
    expect(t.item("p2")).toMatchObject({ name: "Ana", type: "A", status: 9 });
    expect(t.item("p3")).toMatchObject({ name: "Bo", type: "B", status: 3 });
    await t.said("Pasted into 3 cells · 3 skipped");
    // The range becomes what was pasted.
    expect(t.selected()).toEqual([
      "p2:name",
      "p2:type",
      "p2:status",
      "p3:name",
      "p3:type",
      "p3:status",
    ]);
    // The drawn cells show it.
    expect(t.cell("p2", "name").textContent?.trim()).toBe("Ana");
    expect(t.errors).not.toHaveBeenCalled();
    t.h.view.unmount();
  }, 120_000);

  it("drops what runs past the Table's end (사용자 결정 4) · one value fills the range", async () => {
    const t = await openTable();
    t.press(t.cell("p5", "name"));
    t.paste(t.cell("p5", "name"), "Q\t1\nR\t2");
    await settle();
    expect(t.item("p5")).toMatchObject({ name: "Q", type: "A" });
    await t.said("Pasted into 1 cell · 3 skipped");

    t.press(t.cell("p1", "status"));
    t.press(t.cell("p3", "status"), { shiftKey: true });
    t.paste(t.cell("p3", "status"), "7");
    await settle();
    expect(
      [t.item("p1"), t.item("p2"), t.item("p3")].map((x) => x.status),
    ).toEqual([7, 7, 7]);
    expect(t.item("p4").status).toBe(5);
    await t.said("Pasted into 3 cells");
    t.h.view.unmount();
  }, 120_000);

  it("Delete · Backspace empty the ranges; a cut copies, then empties (사용자 결정 3)", async () => {
    const t = await openTable();
    t.press(t.cell("p1", "name"));
    t.press(t.cell("p1", "status"), { shiftKey: true });
    act(() => {
      fireEvent.keyDown(t.cell("p1", "status"), { key: "Delete" });
    });
    await settle();
    // (An empty text is the field's empty value — `null`.)
    expect(t.item("p1")).toMatchObject({ name: null, type: "B", status: null });
    await t.said("Cleared 2 cells · 1 skipped");

    t.press(t.cell("p4", "name"));
    t.press(t.cell("p4", "status"), { shiftKey: true });
    const put = vi.fn();
    let took = false;
    act(() => {
      took = !fireEvent.cut(t.cell("p4", "status"), {
        clipboardData: { setData: put },
      });
    });
    await settle();
    expect(took).toBe(true);
    expect(put).toHaveBeenLastCalledWith("text/plain", "Dana\tA\t5");
    expect(t.item("p4")).toMatchObject({ name: null, type: "A", status: null });
    await t.said("Cut 2 cells · 1 skipped");

    t.press(t.cell("p2", "name"));
    act(() => {
      fireEvent.keyDown(t.cell("p2", "name"), { key: "Backspace" });
    });
    await settle();
    expect(t.item("p2").name).toBeNull();
    t.h.view.unmount();
  }, 120_000);

  it("keeps Safari's Edit menu on (beforepaste) only while the focus is in the Table", async () => {
    const t = await openTable();
    const cellNow = t.cell("p1", "name");
    cellNow.tabIndex = -1;
    act(() => cellNow.focus());
    const inside = new Event("beforepaste", { cancelable: true });
    document.dispatchEvent(inside);
    expect(inside.defaultPrevented).toBe(true);
    // (Focus outside the Table — a control of the page.)
    const away = document.body.appendChild(document.createElement("button"));
    act(() => away.focus());
    const outside = new Event("beforepaste", { cancelable: true });
    document.dispatchEvent(outside);
    expect(outside.defaultPrevented).toBe(false);
    away.remove();
    t.h.view.unmount();
  }, 120_000);

  it("a Table without 「Paste」 writes nothing and says nothing", async () => {
    const t = await openTable(false);
    t.press(t.cell("p1", "name"));
    expect(t.paste(t.cell("p1", "name"), "Zed")).toBe(false);
    act(() => {
      fireEvent.keyDown(t.cell("p1", "name"), { key: "Delete" });
    });
    await settle();
    expect(t.item("p1").name).toBe("Bora");
    expect(t.status()).toBeNull();
    t.h.view.unmount();
  }, 120_000);
});

describe("ADR-317 R5 — the clipboard text's cells = the Builder's paste's (plain tab lines)", () => {
  it.each([
    "name\tcity\nKim\tSeoul\nPark\tBusan",
    "name\tcity\tqty\r\nKim\tSeoul\t1\r\nLee\t\t3\r\n",
    "a\tb\n1,234\t2024-01-05",
  ])("%j", (text) => {
    const builder = parsePastedRows(text);
    expect(builder.ok).toBe(true);
    if (!builder.ok) return;
    const [header, ...lines] = splitTabText(text);
    expect(
      lines.map((line) =>
        Object.fromEntries(
          header!.map((key, i) => {
            const value = (line[i] ?? "").trim();
            return [key, value === "" ? null : value];
          }),
        ),
      ),
    ).toEqual(builder.rows);
  });
});

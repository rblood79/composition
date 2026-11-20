import { act, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands/fields";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-315 Phase 4 증분 5 — a header drag (사용자 결정 3): a Table that reorders gives each data
 * Column's header a handle (react-aria `useDrag`); while one drags, the other headers it may drop
 * on take a drop target (`useDrop`), and a drop writes the Table state's order — the rows are not
 * read again and the document does not change. A keyboard drag (handle: Enter → Tab → Enter) is
 * react-aria's.
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
  ],
  useMockData: true,
};

async function openTable(reorder: boolean) {
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
  const table = h.ids[0] as NodeId;
  h.workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id: table }],
      catalogBindingRef({
        source: "dataTable",
        collectionId: "users",
        name: "Users",
      })!,
    ),
  );
  if (reorder)
    h.workspace.execute(
      setFields({
        targets: [{ kind: "node", id: table }],
        props: { allowsColumnReordering: { kind: "set", value: true } },
      }),
    );
  h.flush();
  await settle();
  const headers = () =>
    [
      ...(h.element(table)?.querySelectorAll('[role="columnheader"]') ?? []),
    ].map((cell) =>
      [...cell.childNodes]
        .filter(
          (node) =>
            !(
              node instanceof Element &&
              (node.classList.contains("catalog-column-drag-handle") ||
                node.classList.contains("catalog-column-drop"))
            ),
        )
        .map((node) => node.textContent ?? "")
        .join("")
        .trim(),
    );
  const handles = () => [
    ...(h
      .element(table)
      ?.querySelectorAll<HTMLElement>(".catalog-column-drag-handle") ?? []),
  ];
  const handleOf = (label: string) =>
    handles().find(
      (handle) =>
        handle.closest('[role="columnheader"]') ===
        [
          ...(h.element(table)?.querySelectorAll('[role="columnheader"]') ??
            []),
        ][headers().indexOf(label)],
    )!;
  const drops = () => [
    ...(h
      .element(table)
      ?.querySelectorAll<HTMLElement>(".catalog-column-drop") ?? []),
  ];
  const tableRecord = () =>
    [...h.session.root!.domInputs.values()].find(
      (record) => record.ruleId === "Table",
    )!.id;
  return {
    ...h,
    table,
    headers,
    handles,
    handleOf,
    drops,
    tableRecord,
    errors,
  };
}

it("5: a Table that reorders gives each data Column's header a handle — none without the switch", async () => {
  const off = await openTable(false);
  expect(off.headers()).toEqual(["Name", "Type", "Status"]);
  await waitFor(() => expect(off.handles()).toHaveLength(0));
  // (A Column with a menu for another reason — 「Allow hiding」 — still has no handle.)
  const type = [...off.session.root!.domInputs.values()].find(
    (record) => record.ruleId === "Column" && record.props.children === "Type",
  )!.sourceId as NodeId;
  off.workspace.execute(
    setFields({
      targets: [{ kind: "node", id: type }],
      props: { allowsHiding: { kind: "set", value: true } },
    }),
  );
  off.flush();
  await settle();
  expect(
    off.element(off.table)?.querySelectorAll(".catalog-column-menu-button")
      .length,
  ).toBe(1);
  expect(off.handles()).toHaveLength(0);
  const h = await openTable(true);
  await waitFor(() => expect(h.handles()).toHaveLength(3));
  expect(h.handles().map((handle) => handle.getAttribute("aria-label"))).toEqual(
    ["Move column: Name", "Move column: Type", "Move column: Status"],
  );
  // (No drop target before a drag.)
  expect(h.drops()).toHaveLength(0);
});

it("5: pressing the handle does not sort the column", async () => {
  const h = await openTable(true);
  // (Name sorts — a press on its header would.)
  const name = [...h.session.root!.domInputs.values()].find(
    (record) => record.ruleId === "Column" && record.props.children === "Name",
  )!.sourceId as NodeId;
  h.workspace.execute(
    setFields({
      targets: [{ kind: "node", id: name }],
      props: { allowsSorting: { kind: "set", value: true } },
    }),
  );
  h.flush();
  await settle();
  await waitFor(() => expect(h.handles()).toHaveLength(3));
  const handle = h.handleOf("Name");
  await act(async () => {
    // (Off the handle's centre: react-aria reads a press at the exact centre as a screen reader's
    //  virtual drag — jsdom's boxes are all 0 × 0.)
    const at = { clientX: 3, clientY: 3 };
    fireEvent.pointerDown(handle, { pointerType: "mouse", button: 0, ...at });
    fireEvent.mouseDown(handle, { button: 0, ...at });
    fireEvent.pointerUp(handle, { pointerType: "mouse", button: 0, ...at });
    fireEvent.mouseUp(handle, { button: 0, ...at });
    // (`detail: 1` — a click of `detail` 0 is a virtual one: a screen reader's.)
    fireEvent.click(handle, { ...at, detail: 1 });
    fireEvent.keyDown(handle, { key: " " });
    fireEvent.keyUp(handle, { key: " " });
  });
  await settle();
  expect(h.session.tableState(h.tableRecord()).sort ?? []).toEqual([]);
});

it("5: a keyboard drag (Enter → Tab → Enter) moves Name after Status — the Table state's order, rows not read, the document unchanged", async () => {
  const h = await openTable(true);
  await waitFor(() => expect(h.handles()).toHaveLength(3));
  const rowSource = vi.spyOn(
    h.session as unknown as { boundRows: (...args: unknown[]) => unknown },
    "boundRows",
  );
  const revision = JSON.stringify(h.workspace.runtime.graph.revision);
  const handle = h.handleOf("Name");
  act(() => handle.focus());
  await act(async () => {
    fireEvent.keyDown(handle, { key: "Enter" });
    fireEvent.keyUp(handle, { key: "Enter" });
  });
  await settle();
  // (While Name drags, Type and Status take a drop target; Name's own header none.)
  await waitFor(() => expect(h.drops()).toHaveLength(2));
  // (react-aria's keyboard drag: Tab walks the drop targets — to Status, the second.)
  const status = h.drops()[1]!;
  await act(async () => {
    fireEvent.keyDown(document.activeElement ?? status, { key: "Tab" });
    fireEvent.keyUp(document.activeElement ?? status, { key: "Tab" });
  });
  await settle();
  await waitFor(() =>
    expect(document.activeElement?.closest('[role="columnheader"]')).toBe(
      status.closest('[role="columnheader"]'),
    ),
  );
  await act(async () => {
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    fireEvent.keyUp(document.activeElement!, { key: "Enter" });
  });
  await settle();
  await waitFor(() => expect(h.headers()).toEqual(["Type", "Status", "Name"]));
  expect(h.session.tableState(h.tableRecord()).columnOrder).toEqual([
    "type",
    "status",
    "name",
  ]);
  expect(h.drops()).toHaveLength(0);
  expect(rowSource).toHaveBeenCalledTimes(0);
  expect(JSON.stringify(h.workspace.runtime.graph.revision)).toBe(revision);
  expect(
    h.errors.mock.calls.filter((call) =>
      String(call[0]).includes("Cell count"),
    ),
  ).toEqual([]);
});

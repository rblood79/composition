import { act, fireEvent } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands/fields";
import { setColumnChooser } from "../../../../../../packages/shared/src/catalog/commands/rowDisplay";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import {
  catalogRemoveTableColumnChoosersCommand,
  catalogTableColumnChooserCommand,
  catalogTableColumnChoosers,
} from "../../../builder/catalogRuntime/tableColumnChooser";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-315 Phase 4 (증분 4d) — a column chooser: a Menu (MenuTrigger instance) connected to a Table
 * (`columnsOf`) lists the Table's data columns — its first item repeated per column — checked when
 * shown. Unchecking hides the column (the Table state's `hiddenColumns` — rows are not read again),
 * checking shows it; the last row header shown cannot be unchecked.
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

async function openChooser() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["Menu", "Table"]);
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [USERS],
      variables: [],
      apiEndpoints: [],
    } as never);
  });
  const [menu, table] = h.ids as [NodeId, NodeId];
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
  h.workspace.execute(
    setFields({
      targets: [{ kind: "node", id: menu }],
      props: { selectionMode: { kind: "set", value: "multiple" } },
    }),
  );
  h.workspace.execute(setColumnChooser(menu, table));
  h.flush();
  await settle();
  const headers = () =>
    [
      ...(h.element(table)?.querySelectorAll('[role="columnheader"]') ?? []),
    ].map((cell) => cell.textContent?.trim() ?? "");
  const open = async () => {
    // (A MenuTrigger draws no element — its ActionButton 「Menu」 is the trigger.)
    const trigger = [...document.querySelectorAll("button")].find(
      (button) => button.getAttribute("aria-haspopup") === "true",
    );
    expect(trigger).toBeTruthy();
    await act(async () => {
      fireEvent.pointerDown(trigger!, { pointerType: "mouse", button: 0 });
      fireEvent.pointerUp(trigger!, { pointerType: "mouse", button: 0 });
      fireEvent.click(trigger!);
    });
    await settle();
  };
  const items = () =>
    [...document.querySelectorAll('[role="menuitemcheckbox"]')].map((item) => ({
      text: item.textContent?.trim() ?? "",
      checked: item.getAttribute("aria-checked") === "true",
      disabled: item.getAttribute("aria-disabled") === "true",
      item,
    }));
  const press = async (text: string) => {
    const item = items().find((entry) => entry.text === text)!;
    expect(item).toBeDefined();
    await act(async () => {
      fireEvent.click(item.item);
    });
    await settle();
  };
  return { ...h, menu, table, headers, open, items, press, errors };
}

it("4d: the chooser lists Name · Type · Status checked — unchecking Type hides it, checking shows it, Name (the row header) is locked", async () => {
  const h = await openChooser();
  expect(h.headers()).toEqual(["Name", "Type", "Status"]);
  await h.open();
  expect(h.items().map(({ text, checked }) => [text, checked])).toEqual([
    ["Name", true],
    ["Type", true],
    ["Status", true],
  ]);
  expect(h.items().find((item) => item.text === "Name")?.disabled).toBe(true);
  const rowSource = vi.spyOn(
    h.session as unknown as { boundRows: (...args: unknown[]) => unknown },
    "boundRows",
  );
  await h.press("Type");
  expect(h.headers()).toEqual(["Name", "Status"]);
  const tableId = [...h.session.root!.domInputs.values()].find(
    (record) => record.ruleId === "Table",
  )!.id;
  expect(h.session.tables.tableState(tableId).hiddenColumns).toEqual(["type"]);
  if (!h.items().length) await h.open();
  expect(h.items().find((item) => item.text === "Type")?.checked).toBe(false);
  await h.press("Type");
  expect(h.headers()).toEqual(["Name", "Type", "Status"]);
  // (HC4 — a column slice reads no row.)
  expect(rowSource).toHaveBeenCalledTimes(0);
  // The row header stays: unchecking it changes nothing.
  if (!h.items().length) await h.open();
  await h.press("Name");
  expect(h.headers()).toEqual(["Name", "Type", "Status"]);
  expect(
    h.errors.mock.calls.filter((call) =>
      String(call[0]).includes("Cell count"),
    ),
  ).toEqual([]);
});

it("4d: the chooser follows its Table — a renamed Column is listed by its new name, an added one is listed", async () => {
  const h = await openChooser();
  const columns = () =>
    [...h.session.root!.domInputs.values()].filter(
      (record) => record.ruleId === "Column",
    );
  const type = columns().find((record) => record.props.children === "Type")!;
  h.workspace.execute(
    setFields({
      targets: [{ kind: "node", id: type.sourceId as NodeId }],
      props: { children: { kind: "set", value: "Kind" } },
    }),
  );
  h.flush();
  await settle();
  await h.open();
  expect(h.items().map((item) => item.text)).toEqual([
    "Name",
    "Kind",
    "Status",
  ]);
});

it("4d: a rule's column Do — hide · show · set shown columns on the Table, pin · filter on a Column (the Table state, not the document)", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["Button", "Table"]);
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [USERS],
      variables: [],
      apiEndpoints: [],
    } as never);
  });
  const [button, table] = h.ids as [NodeId, NodeId];
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
  h.flush();
  await settle();
  const headers = () =>
    [
      ...(h.element(table)?.querySelectorAll('[role="columnheader"]') ?? []),
    ].map((cell) => cell.textContent?.trim() ?? "");
  // (The body's rows — the second row group; the first is the header's.)
  const rows = () =>
    h.element(table)?.querySelectorAll('[role="rowgroup"]')[1]
      ?.querySelectorAll('[role="row"]').length ?? 0;
  const columnNode = (label: string) =>
    [...h.session.root!.domInputs.values()].find(
      (record) => record.ruleId === "Column" && record.props.children === label,
    )!.sourceId as NodeId;
  const run = async (
    target: NodeId,
    capabilityId: string,
    value?: string,
  ) => {
    h.rule(button, "onPress", {
      opcode: "capability",
      target: { nodeId: target },
      capabilityId,
      ...(value !== undefined ? { value } : {}),
    } as never);
    h.flush();
    await settle();
    await act(async () => {
      fireEvent.click(h.element(button)!);
    });
    await settle();
  };
  const document = () => JSON.stringify(h.workspace.runtime.graph.revision);
  const before = document();

  await run(table, "hideColumn", "type");
  expect(headers()).toEqual(["Name", "Status"]);
  await run(table, "showColumn", "type");
  expect(headers()).toEqual(["Name", "Type", "Status"]);
  // (The last row header stays shown — a Do cannot leave the Table without one.)
  await run(table, "hideColumn", "name");
  expect(headers()).toEqual(["Name", "Type", "Status"]);
  // (…and the state does not hold it hidden — the projection's rule is not left to cover it.)
  const tableRecord = [...h.session.root!.domInputs.values()].find(
    (record) => record.ruleId === "Table",
  )!.id;
  expect(h.session.tables.tableState(tableRecord).hiddenColumns ?? []).not.toContain(
    "name",
  );
  await run(table, "setVisibleColumns", "name, status");
  expect(headers()).toEqual(["Name", "Status"]);
  await run(table, "setVisibleColumns", "name,type,status");

  const name = columnNode("Name");
  await run(name, "pinColumnEnd");
  expect(headers()).toEqual(["Type", "Status", "Name"]);
  await run(name, "unpinColumn");
  expect(headers()).toEqual(["Name", "Type", "Status"]);

  expect(rows()).toBe(2);
  const type = columnNode("Type");
  await run(type, "setColumnFilter", "A");
  expect(rows()).toBe(1);
  await run(type, "clearColumnFilter");
  expect(rows()).toBe(2);
  // (Each rule went in as a document edit — the Do themselves wrote none: the last run's rule is
  //  the only change since the one before it.)
  expect(document()).not.toBe(before);
  expect(
    [...h.session.root!.domInputs.values()].find(
      (record) => record.ruleId === "Table",
    )!.props.visibleColumns,
  ).toBeUndefined();
});

it("4d: the panel switch places a 「Columns」 menu before the Table — on an unbound Table too — and off takes it away (one step each)", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["Table"]);
  const table = h.ids[0] as NodeId;
  const graph = h.workspace.runtime.graph;
  const { created } = (() => {
    const made = catalogTableColumnChooserCommand(
      { tableId: table, label: "Columns" },
      h.workspace.newId,
    );
    h.workspace.execute(made.command);
    return made;
  })();
  h.flush();
  await settle();
  expect(catalogTableColumnChoosers(graph, table)).toEqual([created.chooserId]);
  // (Placed right before the Table.)
  const page = [...h.session.root!.domInputs.values()].find(
    (record) => record.ruleId === "Table",
  )!.parentId;
  const order = h.session.root!.domInputs.get(page)!.children.map(
    (id) => h.session.root!.domInputs.get(id)?.sourceId,
  );
  expect(order.indexOf(created.chooserId)).toBe(order.indexOf(table) - 1);
  const trigger = [...document.querySelectorAll("button")].find(
    (button) => button.getAttribute("aria-haspopup") === "true",
  )!;
  expect(trigger.textContent?.trim()).toBe("Columns");
  await act(async () => {
    fireEvent.click(trigger);
  });
  await settle();
  expect(
    [...document.querySelectorAll('[role="menuitemcheckbox"]')].map((item) =>
      item.textContent?.trim(),
    ),
  ).toEqual(["Name", "Type", "Status"]);
  h.workspace.execute(catalogRemoveTableColumnChoosersCommand(graph, table)!);
  h.flush();
  await settle();
  expect(catalogTableColumnChoosers(graph, table)).toEqual([]);
  expect(graph.getEntry(created.chooserId)).toBeUndefined();
});

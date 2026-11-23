import { act, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogHiddenAtRest } from "../../../../../../packages/shared/src/catalog/runtime/presence";
import { CATALOG_COLUMN_MENU_PROP } from "../../../../../../packages/shared/src/catalog/runtime/tableTracks";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * S2 체크리스트 §9.2 (2026-11-24) — S2 Column `menuItems`: a Column's MenuItem children are its
 * menu's own items (S2 `isMenu = allowsResizing || !!menuItems`). The Canvas draws none of them (a
 * closed menu's items) and marks the Column a menu Column; the Preview's column menu shows them
 * after the Table's items, each a RAC MenuItem of its own.
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
  ],
  mockData: [
    { id: "p1", name: "Bora" },
    { id: "p2", name: "Chan" },
  ],
  useMockData: true,
};

it("a Column's MenuItem is its menu's item — hidden on the Canvas, after the Table's items in the Preview", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
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
  h.flush();
  await settle();
  const root = h.workspace.root;
  const column = [...root.canvasInputs.values()].find(
    (record) => record.ruleId === "Column" && record.props.children === "Name",
  )!;
  const columnId = column.sourceId as NodeId;
  const blank = { visual: {}, sizing: {}, descendantOverrides: [] };
  h.workspace.execute(
    insertNodes({
      parent: { kind: "node", id: columnId },
      entries: [
        {
          kind: "node",
          id: "project:node:column-export",
          definitionId: "lib:definition:type-MenuItem",
          children: ["project:node:column-export-text"],
          props: { id: { kind: "set", value: "export" } },
          ...blank,
        } as NodeEntry,
        {
          kind: "node",
          id: "project:node:column-export-text",
          definitionId: "lib:definition:text",
          children: [],
          props: { children: { kind: "set", value: "Export" } },
          ...blank,
        } as NodeEntry,
      ],
      rootIds: ["project:node:column-export" as NodeId],
      newId: h.workspace.newId,
    }),
  );
  h.flush();
  await settle();

  // Canvas: the Column is a menu Column; its MenuItem is not drawn.
  const after = h.workspace.root;
  const columnNow = [...after.canvasInputs.values()].find(
    (record) => record.sourceId === columnId,
  )!;
  expect(columnNow.props[CATALOG_COLUMN_MENU_PROP]).toBe(true);
  const item = [...after.canvasInputs.values()].find(
    (record) => record.sourceId === "project:node:column-export",
  )!;
  expect(
    catalogHiddenAtRest(
      item,
      (id) => after.canvasInputs.get(id),
      (record) => after.typeOf(record),
    ),
  ).toBe(true);

  // Preview: the column menu holds the Table's items (none here — only the menu item makes it a menu), then 「Export」.
  const button = await waitFor(() => {
    const found = [
      ...(h
        .element(table)
        ?.querySelectorAll<HTMLElement>(".catalog-column-menu-button") ?? []),
    ].find((element) => element.textContent?.includes("Name"));
    expect(found).toBeDefined();
    return found!;
  });
  expect(button.textContent).not.toContain("Export");
  act(() => {
    fireEvent.click(button);
  });
  await settle();
  const labels = await waitFor(() => {
    const items = [...document.querySelectorAll('[role="menuitem"]')].map(
      (element) => element.textContent?.trim() ?? "",
    );
    expect(items).toContain("Export");
    return items;
  });
  expect(labels.at(-1)).toBe("Export");
  h.view.unmount();
});

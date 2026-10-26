import { act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  EntryId,
  NodeEntry,
  NodeId,
  StateVariableEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { catalogVariableCommands } from "../../../builder/catalogRuntime/stateVariables";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * The Value field's 「값 고르기」 — a rule value names its source (`valueRef.ts`): a GridList's
 * selection writes the selected item's `name` (`!item.keys.name` — `useListData.getItem`) or the
 * whole row (`!item.keys`) into a page variable a Text shows (`{{ TEMP }}` · `{{ TEMP.name }}`).
 * Before it, a Set state value was written as typed (the user's 「selectedKeys.name」).
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const HOME = "project:page:home" as EntryId<"page">;
const TEXT = "project:node:result" as NodeId;
const USERS = [
  { id: "u1", name: "Lily Davis", gender: "female" },
  { id: "u2", name: "Liam Davis", gender: "male" },
];

async function selectionPreview(
  selectionMode: "single" | "multiple",
  valueType: "string" | "object" | "array",
  value: string,
  text: string,
) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["GridList"]);
  const [list] = h.ids as [NodeId];
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [
        {
          id: "users",
          name: "Users",
          schema: [
            { id: "f-id", key: "id", type: "string" },
            { id: "f-name", key: "name", type: "string" },
            { id: "f-gender", key: "gender", type: "string" },
          ],
          mockData: USERS,
          useMockData: true,
        },
      ],
      variables: [],
      apiEndpoints: [],
    });
  });
  h.workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id: list }],
      catalogBindingRef({
        source: "dataTable",
        collectionId: "users",
        name: "Users",
      })!,
    ),
  );
  h.workspace.execute(
    setFields({
      targets: [{ kind: "node", id: list }],
      props: { selectionMode: { kind: "set", value: selectionMode } },
      label: "Selection",
    }),
  );
  h.workspace.execute(
    catalogVariableCommands.add(HOME as never, "TEMP", h.workspace.newId),
  );
  const graph = h.workspace.runtime.graph;
  const variable = [...graph.referrersOf(HOME)]
    .map((id) => graph.getEntry(id))
    .find(
      (entry): entry is StateVariableEntry => entry?.kind === "stateVariable",
    )!;
  h.workspace.execute(catalogVariableCommands.setType(variable, valueType));
  h.workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: TEXT,
          definitionId: "lib:definition:text",
          children: [],
          props: { children: { kind: "set", value: text } },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [TEXT],
      newId: h.workspace.newId,
    }),
  );
  h.rule(list, "onSelectionChange", {
    opcode: "setState",
    variableId: variable.id,
    op: "set",
    value,
  });
  const rows = () => [
    ...(h.element(list)?.querySelectorAll('[role="row"]') ?? []),
  ];
  const shown = () => h.element(TEXT)?.textContent ?? "";
  return { ...h, rows, shown };
}

describe("Value field — a rule value names its source", () => {
  it("a single GridList's selection: `!item.keys.name` writes the item's name", async () => {
    const h = await selectionPreview(
      "single",
      "string",
      "!item.keys.name",
      "{{ TEMP }}",
    );
    const user = userEvent.setup();
    await user.click(
      h.rows().find((row) => row.textContent?.includes("Liam"))!,
    );
    expect(h.shown()).toBe("Liam Davis");
    h.view.unmount();
  });

  it("the whole row (`!item.keys`) is an object the Text reads by path", async () => {
    const h = await selectionPreview(
      "single",
      "object",
      "!item.keys",
      "{{ TEMP.name }} / {{ TEMP.gender }}",
    );
    const user = userEvent.setup();
    await user.click(
      h.rows().find((row) => row.textContent?.includes("Lily"))!,
    );
    expect(h.shown()).toBe("Lily Davis / female");
    h.view.unmount();
  });

  it("a multiple selection gives the items (an array) — `!event.keys` the keys", async () => {
    const h = await selectionPreview(
      "multiple",
      "array",
      "!item.keys.name",
      "{{ TEMP }}",
    );
    const user = userEvent.setup();
    await user.click(
      h.rows().find((row) => row.textContent?.includes("Lily"))!,
    );
    await user.click(
      h.rows().find((row) => row.textContent?.includes("Liam"))!,
    );
    expect(JSON.parse(h.shown())).toEqual(["Lily Davis", "Liam Davis"]);
    h.view.unmount();
    const keys = await selectionPreview(
      "multiple",
      "array",
      "!event.keys",
      "{{ TEMP }}",
    );
    await userEvent
      .setup()
      .click(keys.rows().find((row) => row.textContent?.includes("Liam"))!);
    expect(JSON.parse(keys.shown())).toEqual(["u2"]);
    keys.view.unmount();
  });

  it("a literal stays a literal (the typed text, as before)", async () => {
    const h = await selectionPreview(
      "single",
      "string",
      "selectedKeys.name",
      "{{ TEMP }}",
    );
    await userEvent.setup().click(h.rows()[0]!);
    expect(h.shown()).toBe("selectedKeys.name");
    h.view.unmount();
  });
});

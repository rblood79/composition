import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DataCollectionId,
  InteractionEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import {
  catalogInteractionsCommand,
  catalogNewInteraction,
} from "../../../builder/catalogRuntime/interactions";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * `useListData`'s positions — `insert(index, …)` · `insertBefore(key, …)` · `insertAfter(key, …)` ·
 * `prepend(…)` · `move(key, toIndex)` · `moveBefore(key, keys)` · `moveAfter(key, keys)` ·
 * `removeSelectedItems()` (the list's selection = the selection of the components showing it).
 * The session replays them over the Builder's items like `append` · `update` · `remove`.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const USERS = "data:collection:users" as DataCollectionId;
const ROWS = [
  { id: "u1", name: "Kim" },
  { id: "u2", name: "Park" },
  { id: "u3", name: "Lee" },
];

async function listPreview() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["Form", "ListBox", "Button"]);
  const [form, list, button] = h.ids as [NodeId, NodeId, NodeId];
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
            { id: "f-email", key: "email", type: "email" },
          ],
          mockData: ROWS,
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
  h.flush();
  const names = () =>
    (h.session.collectionItems("users") as { name: string }[]).map(
      (item) => item.name,
    );
  const press = () =>
    act(() => {
      fireEvent.click(h.element(button)!);
    });
  const save = (name: string) => {
    const element = h.view.container.querySelector<HTMLFormElement>("form")!;
    const [nameInput, emailInput] = [...element.querySelectorAll("input")];
    act(() => {
      fireEvent.change(nameInput!, { target: { value: name } });
      fireEvent.change(emailInput!, { target: { value: "x@example.test" } });
    });
    act(() => {
      element
        .querySelector<HTMLButtonElement>('button[type="submit"]')!
        .click();
    });
  };
  return { ...h, form, list, button, names, press, save };
}

describe("useListData positions — the session", () => {
  it("insert · insertBefore · insertAfter · prepend put the item where the reference does", async () => {
    const h = await listPreview();
    act(() => {
      h.session.insert("users", { index: 1 }, { name: "A" });
      h.session.insert("users", { before: "u1" }, { name: "B" });
      h.session.insert("users", { after: "u3" }, { name: "C" });
      h.session.insert("users", "start", { name: "D" });
    });
    expect(h.names()).toEqual(["D", "B", "Kim", "A", "Park", "Lee", "C"]);
    // (An unknown key is reported, not a silent no-op.)
    expect(h.session.insert("users", { before: "u9" }, { name: "E" }).ok).toBe(
      false,
    );
    h.view.unmount();
  });

  it("move · moveBefore · moveAfter reorder by key", async () => {
    const h = await listPreview();
    act(() => {
      h.session.move("users", ["u3"], { index: 0 });
    });
    expect(h.names()).toEqual(["Lee", "Kim", "Park"]);
    act(() => {
      h.session.move("users", ["u3"], { after: "u2" });
    });
    expect(h.names()).toEqual(["Kim", "Park", "Lee"]);
    act(() => {
      h.session.move("users", ["u2", "u3"], { before: "u1" });
    });
    expect(h.names()).toEqual(["Park", "Lee", "Kim"]);
    expect(h.session.move("users", ["u9"], { index: 0 }).ok).toBe(false);
    h.view.unmount();
  });
});

describe("useListData positions — rules", () => {
  it("a Form's submit inserts at index 0; a Button moves, then removes the selected items", async () => {
    const h = await listPreview();
    h.workspace.execute(
      catalogInteractionsCommand(
        { ownerId: h.form },
        [
          catalogNewInteraction(
            { ownerId: h.form },
            "onSubmit",
            {
              opcode: "insert",
              collectionId: USERS,
              index: 0,
              value: "!event.formData",
            },
            h.workspace.newId,
          ),
        ],
        "Rules",
      ),
    );
    h.workspace.execute(
      catalogInteractionsCommand(
        { ownerId: h.button },
        [
          catalogNewInteraction(
            { ownerId: h.button },
            "onPress",
            {
              opcode: "moveAfter",
              collectionId: USERS,
              key: "u3",
              keys: "u1",
            },
            h.workspace.newId,
          ),
          catalogNewInteraction(
            { ownerId: h.button },
            "onPress",
            {
              opcode: "capability",
              target: { nodeId: h.list },
              capabilityId: "selectItem",
              value: "u2",
            },
            h.workspace.newId,
          ),
          catalogNewInteraction(
            { ownerId: h.button },
            "onPress",
            { opcode: "removeSelectedItems", collectionId: USERS },
            h.workspace.newId,
          ),
        ],
        "Rules",
      ),
    );
    h.flush();
    h.save("New");
    expect(h.names()).toEqual(["New", "Kim", "Park", "Lee"]);
    h.press();
    expect(h.names()).toEqual(["New", "Lee", "Kim"]);
    h.view.unmount();
  });

  it("the new rules pass the document check and reopen the same; an extra field is refused", async () => {
    const h = await listPreview();
    const actions: InteractionEntry["action"][] = [
      {
        opcode: "insert",
        collectionId: USERS,
        index: 1,
        value: "!event.formData",
      },
      {
        opcode: "insertBefore",
        collectionId: USERS,
        key: "u1",
        value: "!event.formData",
      },
      {
        opcode: "insertAfter",
        collectionId: USERS,
        key: "u1",
        value: "!event.formData",
      },
      { opcode: "prepend", collectionId: USERS, value: "!event.formData" },
      { opcode: "move", collectionId: USERS, key: "u1", toIndex: 2 },
      { opcode: "moveBefore", collectionId: USERS, key: "u1", keys: "u2" },
      { opcode: "moveAfter", collectionId: USERS, key: "u1", keys: "u2" },
      { opcode: "removeSelectedItems", collectionId: USERS },
    ];
    h.workspace.execute(
      catalogInteractionsCommand(
        { ownerId: h.button },
        actions.map((action) =>
          catalogNewInteraction(
            { ownerId: h.button },
            "onPress",
            action,
            h.workspace.newId,
          ),
        ),
        "Rules",
      ),
    );
    const library = await buildCodeCatalogLibrary();
    const exported = h.workspace.runtime.graph.exportDocument();
    const reopened = new CatalogGraph(structuredClone(exported), library);
    const stored = (graph: CatalogGraph) =>
      Object.values(graph.exportDocument().entries)
        .filter(
          (entry): entry is InteractionEntry => entry.kind === "interaction",
        )
        .map((entry) => entry.action.opcode)
        .sort();
    expect(stored(reopened)).toEqual(actions.map((a) => a.opcode).sort());
    const broken = structuredClone(exported);
    const rule = Object.values(broken.entries).find(
      (entry) => entry.kind === "interaction" && entry.action.opcode === "move",
    ) as InteractionEntry;
    (rule.action as unknown as Record<string, unknown>).extra = 1;
    expect(() => new CatalogGraph(broken, library)).toThrow();
    h.view.unmount();
  });
});

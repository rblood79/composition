import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DataCollectionId,
  InteractionEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { executeInteractionRule } from "../../../../../../packages/shared/src/interactions/dispatcher";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogListDataEventDefaults } from "../../../builder/catalogRuntime/interactions";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-281 user decision 3, second step — `useListData.update(key, newValue)` · `remove(...keys)`
 * on a collection, after `append`. The session replays the edits over the Builder's items (a
 * later `CATALOG_DATA` keeps them); an unknown key is reported, never a silent no-op.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const USERS = "data:collection:users" as DataCollectionId;

const warnings = () =>
  (console.warn as unknown as { mock?: { calls: unknown[][] } }).mock?.calls
    .map((call) => String(call[0]))
    .filter((message) => message.startsWith("[interactions]")) ?? [];

const data = (users: Record<string, unknown>[]) => ({
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
      mockData: users,
      useMockData: true,
    },
  ],
  variables: [],
  apiEndpoints: [],
});

const USERS_ROWS = [
  { id: "u1", name: "Kim", email: "kim@example.test" },
  { id: "u2", name: "Park", email: "park@example.test" },
];

async function listPreview() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["Form", "ListBox", "Button"]);
  const [form, list, button] = h.ids as [NodeId, NodeId, NodeId];
  act(() => {
    h.session.receive(data(USERS_ROWS));
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
  /** Fill the palette Form's Name · Email and press Save (the origin names the fields). */
  const save = (name: string, email: string) => {
    const element = h.view.container.querySelector<HTMLFormElement>("form")!;
    const [nameInput, emailInput] = [...element.querySelectorAll("input")];
    act(() => {
      fireEvent.change(nameInput!, { target: { value: name } });
      fireEvent.change(emailInput!, { target: { value: email } });
    });
    act(() => {
      element
        .querySelector<HTMLButtonElement>('button[type="submit"]')!
        .click();
    });
  };
  const press = () =>
    act(() => {
      fireEvent.click(h.element(button)!);
    });
  // (Not RAC's empty-state option — the list's IllustratedMessage, 2026-10-23.)
  const options = () =>
    [...(h.element(list)?.querySelectorAll('[role="option"]') ?? [])]
      .filter(
        (option) => !option.querySelector(".react-aria-IllustratedMessage"),
      )
      .map((option) => option.textContent ?? "");
  const items = () =>
    h.session.collectionItems("users") as Record<string, unknown>[];
  return { ...h, form, list, button, save, press, options, items };
}

describe("update · remove — storage", () => {
  it("update and remove rules pass and reopen the same; another key is refused", async () => {
    const h = await listPreview();
    h.rule(h.form, "onSubmit", {
      opcode: "update",
      collectionId: USERS,
      key: "u1",
      value: "!event.formData",
    });
    h.rule(h.button, "onPress", {
      opcode: "remove",
      collectionId: USERS,
      keys: "u2",
    });
    const library = await buildCodeCatalogLibrary();
    const exported = h.workspace.runtime.graph.exportDocument();
    const actions = (g: CatalogGraph) =>
      Object.values(g.exportDocument().entries)
        .filter(
          (entry): entry is InteractionEntry => entry.kind === "interaction",
        )
        .map((entry) => entry.action);
    expect(
      actions(new CatalogGraph(structuredClone(exported), library)),
    ).toEqual(actions(h.workspace.runtime.graph));
    for (const opcode of ["update", "remove"]) {
      const broken = structuredClone(exported);
      const rule = Object.values(broken.entries).find(
        (entry) =>
          entry.kind === "interaction" && entry.action.opcode === opcode,
      ) as InteractionEntry;
      (rule.action as unknown as Record<string, unknown>).extra = 1;
      expect(() => new CatalogGraph(broken, library)).toThrow();
    }
    h.view.unmount();
  });
});

describe("update · remove — execution", () => {
  it("a Form's Save updates the item with the key: its fields change, its id stays, the list shows it", async () => {
    const h = await listPreview();
    h.rule(h.form, "onSubmit", {
      opcode: "update",
      collectionId: USERS,
      key: "u1",
      value: "!event.formData",
    });
    h.save("Lee", "lee@example.test");
    expect(h.items()).toEqual([
      { id: "u1", name: "Lee", email: "lee@example.test" },
      USERS_ROWS[1],
    ]);
    expect(h.options()[0]).toContain("Lee");
    expect(warnings()).toEqual([]);
    h.view.unmount();
  });

  it("a Button removes the item with the key; an unknown key is reported and nothing changes", async () => {
    const h = await listPreview();
    h.rule(h.button, "onPress", {
      opcode: "remove",
      collectionId: USERS,
      keys: "u1",
    });
    h.press();
    expect(h.items()).toEqual([USERS_ROWS[1]]);
    expect(h.options()).toHaveLength(1);
    expect(warnings()).toEqual([]);
    // (u1 is gone now — the same rule names a key the collection no longer has.)
    h.press();
    expect(h.items()).toEqual([USERS_ROWS[1]]);
    expect(warnings()).toHaveLength(1);
    h.view.unmount();
  });

  it("append → update the appended item → remove one: the edits replay over the Builder's next data", async () => {
    const h = await listPreview();
    act(() => {
      h.session.append("users", { name: "Choi", email: "choi@example.test" });
    });
    const appended = h.items()[2]!;
    act(() => {
      h.session.update("users", String(appended.id), { name: "Choi Updated" });
      h.session.remove("users", ["u2"]);
    });
    const expected = [USERS_ROWS[0], { ...appended, name: "Choi Updated" }];
    expect(h.items()).toEqual(expected);
    act(() => {
      h.session.receive(data(USERS_ROWS));
    });
    expect(h.items()).toEqual(expected);
    expect(h.options()).toHaveLength(2);
    h.view.unmount();
  });

  it('update without a key takes the value\'s id; remove "all" empties the list', async () => {
    const h = await listPreview();
    act(() => {
      h.session.update("users", undefined, { id: "u2", name: "Park Updated" });
    });
    expect(h.items()[1]).toEqual({ ...USERS_ROWS[1], name: "Park Updated" });
    act(() => {
      h.session.remove("users", "all");
    });
    expect(h.items()).toEqual([]);
    expect(h.options()).toEqual([]);
    expect(
      h.element(h.list)?.querySelector(".react-aria-IllustratedMessage"),
    ).not.toBeNull();
    h.view.unmount();
  });
});

describe("update · remove — dispatcher key values", () => {
  const rule = (action: Record<string, unknown>) =>
    ({
      id: "r",
      type: "interaction",
      elementId: "e",
      trigger: "onSelectionChange",
      action,
    }) as never;

  it('remove takes a selection (a Set · "all") or one key from the event; update a scalar key', () => {
    const remove = vi.fn(() => ({ ok: true }));
    const update = vi.fn(() => ({ ok: true }));
    const deps = { remove, update } as never;
    executeInteractionRule(
      rule({ kind: "remove", collectionId: "users", keys: "!event.keys" }),
      deps,
      { event: { keys: new Set(["u1", "u2"]) } },
    );
    executeInteractionRule(
      rule({ kind: "remove", collectionId: "users", keys: "!event.keys" }),
      deps,
      { event: { keys: "all" } },
    );
    executeInteractionRule(
      rule({ kind: "remove", collectionId: "users", keys: "!event.key" }),
      deps,
      { event: { key: "u3" } },
    );
    expect(remove.mock.calls).toEqual([
      ["users", ["u1", "u2"]],
      ["users", "all"],
      ["users", ["u3"]],
    ]);
    executeInteractionRule(
      rule({
        kind: "update",
        collectionId: "users",
        key: "!event.key",
        value: "!event.value",
      }),
      deps,
      { event: { key: 7, value: { name: "x" } } },
    );
    expect(update.mock.calls).toEqual([["users", "7", { name: "x" }]]);
    const refused = executeInteractionRule(
      rule({ kind: "update", collectionId: "users", key: "u1", value: "text" }),
      deps,
    );
    expect(refused.ok).toBe(false);
  });
});

describe("update · remove — the panel's start values", () => {
  it("a Form's submit gives formData, a row action its key, a selection its keys", () => {
    const base = { collectionId: USERS };
    expect(
      catalogListDataEventDefaults({ opcode: "append", ...base }, ["formData"]),
    ).toEqual({ opcode: "append", ...base, value: "!event.formData" });
    expect(
      catalogListDataEventDefaults({ opcode: "update", ...base }, ["formData"]),
    ).toEqual({ opcode: "update", ...base, value: "!event.formData" });
    expect(
      catalogListDataEventDefaults({ opcode: "remove", ...base }, ["key"]),
    ).toEqual({ opcode: "remove", ...base, keys: "!event.key" });
    expect(
      catalogListDataEventDefaults({ opcode: "remove", ...base }, ["keys"]),
    ).toEqual({ opcode: "remove", ...base, keys: "!event.keys" });
    expect(
      catalogListDataEventDefaults({ opcode: "remove", ...base }, []),
    ).toEqual({ opcode: "remove", ...base });
  });
});

import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DataCollectionId,
  InteractionEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { catalogPreviewRules } from "../../../../../../packages/shared/src/catalog/runtime/catalogPreviewInteractions";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-281 user decision 3, second step — a rule appends to a collection (`useListData.append` — a Form's
 * submit → `append` with `!event.formData`). The item lives in the running Preview / Publish session only
 * (the author's data table is untouched): every component bound to that collection shows it at
 * once, a later `CATALOG_DATA` from the Builder keeps it, a reload drops it.
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
        { id: "f-age", key: "age", type: "number" },
      ],
      mockData: users,
      useMockData: true,
    },
    {
      id: "other",
      name: "Other",
      schema: [{ id: "o-name", key: "name", type: "string" }],
      mockData: [{ name: "untouched" }],
      useMockData: true,
    },
  ],
  variables: [],
  apiEndpoints: [],
});

async function insertPreview() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["Form", "ListBox", "ListBox"]);
  const [form, list, other] = h.ids as [NodeId, NodeId, NodeId];
  act(() => {
    h.session.receive(data([{ id: "u1", name: "Kim", age: 30 }]));
  });
  for (const [id, collectionId, name] of [
    [list, "users", "Users"],
    [other, "other", "Other"],
  ] as const)
    h.workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id }],
        catalogBindingRef({ source: "dataTable", collectionId, name })!,
      ),
    );
  h.flush();
  const formElement = () =>
    h.view.container.querySelector<HTMLFormElement>("form")!;
  /** Fill the palette Form's fields, name them `name` · `field1` … and submit. */
  const submit = (value: string) => {
    const element = formElement();
    element.querySelectorAll("input").forEach((input) => {
      act(() => {
        fireEvent.change(input, { target: { value } });
      });
    });
    element.querySelectorAll("input").forEach((input, index) => {
      input.removeAttribute("required");
      input.setAttribute("name", index === 0 ? "name" : `field${index}`);
    });
    act(() => {
      fireEvent.submit(element);
    });
  };
  const options = (id: NodeId) =>
    [...(h.element(id)?.querySelectorAll('[role="option"]') ?? [])].map(
      (option) => option.textContent ?? "",
    );
  return { ...h, form, list, other, submit, options };
}

describe("append — storage", () => {
  it("an append rule passes and reopens the same; another key is refused; the Preview rule names the collection without its prefix", async () => {
    const h = await insertPreview();
    h.rule(h.form, "onSubmit", {
      opcode: "append",
      collectionId: USERS,
      value: "!event.formData",
    });
    const graph = h.workspace.runtime.graph;
    const exported = graph.exportDocument();
    const library = await buildCodeCatalogLibrary();
    const reopened = new CatalogGraph(structuredClone(exported), library);
    const actions = (g: CatalogGraph) =>
      Object.values(g.exportDocument().entries)
        .filter(
          (entry): entry is InteractionEntry => entry.kind === "interaction",
        )
        .map((entry) => entry.action);
    expect(actions(reopened)).toEqual([
      { opcode: "append", collectionId: USERS, value: "!event.formData" },
    ]);
    const broken = structuredClone(exported);
    const rule = Object.values(broken.entries).find(
      (entry) => entry.kind === "interaction",
    ) as InteractionEntry;
    (rule.action as unknown as Record<string, unknown>).extra = 1;
    expect(() => new CatalogGraph(broken, library)).toThrow();
    const wrongRef = structuredClone(exported);
    (
      Object.values(wrongRef.entries).find(
        (entry) => entry.kind === "interaction",
      ) as unknown as { action: Record<string, unknown> }
    ).action.collectionId = "users";
    expect(() => new CatalogGraph(wrongRef, library)).toThrow();
    expect(
      catalogPreviewRules(h.session.graph!, h.session.root!)
        .filter((item) => item.action.kind === "append")
        .map((item) => item.action),
    ).toEqual([
      { kind: "append", collectionId: "users", value: "!event.formData" },
    ]);
    h.view.unmount();
  });
});

describe("append — the palette Form as placed", () => {
  it("fill Name · Email and press Save: the fields' names are the item's keys (the origin names them; Save submits, Cancel resets)", async () => {
    const h = await insertPreview();
    h.rule(h.form, "onSubmit", {
      opcode: "append",
      collectionId: USERS,
      value: "!event.formData",
    });
    const form = h.view.container.querySelector<HTMLFormElement>("form")!;
    const [name, email] = [...form.querySelectorAll("input")];
    expect([name!.name, email!.name]).toEqual(["name", "email"]);
    const buttons = [...form.querySelectorAll("button")];
    expect(buttons.map((button) => button.type)).toEqual(["reset", "submit"]);
    act(() => {
      fireEvent.change(name!, { target: { value: "Lee" } });
      fireEvent.change(email!, { target: { value: "lee@example.test" } });
    });
    act(() => {
      buttons[1]!.click();
    });
    expect(h.session.collectionItems("users")[1]).toMatchObject({
      name: "Lee",
      email: "lee@example.test",
    });
    expect(h.options(h.list)[1]).toContain("Lee");
    expect(warnings()).toEqual([]);
    h.view.unmount();
  });
});

describe("append — execution", () => {
  it("a Form's submit appends its fields as an item: the bound list shows it at once, items accumulate, another collection is untouched", async () => {
    const h = await insertPreview();
    h.rule(h.form, "onSubmit", {
      opcode: "append",
      collectionId: USERS,
      value: "!event.formData",
    });
    expect(h.options(h.list)).toHaveLength(1);
    h.submit("Lee");
    expect(h.options(h.list)).toHaveLength(2);
    expect(h.options(h.list)[1]).toContain("Lee");
    h.submit("Park");
    expect(h.options(h.list)).toHaveLength(3);
    expect(h.options(h.list)[2]).toContain("Park");
    expect(h.options(h.other)).toEqual([expect.stringContaining("untouched")]);
    expect(warnings()).toEqual([]);
    expect(h.toasts).toEqual([]);
    h.view.unmount();
  });

  it("the item takes the schema's fields only, a number field as a number, and an id when the schema has one", async () => {
    const h = await insertPreview();
    h.rule(h.form, "onSubmit", {
      opcode: "append",
      collectionId: USERS,
      value: "!event.formData",
    });
    h.submit("Lee");
    const users = h.session.collectionItems("users");
    expect(users).toHaveLength(2);
    const item = users[1] as Record<string, unknown>;
    // (The test names the palette Form's second field `field1` — not in the schema; `email` is
    // not sent, so the item has no email.)
    expect(Object.keys(item).sort()).toEqual(["id", "name"]);
    expect(item.name).toBe("Lee");
    expect(typeof item.id).toBe("string");
    expect(item.id).not.toBe("u1");
    act(() => {
      h.session.append("users", { name: "Choi", age: "42", extra: "x" });
    });
    expect(h.session.collectionItems("users")[2]).toMatchObject({
      name: "Choi",
      age: 42,
    });
    expect(h.session.collectionItems("users")[2]).not.toHaveProperty("extra");
    h.view.unmount();
  });

  it("the Builder's next data keeps the appended items (the Preview session holds them)", async () => {
    const h = await insertPreview();
    h.rule(h.form, "onSubmit", {
      opcode: "append",
      collectionId: USERS,
      value: "!event.formData",
    });
    h.submit("Lee");
    act(() => {
      h.session.receive(
        data([
          { id: "u1", name: "Kim", age: 30 },
          { id: "u9", name: "Choi", age: 41 },
        ]),
      );
    });
    expect(h.options(h.list)).toHaveLength(3);
    expect(h.options(h.list)[2]).toContain("Lee");
    h.view.unmount();
  });

  it("a value that is not a record, or a collection the project does not have, is reported — nothing is added", async () => {
    const h = await insertPreview();
    h.rule(h.form, "onSubmit", {
      opcode: "append",
      collectionId: USERS,
      value: "just text",
    });
    h.submit("Lee");
    expect(h.options(h.list)).toHaveLength(1);
    expect(warnings()).toHaveLength(1);
    h.rule(h.form, "onSubmit", {
      opcode: "append",
      collectionId: "data:collection:gone" as DataCollectionId,
      value: "!event.formData",
    });
    h.submit("Lee");
    expect(h.options(h.list)).toHaveLength(1);
    expect(warnings()).toHaveLength(2);
    h.view.unmount();
  });
});

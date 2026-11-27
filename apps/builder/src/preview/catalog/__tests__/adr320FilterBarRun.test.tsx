import { I18nProvider } from "../../../i18n/I18nProvider";
import { FilterDoField } from "../../../builder/panels/interactions/FilterDoField";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  EntryId,
  NodeId,
  ProjectEntry,
  StateVariableEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import { setFilterBarTargets } from "../../../../../../packages/shared/src/catalog/commands/filterBar";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import {
  catalogInteractionsCommand,
  catalogNewInteraction,
} from "../../../builder/catalogRuntime/interactions";
import { catalogVariableCommands } from "../../../builder/catalogRuntime/stateVariables";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-320 Phase 5 (G5 — breakdown §5.9) — a "FilterBar" in a running Preview with its state
 * connections: three Buttons whose press runs the bar's Dos (「조건 넣기」 · 「조건 지우기」 · 「전부
 * 지우기」), its named state (the applied conditions' count) and a When 「필터 변경」 rule writing a
 * page variable from `!event.count`. Expected rows are written by hand from the fixture.
 *
 * Fixture — u1 … u6: type A A B B C C, status male female male female male female.
 */
const HOME = "project:page:home" as EntryId<"page">;

afterEach(() => vi.restoreAllMocks());

const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

const USERS = {
  id: "users",
  name: "Users",
  schema: [
    { id: "f-id", key: "id", type: "string" },
    { id: "f-name", key: "name", type: "string" },
    { id: "f-type", key: "type", type: "string" },
    { id: "f-status", key: "status", type: "string" },
  ],
  mockData: ["A", "A", "B", "B", "C", "C"].map((type, index) => ({
    id: `u${index + 1}`,
    name: `User ${index + 1}`,
    type,
    status: index % 2 === 0 ? "male" : "female",
  })),
  runtimeData: [],
  useMockData: true,
};

const reports = () =>
  (console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls
    .map((call) => String(call[0]))
    .filter((message) => message.startsWith("[interactions]"));

async function open() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview([
    "FilterBar",
    "ListBox",
    "Button",
    "Button",
    "Button",
    "Button",
    "Text",
  ]);
  const [bar, list, add, remove, clear, refused, text] = h.ids as NodeId[];
  const { workspace } = h;
  const graph = workspace.runtime.graph;
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [USERS],
      variables: [],
      apiEndpoints: [],
    } as never);
  });
  workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id: list! }],
      catalogBindingRef({
        source: "dataTable",
        collectionId: "users",
        name: "Users",
      })!,
    ),
  );
  workspace.execute(setFilterBarTargets(bar!, [list!]));
  h.flush();
  await settle();

  const variableIds = (): readonly string[] =>
    (graph.getEntry(graph.projectId) as ProjectEntry).stateVariableIds ?? [];
  const before = new Set<string>(variableIds());
  workspace.execute(
    catalogVariableCommands.add(HOME, "changed", workspace.newId),
  );
  workspace.execute(
    catalogVariableCommands.nameSource(
      HOME,
      bar!,
      { prop: "appliedFilters", type: "number" },
      0,
      "applied",
      workspace.newId,
    ),
  );
  const variable = (name: string) =>
    variableIds()
      .filter((id) => !before.has(id))
      .map((id) => graph.getEntry(id as never) as StateVariableEntry)
      .find((entry) => entry.name === name)!;
  const owner = { ownerId: bar! };
  workspace.execute(
    catalogInteractionsCommand(
      owner,
      [
        catalogNewInteraction(
          owner,
          "onFilterChange",
          {
            opcode: "setState",
            variableId: variable("changed").id,
            op: "set",
            value: "!event.count",
          } as never,
          workspace.newId,
        ),
      ],
      "Rules",
    ),
  );
  const target = { nodeId: bar! };
  h.rule(add!, "onPress", {
    opcode: "capability",
    target,
    capabilityId: "addFilterCondition",
    value: { field: "f-type", op: "oneOf", value: ["A", "B"] },
  } as never);
  h.rule(remove!, "onPress", {
    opcode: "capability",
    target,
    capabilityId: "removeFilterCondition",
    value: "f-type",
  } as never);
  h.rule(clear!, "onPress", {
    opcode: "capability",
    target,
    capabilityId: "clearFilterConditions",
  } as never);
  h.rule(refused!, "onPress", {
    opcode: "capability",
    target,
    capabilityId: "addFilterCondition",
    value: { field: "f-gone", op: "equals", value: "x" },
  } as never);
  workspace.execute(
    setFields({
      targets: [{ kind: "node", id: text! }],
      props: {
        children: {
          kind: "set",
          value: "applied={{ applied }} changed={{ changed }}",
        },
      },
      label: "Edit properties",
    }),
  );
  h.flush();
  await settle();
  await waitFor(
    () =>
      expect(
        h.element(bar!)?.querySelector("button[aria-haspopup]"),
      ).toBeTruthy(),
    { timeout: 5000 },
  );
  const press = async (id: NodeId) => {
    act(() => void fireEvent.click(h.element(id)!));
    await settle();
  };
  return {
    ...h,
    bar: bar!,
    add: add!,
    remove: remove!,
    clear: clear!,
    refused: refused!,
    options: () =>
      [
        ...(h.element(list!)?.querySelectorAll('[role="option"]') ?? []),
      ].flatMap((item) => /User \d/.exec(item.textContent ?? "")?.[0] ?? []),
    readout: () => h.element(text!)!.textContent,
    press,
    /** A viewer's change (the chip line's write — not a rule's). */
    viewer: async (value: unknown) => {
      act(() => void h.session.tables.scopes.assign(bar!, value));
      await settle();
    },
  };
}

const STATUS_FEMALE = {
  id: "c-status",
  fields: [["data:field:f-status"]],
  op: "equals",
  value: "female",
};

describe("ADR-320 Phase 5 (G5) — a filter bar's When · Do · named state", () => {
  it("the Dos write the scope's tree; the named state follows; a Do does not run 「필터 변경」", async () => {
    const h = await open();
    expect(h.options()).toHaveLength(6);
    expect(h.readout()).toBe("applied=0 changed=");
    await h.press(h.add);
    expect(h.options()).toEqual(["User 1", "User 2", "User 3", "User 4"]);
    expect(h.readout()).toBe("applied=1 changed=");
    await h.press(h.remove);
    expect(h.options()).toHaveLength(6);
    expect(h.readout()).toBe("applied=0 changed=");
    await h.press(h.add);
    await h.press(h.clear);
    expect(h.options()).toHaveLength(6);
    expect(h.readout()).toBe("applied=0 changed=");
    expect(reports()).toEqual([]);
  });

  it("a viewer's change runs 「필터 변경」 with the count; a condition still without its value does not", async () => {
    const h = await open();
    const tree = h.session.tables.scopes.tree(h.bar);
    await h.viewer({
      id: tree?.id ?? "filter-scope",
      op: "and",
      items: [STATUS_FEMALE],
    });
    expect(h.options()).toEqual(["User 2", "User 4", "User 6"]);
    expect(h.readout()).toBe("applied=1 changed=1");
    // (A field picked, its value not yet entered — nothing more applies.)
    await h.viewer({
      id: "filter-scope",
      op: "and",
      items: [
        STATUS_FEMALE,
        { id: "c-type", fields: [["data:field:f-type"]], op: "oneOf" },
      ],
    });
    expect(h.readout()).toBe("applied=1 changed=1");
    // (The Do's condition on top of the viewer's: the rows of both, the When unchanged.)
    await h.press(h.add);
    expect(h.options()).toEqual(["User 2", "User 4"]);
    expect(h.readout()).toBe("applied=2 changed=1");
  });

  it("a condition the scope does not take is a failure — reported, the tree as it was", async () => {
    const h = await open();
    await h.press(h.add);
    await h.press(h.refused);
    expect(h.options()).toEqual(["User 1", "User 2", "User 3", "User 4"]);
    expect(h.session.tables.scopes.tree(h.bar)?.items).toHaveLength(1);
    expect(h.session.tables.scopes.refusedOf(h.bar)).toBe(0);
    expect(reports().join("\n")).toContain("addFilterCondition");
  });

  it("「필터 변경」 from the chip line: a field picked does nothing yet, a comparison that takes no value applies", async () => {
    const h = await open();
    const button = (name: string) =>
      [...h.element(h.bar)!.querySelectorAll("button")].find(
        (item) => item.textContent?.trim() === name,
      )!;
    act(() => void fireEvent.click(button("Add filter")));
    await settle();
    const item = (text: string) =>
      waitFor(() => {
        const found = [
          ...document.querySelectorAll(
            '[role="menuitem"], [role="menuitemradio"]',
          ),
        ].find((entry) => entry.textContent?.trim() === text);
        expect(found).toBeTruthy();
        return found as HTMLElement;
      });
    const status = await item("status");
    act(() => void fireEvent.click(status));
    await settle();
    expect(h.readout()).toBe("applied=0 changed=");
    const exists = await item("Has a value");
    act(() => void fireEvent.click(exists));
    await settle();
    expect(h.readout()).toBe("applied=1 changed=1");
    expect(h.options()).toHaveLength(6);
  });
});

it("a field removal rule removes the field inside a nested group", async () => {
  const h = await open();
  await h.viewer({
    id: "filter-scope",
    op: "and",
    items: [
      {
        id: "g1",
        op: "and",
        items: [
          STATUS_FEMALE,
          {
            id: "c-type",
            fields: [["data:field:f-type"]],
            op: "equals",
            value: "A",
          },
        ],
      },
    ],
  });
  expect(h.options()).toEqual(["User 2"]);
  await h.press(h.remove);
  expect(reports()).toEqual([]);
  expect(h.options()).toEqual(["User 2", "User 4", "User 6"]);
});

it("the rule parameter panel can author the same literal multi-value filter that the runtime accepts", async () => {
  const h = await open();
  const field = { id: "f-type", label: "Type", type: "string", hidden: false };
  let arg: unknown = { field: "f-type", op: "oneOf", value: ["A", "B"] };
  const panel = render(
    <I18nProvider initialLocale="en-US">
      <FilterDoField
        fields={[field]}
        kind="filter-condition"
        value={arg}
        onChange={(v) => (arg = v)}
      />
    </I18nProvider>,
  );
  const input = panel.container.querySelector(
    'input[type="text"], input:not([type])',
  )!;
  expect((input as HTMLInputElement).value).toBe("A,B");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "A,C" } });
  fireEvent.keyDown(input, { key: "Enter" });
  fireEvent.blur(input);
  expect(arg).toEqual({ field: "f-type", op: "oneOf", value: ["A", "C"] });
  h.rule(h.add, "onPress", {
    opcode: "capability",
    target: { nodeId: h.bar },
    capabilityId: "addFilterCondition",
    value: arg,
  } as never);
  h.flush();
  await settle();
  await h.press(h.add);

  expect(h.options()).toEqual(["User 1", "User 2", "User 5", "User 6"]);
});

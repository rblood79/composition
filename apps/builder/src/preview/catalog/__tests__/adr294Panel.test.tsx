import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addRecord,
  createComponent,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import type {
  EntryId,
  InteractionEntry,
  NodeEntry,
  NodeId,
  StateVariableEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { eventArgsOf, exposedTriggerGroups } from "@composition/shared";
import { I18nProvider } from "../../../i18n";
import {
  catalogInstanceEventRows,
  catalogInstanceVariableRows,
  catalogPropertyCommands,
  catalogPropertyView,
} from "../../../builder/catalogRuntime/componentProperties";
import {
  catalogDefaultAction,
  catalogEmitEvents,
  catalogReceivedEvents,
  catalogVisibleVariables,
} from "../../../builder/catalogRuntime/interactions";
import { CatalogWorkspaceProvider } from "../../../builder/catalogRuntime/react";
import { CatalogInteractionsPanel } from "../../../builder/panels/interactions/catalog/CatalogInteractionsPanel";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-294 Phase 2 (G2) — the panels offer a component's events and variables: the origin root makes
 * them (Properties), an origin rule sends an event (Interactions Do), an instance receives it
 * (Interactions When 「컴포넌트」 group · its Properties row), a Set state never offers an input
 * variable, and an origin rule's Set state says how to reach the using screen (KO · EN).
 */
const BODY = "project:node:home-body" as NodeId;

afterEach(() => {
  vi.restoreAllMocks();
});

async function openPicker() {
  const h = await openAdr280Preview(["Button"]);
  const graph = () => h.workspace.runtime.graph;
  const run = (command: Parameters<typeof h.workspace.execute>[0]) =>
    act(() => {
      h.workspace.execute(command);
    });
  run(
    createComponent({
      id: h.ids[0] as NodeId,
      name: "Picker",
      newId: h.workspace.newId,
    }),
  );
  const project = graph().getEntry(graph().projectId);
  const definitionId = (
    project?.kind === "project" ? project.definitionIds.at(-1) : ""
  ) as EntryId<"definition">;
  const instance = (graph().getEntry(BODY) as NodeEntry).children[0]!;
  const origin = (graph().getEntry(definitionId) as { templateRootId: NodeId })
    .templateRootId;
  const props = () => catalogPropertyView(graph(), origin, undefined)!;
  return { ...h, graph, run, definitionId, instance, origin, props };
}

describe("ADR-294 G2 — Properties: the origin root makes an event · a variable", () => {
  it("the origin root's commands make each; the rows name the kind and an event's receivers", async () => {
    const h = await openPicker();
    expect(h.props().isRoot).toBe(true);
    h.run(catalogPropertyCommands.createEvent(h.props().origin, "select"));
    h.run(
      catalogPropertyCommands.createVariable(
        h.props().origin,
        "role",
        h.workspace.newId,
      ),
    );
    const rows = h.props().rows;
    expect(rows.map((row) => [row.name, row.kind])).toEqual([
      ["select", "event"],
      ["role", "variable"],
    ]);
    expect(rows[0]!.receivers).toBe(0);
    // (The variable property's input variable: the origin root's, keyed back to it.)
    const definition = h.graph().getEntry(h.definitionId) as unknown as {
      properties: { variableId?: string }[];
    };
    const variable = h
      .graph()
      .getEntry(definition.properties[1]!.variableId!) as StateVariableEntry;
    expect(variable).toMatchObject({
      ownerId: h.origin,
      input: { propertyKey: rows[1]!.key },
    });
    // An instance's receiving rule counts.
    h.run(
      addRecord({
        entry: {
          kind: "interaction",
          id: "project:interaction:receive" as EntryId<"interaction">,
          ownerId: h.instance as NodeId,
          trigger: `property:${rows[0]!.key}`,
          actions: [{ opcode: "toast", message: "got it" }],
        } as InteractionEntry,
      }),
    );
    expect(h.props().rows[0]!.receivers).toBe(1);
    expect(
      catalogInstanceEventRows(h.graph(), {
        kind: "node",
        id: h.instance as NodeId,
      }),
    ).toEqual([{ key: rows[0]!.key, name: "select", rules: 1 }]);
    h.view.unmount();
  });
});

describe("ADR-294 G2 — Interactions: When 「컴포넌트」 · Do 「컴포넌트 이벤트 보내기」 · Set state", () => {
  it("an instance receives (its When group first), an origin node sends; a page node does neither", async () => {
    const h = await openPicker();
    h.run(catalogPropertyCommands.createEvent(h.props().origin, "select"));
    const key = h.props().rows[0]!.key;
    expect(
      catalogReceivedEvents(h.graph(), { ownerId: h.instance as NodeId }),
    ).toEqual([{ key, name: "select" }]);
    expect(catalogEmitEvents(h.graph(), { ownerId: h.origin })).toEqual([
      { key, name: "select" },
    ]);
    expect(catalogEmitEvents(h.graph(), { ownerId: BODY })).toBeUndefined();
    expect(catalogReceivedEvents(h.graph(), { ownerId: BODY })).toEqual([]);
    const groups = exposedTriggerGroups(
      "Button",
      { props: {} },
      { componentEvents: [`property:${key}`] },
    );
    expect(groups[0]).toEqual({ id: "component", events: [`property:${key}`] });
    // (Its argument is `value` — what the value pickers offer as the event's value — whatever the
    // instance's root type; found by the G5 live: the picker listed variables only.)
    for (const root of ["Button", "frame", "ListBox"])
      expect(eventArgsOf(root, `property:${key}`)).toEqual(["value"]);
    h.view.unmount();
  });

  it("a Set state never offers or starts from a component's input variable", async () => {
    const h = await openPicker();
    h.run(
      catalogPropertyCommands.createVariable(
        h.props().origin,
        "role",
        h.workspace.newId,
      ),
    );
    const variables = catalogVisibleVariables(h.graph(), h.origin);
    expect(variables.find((item) => item.name === "role")?.readOnly).toBe(true);
    const start = catalogDefaultAction("setState", {
      pages: [],
      currentPageId: undefined,
      variables,
      targets: () => [],
    });
    expect(start).toBeUndefined();
    h.view.unmount();
  });

  it.each([
    ["en-US", "send select", "add an event to its component properties"],
    ["ko-KR", "select 보내기", "컴포넌트 속성에 이벤트를 만들고"],
  ] as const)(
    "%s — the instance adds a 「컴포넌트」 rule; the origin's emit rule reads 「send」; its Set state says how to reach the screen",
    async (locale, sendText, hintText) => {
      const h = await openPicker();
      h.run(catalogPropertyCommands.createEvent(h.props().origin, "select"));
      const key = h.props().rows[0]!.key;
      const page: StateVariableEntry = {
        kind: "stateVariable",
        id: "project:stateVariable:own" as EntryId<"stateVariable">,
        ownerId: h.origin,
        name: "own",
        valueType: "string",
        defaultValue: "",
      };
      h.run(addRecord({ entry: page }));
      h.run(
        addRecord({
          entry: {
            kind: "interaction",
            id: "project:interaction:send" as EntryId<"interaction">,
            ownerId: h.origin,
            trigger: "onPress",
            actions: [{ opcode: "emit", propertyKey: key, value: "x" }],
          } as InteractionEntry,
        }),
      );
      h.run(
        addRecord({
          entry: {
            kind: "interaction",
            id: "project:interaction:set" as EntryId<"interaction">,
            ownerId: h.origin,
            trigger: "onPress",
            actions: [
              {
                opcode: "setState",
                variableId: page.id,
                op: "set",
                value: "a",
              },
            ],
          } as InteractionEntry,
        }),
      );
      // (The origin: its Local page record — the definition's template root.)
      const panel = (selected: string, definitionView?: EntryId<"definition">) => {
        // (The origin is drawn by the definition view — its template root's own record.)
        act(() => {
          h.workspace.showDefinition(definitionView);
        });
        const record = h.workspace.root.recordsOfSource(selected)[0]!;
        act(() => {
          h.workspace.selectRecords([record]);
        });
        return render(
          <I18nProvider initialLocale={locale}>
            <CatalogWorkspaceProvider workspace={h.workspace}>
              <CatalogInteractionsPanel />
            </CatalogWorkspaceProvider>
          </I18nProvider>,
        );
      };
      const origin = panel(h.origin, h.definitionId);
      expect(screen.getByText((text) => text.includes(sendText))).toBeTruthy();
      const toggles = screen.getAllByRole("button", { expanded: false });
      await act(async () => {
        fireEvent.click(toggles[1]!);
      });
      expect(screen.getByRole("status").textContent).toContain(hintText);
      origin.unmount();
      // The instance: Add starts from its component's event.
      panel(h.instance);
      const add = screen
        .getAllByRole("button")
        .find((button) =>
          /^(Add event|Add|이벤트 추가|추가)$/i.test(
            button.getAttribute("aria-label") ?? "",
          ),
        );
      await act(async () => {
        fireEvent.click(add!);
      });
      const project = h.graph().getEntry(h.graph().projectId);
      const triggers =
        project?.kind === "project"
          ? project.interactionIds
              .map((id) => h.graph().getEntry(id) as InteractionEntry)
              .filter((rule) => rule.ownerId === h.instance)
              .map((rule) => rule.trigger)
          : [];
      expect(triggers).toEqual([`property:${key}`]);
      h.view.unmount();
    },
  );
});

describe("ADR-294 G2 · Phase 4 — the instance's variable row (value from · now)", () => {
  it("a typed value · a referenced variable of the same type; what the origin reads now", async () => {
    const h = await openPicker();
    h.run(
      catalogPropertyCommands.createVariable(
        h.props().origin,
        "role",
        h.workspace.newId,
      ),
    );
    const key = h.props().rows[0]!.key;
    const page = (id: string, valueType: "string" | "number", defaultValue: string | number) => {
      const entry = {
        kind: "stateVariable",
        id: `project:stateVariable:${id}`,
        ownerId: "project:page:home",
        name: id,
        valueType,
        defaultValue,
      } as StateVariableEntry;
      h.run(addRecord({ entry }));
      return entry.id;
    };
    const filter = page("filter", "string", "editor");
    page("count", "number", 1);
    const rows = () =>
      catalogInstanceVariableRows(h.graph(), h.instance as NodeId);
    expect(rows()[0]).toMatchObject({ name: "role", now: "" });
    expect(rows()[0]!.candidates.map((item) => item.name)).toEqual(["filter"]);
    h.run(
      setFields({
        targets: [{ kind: "node", id: h.instance as NodeId }],
        props: { [key]: { kind: "set", value: "admin" } },
      }),
    );
    expect(rows()[0]).toMatchObject({ now: "admin" });
    h.run(
      setFields({
        targets: [{ kind: "node", id: h.instance as NodeId }],
        props: { [key]: { kind: "set", value: `!var.${filter}` } },
      }),
    );
    expect(rows()[0]).toMatchObject({ reference: filter, now: "editor" });
    h.view.unmount();
  });
});

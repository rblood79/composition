import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addComponentOutputProperty,
  addRecord,
  createComponent,
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import type {
  EntryId,
  InteractionEntry,
  NodeEntry,
  NodeId,
  StateVariableEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  closeOverInputs,
  inputVariableDependencies,
} from "../../../../../../packages/shared/src/catalog/runtime/inputVariable";
import { catalogBindingQuery } from "../../../../../../packages/shared/src/catalog/runtime/viewQuery";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-294 Phase 4 (G1 · R4) — a component's variable property on the whole Builder → Preview path:
 * inside the origin the input variable is the value the instance passes (a literal, or a page
 * variable it references), in every reader — the `{{ }}` text (Canvas: the default of what it
 * references · Preview: the runtime value), a rule's `!var`, a view's `!var` — and a change of
 * the referenced variable reaches the origin's readers. Measurement: jsdom + the Builder
 * workspace → channel → Preview session (synthetic fixture).
 */
const HOME = "project:page:home" as EntryId<"page">;
const BODY = "project:node:home-body" as NodeId;

afterEach(() => vi.restoreAllMocks());

/** "Badge" (origin = a Button whose label reads `{{ role }}`) placed twice: J1 · J2. */
async function open() {
  const h = await openAdr280Preview(["Button", "Button"]);
  const graph = () => h.workspace.runtime.graph;
  const run = (command: Parameters<typeof h.workspace.execute>[0]) => {
    act(() => {
      h.workspace.execute(command);
    });
    h.flush();
  };
  const [originButton, setter] = h.ids as [NodeId, NodeId];
  run(
    createComponent({
      id: originButton,
      name: "Badge",
      newId: h.workspace.newId,
    }),
  );
  const project = graph().getEntry(graph().projectId);
  const definitionId = (
    project?.kind === "project" ? project.definitionIds.at(-1) : ""
  ) as EntryId<"definition">;
  const J1 = (graph().getEntry(BODY) as NodeEntry).children[0]! as NodeId;
  const origin = (graph().getEntry(definitionId) as { templateRootId: NodeId })
    .templateRootId;
  const role = "project:stateVariable:role" as EntryId<"stateVariable">;
  run(
    addComponentOutputProperty({
      definitionId,
      key: "role",
      name: "role",
      kind: "variable",
      variable: { id: role, valueType: "string", defaultValue: "guest" },
    }),
  );
  run(
    addComponentOutputProperty({
      definitionId,
      key: "select",
      name: "select",
      kind: "event",
    }),
  );
  run(
    setFields({
      targets: [{ kind: "node", id: origin }],
      props: { label: { kind: "set", value: "Role {{ role }}" } },
    }),
  );
  const J2 = "project:node:j2" as NodeId;
  run(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: J2,
          definitionId,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as unknown as NodeEntry,
      ],
      rootIds: [J2],
      newId: h.workspace.newId,
    }),
  );
  const pageVariable = (name: string, defaultValue: string) => {
    const entry: StateVariableEntry = {
      kind: "stateVariable",
      id: `project:stateVariable:${name}` as EntryId<"stateVariable">,
      ownerId: HOME,
      name,
      valueType: "string",
      defaultValue,
    };
    run(addRecord({ entry }));
    return entry.id;
  };
  const roleFilter = pageVariable("roleFilter", "editor");
  const picked = pageVariable("picked", "");
  run(
    setFields({
      targets: [{ kind: "node", id: J1 }],
      props: { role: { kind: "set", value: "admin" } },
    }),
  );
  run(
    setFields({
      targets: [{ kind: "node", id: J2 }],
      props: { role: { kind: "set", value: `!var.${roleFilter}` } },
    }),
  );
  let next = 0;
  const rule = (
    ownerId: string,
    trigger: string,
    actions: InteractionEntry["actions"],
  ) =>
    run(
      addRecord({
        entry: {
          kind: "interaction",
          id: `project:interaction:r${(next += 1)}` as EntryId<"interaction">,
          ownerId: ownerId as NodeId,
          trigger,
          actions,
        } as InteractionEntry,
      }),
    );
  /** The text the Preview shows for an instance. */
  const shown = (instance: string) =>
    h.element(instance as NodeId)?.textContent ?? "";
  /** The text the Canvas resolves for an instance (the Builder root's record — defaults). */
  const canvas = (instance: string) => {
    const root = h.workspace.root;
    const records = [...root.domInputs.values()].filter(
      (record) =>
        (record.instancePath as readonly string[]).includes(instance) ||
        record.sourceId === instance,
    );
    return records
      .map((record) => record.props.children ?? record.props.label)
      .filter((text): text is string => typeof text === "string")
      .join(" ");
  };
  return {
    ...h,
    graph,
    run,
    definitionId,
    origin,
    J1,
    J2,
    role,
    roleFilter,
    picked,
    setter,
    rule,
    shown,
    canvas,
  };
}

const press = (element: Element | null | undefined) =>
  act(() => {
    fireEvent.click(element!);
  });

describe("ADR-294 G1 · R4 — an origin reads its instance's variable property", () => {
  it("text: J1's literal · J2's referenced page variable — the Preview and the Canvas", async () => {
    const h = await open();
    expect(h.shown(h.J1)).toContain("Role admin");
    expect(h.shown(h.J2)).toContain("Role editor");
    // (The Canvas: the literal · the referenced variable's default.)
    expect(h.canvas(h.J1)).toContain("Role admin");
    expect(h.canvas(h.J2)).toContain("Role editor");
    h.view.unmount();
  });

  it("a write of the referenced page variable reaches the origin's text (J2 only)", async () => {
    const h = await open();
    h.rule(h.setter, "onPress", [
      {
        opcode: "setState",
        variableId: h.roleFilter,
        op: "set",
        value: "viewer",
      },
    ]);
    press(h.element(h.setter));
    expect(h.shown(h.J2)).toContain("Role viewer");
    expect(h.shown(h.J1)).toContain("Role admin");
    h.view.unmount();
  });

  it("a rule's !var.role reads the pressed instance's value (emit → the page)", async () => {
    const h = await open();
    h.rule(h.origin, "onPress", [
      { opcode: "emit", propertyKey: "select", value: `!var.${h.role}` },
    ]);
    for (const instance of [h.J1, h.J2])
      h.rule(instance, "property:select", [
        {
          opcode: "setState",
          variableId: h.picked,
          op: "set",
          value: "!event.value",
        },
      ]);
    const picked = () =>
      h.session.readState(h.picked, { kind: "page", pageId: HOME });
    press(h.element(h.J1));
    expect(picked()).toBe("admin");
    press(h.element(h.J2));
    expect(picked()).toBe("editor");
    h.view.unmount();
  });

  it("the runtime state refuses a write of the input variable (read only)", async () => {
    const h = await open();
    expect(
      h.session.writeState({ variableId: h.role, op: "set", value: "x" }),
    ).toMatchObject({ ok: false, reason: "input-read-only" });
    h.view.unmount();
  });

  it("a view inside the origin reads each instance's value; a change closes over the input variable", async () => {
    const h = await open();
    const graph = h.graph();
    const binding = {
      collectionId: "data:collection:users",
      view: {
        where: {
          op: "and",
          items: [{ field: "role", op: "eq", value: `!var.${h.role}` }],
        },
      },
    } as never;
    const at = (instance: string) =>
      catalogBindingQuery(graph, binding, h.origin, undefined, undefined, [
        BODY,
        instance,
      ])?.values[`!var.${h.role}`];
    expect(at(h.J1)).toBe("admin");
    expect(at(h.J2)).toBe("editor");
    // (No instance on the path — the origin itself: the default.)
    expect(
      catalogBindingQuery(graph, binding, h.origin, undefined)?.values[
        `!var.${h.role}`
      ],
    ).toBe("guest");
    // (roleFilter → role: the readers of `role` refresh when roleFilter changes.)
    const closed = closeOverInputs(
      new Set(["roleFilter"]),
      inputVariableDependencies(graph),
    );
    expect([...closed]).toEqual(expect.arrayContaining(["role", h.role]));
    h.view.unmount();
  });
});

describe("ADR-294 regression — nested input overrides", () => {
  async function nested() {
    const h = await open();
    h.run(
      createComponent({ id: h.J1, name: "Outer", newId: h.workspace.newId }),
    );
    const outer = (h.graph().getEntry(BODY) as NodeEntry)
      .children[0]! as NodeId;
    const node = h.graph().getEntry(outer) as NodeEntry;
    const definition = h
      .graph()
      .getEntry(node.definitionId as never) as unknown as {
      templateRootId: NodeId;
    };
    const inner = definition.templateRootId;
    const target = {
      kind: "descendant" as const,
      ownerId: outer,
      address: { instances: [outer], templatePath: [inner] },
    };
    return { ...h, outer, inner, target };
  }

  it("uses the nested occurrence's literal in Canvas, Preview, rule values and view values; Undo/Redo restores it", async () => {
    const h = await nested();
    h.rule(h.origin, "onPress", [
      { opcode: "emit", propertyKey: "select", value: `!var.${h.role}` },
    ]);
    h.rule(h.inner, "property:select", [
      {
        opcode: "setState",
        variableId: h.picked,
        op: "set",
        value: "!event.value",
      },
    ]);
    h.run(
      setFields({
        targets: [h.target],
        props: { role: { kind: "set", value: "override-value" } },
      }),
    );
    expect(h.shown(h.outer)).toContain("Role override-value");
    expect(h.canvas(h.outer)).toContain("Role override-value");
    // The sibling instance of the same definition keeps its independent input.
    expect(h.shown(h.J2)).toContain("Role editor");
    press(h.element(h.outer));
    expect(h.session.readState(h.picked, { kind: "page", pageId: HOME })).toBe(
      "override-value",
    );
    const binding = {
      collectionId: "data:collection:users",
      view: {
        where: {
          op: "and",
          items: [{ field: "role", op: "eq", value: `!var.${h.role}` }],
        },
      },
    } as never;
    expect(
      catalogBindingQuery(h.graph(), binding, h.origin, undefined, undefined, [
        BODY,
        h.outer,
        h.inner,
      ])?.values[`!var.${h.role}`],
    ).toBe("override-value");
    act(() => {
      h.workspace.undo();
    });
    h.flush();
    expect(h.shown(h.outer)).toContain("Role admin");
    act(() => {
      h.workspace.redo();
    });
    h.flush();
    expect(h.shown(h.outer)).toContain("Role override-value");
    // A JSON document snapshot reconstructs the same occurrence after persistence/load.
    act(() => {
      const graph = h.graph();
      h.session.receive({
        type: "CATALOG_SNAPSHOT",
        version: 1,
        projectId: graph.projectId,
        revision: graph.revision,
        document: JSON.parse(JSON.stringify(graph.exportDocument())),
      });
    });
    expect(h.shown(h.outer)).toContain("Role override-value");
    h.view.unmount();
  });

  it("tracks a reference authored only in a descendant override, including subsequent runtime writes", async () => {
    const h = await nested();
    h.run(
      setFields({
        targets: [{ kind: "node", id: h.J2 }],
        props: { role: { kind: "set", value: "sibling" } },
      }),
    );
    h.run(
      setFields({
        targets: [h.target],
        props: { role: { kind: "set", value: `!var.${h.roleFilter}` } },
      }),
    );
    const closed = closeOverInputs(
      new Set([h.roleFilter]),
      inputVariableDependencies(h.graph()),
    );
    expect(closed.has(h.role)).toBe(true);
    expect(h.shown(h.outer)).toContain("Role editor");
    act(() => {
      h.session.writeState({
        variableId: h.roleFilter,
        op: "set",
        value: "viewer",
      });
    });
    expect(h.shown(h.outer)).toContain("Role viewer");
    expect(h.canvas(h.outer)).toContain("Role editor");
    // Removing the addressed write restores the inner instance's own literal.
    h.run(
      setFields({ targets: [h.target], props: { role: { kind: "remove" } } }),
    );
    expect(h.shown(h.outer)).toContain("Role admin");
    h.view.unmount();
  });
});

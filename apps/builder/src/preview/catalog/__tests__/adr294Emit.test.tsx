import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addComponentOutputProperty,
  addRecord,
  createComponent,
  insertNodes,
  removeComponentProperty,
  removeRecords,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import type {
  EntryId,
  InteractionEntry,
  NodeEntry,
  NodeId,
  StateVariableEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { componentBoundariesOf } from "../../../../../../packages/shared/src/catalog/runtime/componentBoundaries";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-294 Phase 1 (G1) — a component's event on the whole Builder → Preview path: an origin rule
 * `emit`s, the instance that holds it receives on `property:<key>` (breakdown §3). Measurement:
 * jsdom + the Builder workspace → channel → Preview session (synthetic fixture — "which rule runs,
 * once, with what value" only).
 */
const HOME = "project:page:home" as EntryId<"page">;
const BODY = "project:node:home-body" as NodeId;

afterEach(() => {
  vi.restoreAllMocks();
});

const press = (element: Element | null | undefined) =>
  act(() => {
    fireEvent.click(element!);
  });

type Harness = Awaited<ReturnType<typeof openAdr280Preview>>;

function helpers(h: Harness) {
  const graph = () => h.workspace.runtime.graph;
  let next = 0;
  const run = (command: Parameters<typeof h.workspace.execute>[0]) => {
    act(() => {
      h.workspace.execute(command);
    });
    h.flush();
  };
  const lastDefinition = () => {
    const project = graph().getEntry(graph().projectId);
    return (
      project?.kind === "project" ? project.definitionIds.at(-1)! : ""
    ) as EntryId<"definition">;
  };
  const bodyChildren = () => (graph().getEntry(BODY) as NodeEntry).children;
  const rule = (
    ownerId: string,
    trigger: string,
    actions: InteractionEntry["actions"],
    address?: InteractionEntry["address"],
  ) => {
    const id = `project:interaction:r${(next += 1)}` as EntryId<"interaction">;
    run(
      addRecord({
        entry: {
          kind: "interaction",
          id,
          ownerId: ownerId as NodeId,
          ...(address ? { address } : {}),
          trigger,
          actions,
        } as InteractionEntry,
      }),
    );
    return id;
  };
  const place = (definitionId: string, id: string) => {
    run(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            kind: "node",
            id: id as NodeId,
            definitionId,
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as unknown as NodeEntry,
        ],
        rootIds: [id as NodeId],
        newId: h.workspace.newId,
      }),
    );
  };
  const event = (definitionId: EntryId<"definition">, key = "select") =>
    run(
      addComponentOutputProperty({
        definitionId,
        key,
        name: key,
        kind: "event",
      }),
    );
  const toast = (message: string) => [{ opcode: "toast" as const, message }];
  return {
    graph,
    run,
    lastDefinition,
    bodyChildren,
    rule,
    place,
    event,
    toast,
  };
}

/** "Picker" (origin = a Button) placed twice: J1, J2. */
async function openPicker() {
  const h = await openAdr280Preview(["Button"]);
  const x = helpers(h);
  x.run(
    createComponent({
      id: h.ids[0] as NodeId,
      name: "Picker",
      newId: h.workspace.newId,
    }),
  );
  const definitionId = x.lastDefinition();
  const J1 = x.bodyChildren()[0]!;
  const J2 = "project:node:j2";
  x.place(definitionId, J2);
  const origin = (
    x.graph().getEntry(definitionId) as { templateRootId: NodeId }
  ).templateRootId;
  x.event(definitionId);
  return { ...h, ...x, definitionId, J1, J2, origin };
}

describe("ADR-294 G1 — an instance receives its component's event", () => {
  it("of two instances of one component, only the pressed one's rule runs — once", async () => {
    const h = await openPicker();
    h.rule(h.origin, "onPress", [
      { opcode: "emit", propertyKey: "select", value: "v" },
    ]);
    h.rule(h.J1, "property:select", h.toast("one"));
    h.rule(h.J2, "property:select", h.toast("two"));
    press(h.element(h.J1 as NodeId));
    expect(h.toasts).toEqual(["one"]);
    press(h.element(h.J2 as NodeId));
    expect(h.toasts).toEqual(["one", "two"]);
    h.view.unmount();
  });

  it("the value goes as !event.value — a page variable takes it", async () => {
    const h = await openPicker();
    const picked: StateVariableEntry = {
      kind: "stateVariable",
      id: "project:stateVariable:picked" as EntryId<"stateVariable">,
      ownerId: HOME,
      name: "picked",
      valueType: "string",
      defaultValue: "",
    };
    h.run(addRecord({ entry: picked }));
    h.rule(h.origin, "onPress", [
      { opcode: "emit", propertyKey: "select", value: "admin" },
    ]);
    h.rule(h.J1, "property:select", [
      {
        opcode: "setState",
        variableId: picked.id,
        op: "set",
        value: "!event.value",
      },
    ]);
    press(h.element(h.J1 as NodeId));
    expect(h.session.readState(picked.id, { kind: "page", pageId: HOME })).toBe(
      "admin",
    );
    h.view.unmount();
  });

  it("no receiving rule = nothing runs and nothing is reported (listeners 0 — a success)", async () => {
    const h = await openPicker();
    const warn = vi.spyOn(console, "warn");
    h.rule(h.origin, "onPress", [
      { opcode: "emit", propertyKey: "select" },
      { opcode: "toast", message: "after" },
    ]);
    press(h.element(h.J1 as NodeId));
    // (The rule went on past the emit: it succeeded.)
    expect(h.toasts).toEqual(["after"]);
    expect(
      warn.mock.calls.filter((call) =>
        String(call[0]).includes("[interactions]"),
      ),
    ).toEqual([]);
    h.view.unmount();
  });

  it("an instance that turned the origin rule off sends nothing", async () => {
    const h = await openPicker();
    const origin = h.rule(h.origin, "onPress", [
      { opcode: "emit", propertyKey: "select" },
    ]);
    h.rule(h.J1, "property:select", h.toast("one"));
    h.rule(h.J2, "property:select", h.toast("two"));
    // (ADR-281 Decision 4 — the instance's patch at the origin root: this rule "off".)
    const J2 = h.graph().getEntry(h.J2) as NodeEntry;
    h.run((reader) => ({
      label: "Turn off",
      ops: [
        {
          kind: "put",
          entry: {
            ...(reader.getEntry(h.J2) as NodeEntry),
            descendantOverrides: [
              ...J2.descendantOverrides,
              {
                kind: "patch",
                address: {
                  instances: [h.J2 as NodeId],
                  templatePath: [h.origin],
                },
                interactions: { [origin]: "off" },
              },
            ],
          },
        },
      ],
    }));
    press(h.element(h.J2 as NodeId));
    expect(h.toasts).toEqual([]);
    press(h.element(h.J1 as NodeId));
    expect(h.toasts).toEqual(["one"]);
    h.view.unmount();
  });

  it("deleting the event property takes its emit Do and the receiving rules with it", async () => {
    const h = await openPicker();
    const emitting = h.rule(h.origin, "onPress", [
      { opcode: "emit", propertyKey: "select" },
      { opcode: "toast", message: "kept" },
    ]);
    const receiving = h.rule(h.J1, "property:select", h.toast("one"));
    h.run(
      removeComponentProperty({ definitionId: h.definitionId, key: "select" }),
    );
    expect(h.graph().getEntry(receiving)).toBeUndefined();
    expect(
      (h.graph().getEntry(emitting) as InteractionEntry).actions.map(
        (action) => action.opcode,
      ),
    ).toEqual(["toast"]);
    h.view.unmount();
  });
});

/**
 * Inner (origin = a Button, event `select`) whose instance J is Outer's origin root (Outer has an
 * event `select` too — the same name); Outer placed twice, I1 · I2. The page records collapse I and
 * J into one record (breakdown §2d).
 */
async function openNested() {
  const h = await openAdr280Preview(["Button"]);
  const x = helpers(h);
  x.run(
    createComponent({
      id: h.ids[0] as NodeId,
      name: "Inner",
      newId: h.workspace.newId,
    }),
  );
  const inner = x.lastDefinition();
  const innerOrigin = (x.graph().getEntry(inner) as { templateRootId: NodeId })
    .templateRootId;
  x.event(inner);
  const J = x.bodyChildren()[0]!;
  x.run(createComponent({ id: J, name: "Outer", newId: h.workspace.newId }));
  const outer = x.lastDefinition();
  x.event(outer);
  const I1 = x.bodyChildren()[0]!;
  const I2 = "project:node:i2";
  x.place(outer, I2);
  return { ...h, ...x, inner, innerOrigin, J, outer, I1, I2 };
}

describe("ADR-294 G1 — nested components (the receiving boundary across a collapsed record)", () => {
  it("Inner's emit reaches J's rule, J re-sends Outer's select (same name), the pressed I's rule receives it once", async () => {
    const h = await openNested();
    h.rule(h.innerOrigin, "onPress", [
      { opcode: "emit", propertyKey: "select", value: "x" },
    ]);
    // (J's rule — in Outer's origin — receives Inner's select and sends Outer's.)
    h.rule(h.J, "property:select", [
      { opcode: "toast", message: "j" },
      { opcode: "emit", propertyKey: "select", value: "!event.value" },
    ]);
    h.rule(h.I1, "property:select", h.toast("i1"));
    h.rule(h.I2, "property:select", h.toast("i2"));
    press(h.element(h.I1 as NodeId));
    expect(h.toasts).toEqual(["j", "i1"]);
    press(h.element(h.I2 as NodeId));
    expect(h.toasts).toEqual(["j", "i1", "j", "i2"]);
    h.view.unmount();
  });

  it("the boundaries of the pressed record: J then I, and J under I1 and under I2 are different occurrences", async () => {
    const h = await openNested();
    const root = h.session.root!;
    const graph = h.session.graph!;
    const recordOf = (instance: string) =>
      [...root.domInputs.values()].find(
        (record) => record.sourceId === instance,
      )!.id;
    const first = componentBoundariesOf(graph, root.domInputs, recordOf(h.I1));
    const second = componentBoundariesOf(graph, root.domInputs, recordOf(h.I2));
    expect(first.map((boundary) => boundary.instanceId)).toEqual([h.J, h.I1]);
    expect(second.map((boundary) => boundary.instanceId)).toEqual([h.J, h.I2]);
    // (One document id J — two occurrences.)
    expect(first[0]!.occurrence).not.toBe(second[0]!.occurrence);
    h.view.unmount();
  });

  it("an instance's own rule at the nested position (address) receives and re-sends like the origin's", async () => {
    const h = await openNested();
    h.rule(h.innerOrigin, "onPress", [
      { opcode: "emit", propertyKey: "select", value: "x" },
    ]);
    // (I1's own rule at J — ADR-281's address form — sends Outer's select to I1 itself.)
    h.rule(
      h.I1,
      "property:select",
      [{ opcode: "emit", propertyKey: "select", value: "!event.value" }],
      { instances: [h.I1 as NodeId], templatePath: [h.J as NodeId] },
    );
    h.rule(h.I1, "property:select", h.toast("i1"));
    press(h.element(h.I1 as NodeId));
    expect(h.toasts).toEqual(["i1"]);
    h.view.unmount();
  });
});

describe("ADR-294 G1 — the document refuses what cannot run", () => {
  it("emit of an undeclared event · emit on a page node · property: on a non-instance · Set state of an input variable", async () => {
    const h = await openPicker();
    const refused = (command: Parameters<typeof h.workspace.execute>[0]) => {
      try {
        h.workspace.execute(command);
      } catch (error) {
        return (error as { code?: string }).code;
      }
      return undefined;
    };
    const rule = (
      ownerId: string,
      trigger: string,
      actions: InteractionEntry["actions"],
    ) =>
      addRecord({
        entry: {
          kind: "interaction",
          id: "project:interaction:bad" as EntryId<"interaction">,
          ownerId: ownerId as NodeId,
          trigger,
          actions,
        } as InteractionEntry,
      });
    expect(
      refused(
        rule(h.origin, "onPress", [{ opcode: "emit", propertyKey: "nope" }]),
      ),
    ).toBe("DANGLING_PROPERTY");
    expect(
      refused(
        rule(BODY, "onPress", [{ opcode: "emit", propertyKey: "select" }]),
      ),
    ).toBe("EMIT_OUTSIDE_COMPONENT");
    expect(refused(rule(BODY, "property:select", h.toast("x")))).toBe(
      "UNKNOWN_TRIGGER_ID",
    );
    expect(refused(rule(h.J1, "property:nope", h.toast("x")))).toBe(
      "UNKNOWN_TRIGGER_ID",
    );
    h.run(
      addComponentOutputProperty({
        definitionId: h.definitionId,
        key: "role",
        name: "role",
        kind: "variable",
        variable: {
          id: "project:stateVariable:role" as EntryId<"stateVariable">,
          valueType: "string",
          defaultValue: "guest",
        },
      }),
    );
    expect(
      refused(
        rule(h.origin, "onPress", [
          {
            opcode: "setState",
            variableId:
              "project:stateVariable:role" as EntryId<"stateVariable">,
            op: "set",
            value: "x",
          },
        ]),
      ),
    ).toBe("INPUT_VARIABLE_READ_ONLY");
    h.view.unmount();
  });
});

describe("ADR-294 G1 · R7 — a variable property's value contract", () => {
  async function openRole(valueType: StateVariableEntry["valueType"] = "string") {
    const h = await openPicker();
    const role = "project:stateVariable:role" as EntryId<"stateVariable">;
    h.run(
      addComponentOutputProperty({
        definitionId: h.definitionId,
        key: "role",
        name: "role",
        kind: "variable",
        variable: {
          id: role,
          valueType,
          defaultValue:
            valueType === "number"
              ? 0
              : valueType === "object" || valueType === "array" || valueType === "date"
                ? ""
                : "guest",
        },
      }),
    );
    const pageVariable = (
      id: string,
      type: StateVariableEntry["valueType"],
      ownerId: string = HOME,
    ) => {
      const entry = {
        kind: "stateVariable",
        id: `project:stateVariable:${id}`,
        ownerId,
        name: id,
        valueType: type,
        defaultValue: type === "number" ? 1 : type === "string" ? "admin" : "",
      } as StateVariableEntry;
      h.run(addRecord({ entry }));
      return entry.id;
    };
    const write = (value: unknown) => {
      try {
        h.workspace.execute(
          setFields({
            targets: [{ kind: "node", id: h.J1 as NodeId }],
            props: { role: { kind: "set", value: value as never } },
          }),
        );
      } catch (error) {
        return (error as { code?: string }).code ?? "error";
      }
      return "ok";
    };
    return { ...h, role, pageVariable, write };
  }

  it("a literal of the variable's type · a reference to a visible variable of the same type are stored", async () => {
    const h = await openRole();
    expect(h.write("admin")).toBe("ok");
    const filter = h.pageVariable("filter", "string");
    expect(h.write(`!var.${filter}`)).toBe("ok");
    h.view.unmount();
  });

  it("refused: a literal of another type · a reference of another type · to a variable it does not see · to nothing", async () => {
    const h = await openRole("number");
    expect(h.write("admin")).toBe("PROP_TYPE_MISMATCH");
    const text = h.pageVariable("text", "string");
    expect(h.write(`!var.${text}`)).toBe("STATE_VALUE_TYPE");
    // (A variable of the origin's own root: the page instance does not see it.)
    const hidden = h.pageVariable("hidden", "number", h.origin);
    expect(h.write(`!var.${hidden}`)).toBe("VARIABLE_NOT_VISIBLE");
    expect(h.write("!var.project:stateVariable:none")).toBe("DANGLING_VARIABLE");
    expect(h.write("!event.value")).toBe("PROP_TYPE_MISMATCH");
    h.view.unmount();
  });

  it("an object · array variable takes a reference only; a date takes an ISO date text", async () => {
    const object = await openRole("object");
    expect(object.write('{"a":1}')).toBe("PROP_TYPE_MISMATCH");
    expect(object.write(`!var.${object.pageVariable("row", "object")}`)).toBe("ok");
    object.view.unmount();
    const date = await openRole("date");
    expect(date.write("tomorrow")).toBe("PROP_TYPE_MISMATCH");
    expect(date.write("2026-10-30")).toBe("ok");
    date.view.unmount();
  });

  it("deleting the referenced variable puts the instance back on the default; deleting the property takes its input variable", async () => {
    const h = await openRole();
    const filter = h.pageVariable("filter", "string");
    expect(h.write(`!var.${filter}`)).toBe("ok");
    h.run(removeRecords({ ids: [filter] }));
    expect((h.graph().getEntry(h.J1) as NodeEntry).props.role).toBeUndefined();
    expect(h.write("admin")).toBe("ok");
    h.run(removeComponentProperty({ definitionId: h.definitionId, key: "role" }));
    expect(h.graph().getEntry(h.role)).toBeUndefined();
    expect((h.graph().getEntry(h.J1) as NodeEntry).props.role).toBeUndefined();
    h.view.unmount();
  });
});

import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addComponentOutputProperty,
  addRecord,
  createComponent,
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import type {
  DefinitionEntry,
  EntryId,
  InteractionEntry,
  NodeEntry,
  NodeId,
  StateVariableEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingQuery } from "../../../../../../packages/shared/src/catalog/runtime/viewQuery";
import { createRuntimeState } from "../../../../../../packages/shared/src/state/runtimeState";
import { catalogCodeViewSession } from "../../../builder/catalogRuntime/codeViewEdit";
import { catalogCodeViewApply } from "../../../builder/catalogRuntime/codeViewEdit";
import { catalogVisibleVariables } from "../../../builder/catalogRuntime/interactions";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-294 Phase 0 (G0) — what the ADR changes, on the whole Builder → Preview path before any
 * change (breakdown §2c). `it.fails` = the behavior a later Phase reaches (it fails today; the
 * Phase that fixes it flips it to `it`). `it` = a control or a fact the design rests on.
 * Measurement: jsdom + the Builder workspace → channel → Preview session (synthetic fixture —
 * "does the document · rule · code reach" only).
 */
const HOME = "project:page:home" as EntryId<"page">;
const BODY = "project:node:home-body" as NodeId;

afterEach(() => {
  vi.restoreAllMocks();
});

/** A page with a user component "Picker" (its origin = a Button) placed once (J). */
async function openPicker() {
  const h = await openAdr280Preview(["Button"]);
  const graph = () => h.workspace.runtime.graph;
  act(() => {
    h.workspace.execute(
      createComponent({
        id: h.ids[0] as NodeId,
        name: "Picker",
        newId: h.workspace.newId,
      }),
    );
  });
  const project = graph().getEntry(graph().projectId);
  const definitionId =
    project?.kind === "project"
      ? (project.definitionIds.at(-1) as EntryId<"definition">)
      : ("" as EntryId<"definition">);
  const definition = () => graph().getEntry(definitionId) as DefinitionEntry;
  const instance = (graph().getEntry(BODY) as NodeEntry).children[0]!;
  const origin = definition().templateRootId as NodeId;
  const pageVariable: StateVariableEntry = {
    kind: "stateVariable",
    id: "project:stateVariable:picked" as EntryId<"stateVariable">,
    ownerId: HOME,
    name: "picked",
    valueType: "string",
    defaultValue: "",
  };
  act(() => {
    h.workspace.execute(addRecord({ entry: pageVariable }));
  });
  const run = (command: Parameters<typeof h.workspace.execute>[0]) =>
    act(() => {
      h.workspace.execute(command);
    });
  return {
    ...h,
    graph,
    definitionId,
    definition,
    instance,
    origin,
    pageVariable,
    run,
  };
}

describe("ADR-294 Phase 0 — RED 1 (control): an origin rule's Set state offers no page variable", () => {
  // Stays after the ADR: the origin lives on the Local page — `emit` is the way out, not this list.
  it("the origin's Set state candidates hold none of the using page's variables", async () => {
    const h = await openPicker();
    const offered = catalogVisibleVariables(h.graph(), h.origin).map(
      (variable) => variable.name,
    );
    expect(offered).not.toContain("picked");
    // (The instance on the page sees it.)
    expect(
      catalogVisibleVariables(h.graph(), h.instance as NodeId).map(
        (variable) => variable.name,
      ),
    ).toContain("picked");
    h.view.unmount();
  });
});

describe("ADR-294 Phase 0 — RED 2: an event property · emit · property: rule are refused", () => {
  // (Phase 1 fixed it — now `it`.)
  it(
    "the document takes an event property, an emit Do and a property:select rule",
    async () => {
      const h = await openPicker();
      h.run(
        addComponentOutputProperty({
          definitionId: h.definitionId,
          key: "select",
          name: "select",
          kind: "event",
        }),
      );
      h.run(
        addRecord({
          entry: {
            kind: "interaction",
            id: "project:interaction:emit" as EntryId<"interaction">,
            ownerId: h.origin,
            trigger: "onPress",
            actions: [
              { opcode: "emit", propertyKey: "select", value: "picked!" },
            ],
          } as unknown as InteractionEntry,
        }),
      );
      h.run(
        addRecord({
          entry: {
            kind: "interaction",
            id: "project:interaction:receive" as EntryId<"interaction">,
            ownerId: h.instance as NodeId,
            trigger: "property:select",
            actions: [
              {
                opcode: "setState",
                variableId: h.pageVariable.id,
                op: "set",
                value: "!event.value",
              },
            ],
          } as InteractionEntry,
        }),
      );
      expect(h.graph().getEntry("project:interaction:receive")).toBeDefined();
      h.view.unmount();
    },
  );
});

describe("ADR-294 Phase 0 — RED 3: the code view refuses an instance's on<Name> handler", () => {
  // (Phase 3 fixed it — now `it`.)
  it(
    "onSelect on the Picker instance becomes a property:select rule",
    async () => {
      const h = await openPicker();
      h.run(
        addComponentOutputProperty({
          definitionId: h.definitionId,
          key: "select",
          name: "select",
          kind: "event",
        }),
      );
      const data = { collections: [], endpoints: [] };
      const session = catalogCodeViewSession(h.graph(), HOME, data)!;
      const code = session.baseline.code;
      const edited = code.replace(
        /<Button\b/,
        "<Button onSelect={setPicked}",
      );
      expect(edited).not.toBe(code);
      const result = catalogCodeViewApply(
        h.workspace,
        session,
        edited,
        [{ fromA: 0, toA: code.length, insert: edited }],
        data,
      );
      expect(result.rejected).toEqual([]);
      const project = h.graph().getEntry(h.graph().projectId);
      const rules =
        project?.kind === "project"
          ? project.interactionIds
              .map((id) => h.graph().getEntry(id) as InteractionEntry)
              .filter((rule) => rule.ownerId === h.instance)
          : [];
      expect(rules.map((rule) => rule.trigger)).toContain("property:select");
      h.view.unmount();
    },
  );
});

/** The Picker with a variable property `role` (its input variable owned by the origin root). */
function withRole(h: Awaited<ReturnType<typeof openPicker>>) {
  const id = "project:stateVariable:role" as EntryId<"stateVariable">;
  h.run(
    addComponentOutputProperty({
      definitionId: h.definitionId,
      key: "role",
      name: "role",
      kind: "variable",
      variable: { id, valueType: "string", defaultValue: "guest" },
    }),
  );
  return h.graph().getEntry(id) as StateVariableEntry;
}

describe("ADR-294 Phase 0 — RED 4a: a variable property's literal is not accepted on the instance", () => {
  // (Phase 1 fixed it — now `it`.)
  it("the instance root takes role: 'admin'", async () => {
    const h = await openPicker();
    withRole(h);
    h.run(
      setFields({
        targets: [{ kind: "node", id: h.instance as NodeId }],
        props: { role: { kind: "set", value: "admin" } },
      }),
    );
    const instance = h.graph().getEntry(h.instance) as NodeEntry;
    expect(instance.props.role).toEqual({ kind: "set", value: "admin" });
    h.view.unmount();
  });
});

describe("ADR-294 Phase 0 — RED 4b: a view inside the origin does not read the origin's input variable", () => {
  // (Phase 4 fixed it — now `it`.)
  it("a !var condition on the input variable reads it", async () => {
    const h = await openPicker();
    const role = withRole(h);
    let reads = 0;
    const query = catalogBindingQuery(
      h.graph(),
      {
        collectionId: "data:collection:users",
        view: {
          where: {
            op: "and",
            items: [{ field: "role", op: "eq", value: `!var.${role.id}` }],
          },
        },
      } as never,
      h.origin,
      {
        projectVariables: () => [],
        read: () => {
          reads += 1;
          return "admin";
        },
      } as never,
    );
    expect(query?.names).toContain("role");
    expect(Object.values(query?.values ?? {})).toContain("guest");
    expect(reads).toBe(0);
    h.view.unmount();
  });
});

describe("ADR-294 Phase 0 — RED 4c: the runtime state has no derived variable", () => {
  // (Phase 4 fixed it — now `it`.)
  it(
    "a definition's derive is what read returns · a write is refused",
    () => {
      const state = createRuntimeState({ projectId: "p", storage: null });
      state.setDefinitions({
        projectVariables: [],
        variables: [
          {
            def: {
              id: "role",
              name: "role",
              type: "string",
              defaultValue: "guest",
            },
            owner: { kind: "element", elementId: "root" },
            derive: () => "admin",
          } as never,
        ],
      });
      const scope = { kind: "element", instanceKey: "I1/root" } as const;
      expect(state.read("role", scope)).toBe("admin");
      expect(
        state.write({
          variableId: "role",
          scope,
          op: "set",
          value: "x",
        } as never),
      ).toMatchObject({ ok: false, reason: "input-read-only" });
    },
  );
});

/**
 * A component (Inner — a ListBox) inside another (Outer — whose origin root is an Inner instance J),
 * Outer placed twice (I1 · I2). The record facts the receiving boundary is read from (breakdown
 * §2d): kept as `it` — they stay true after the ADR (the boundary function reads them, it does not
 * change them).
 */
async function openNested() {
  const h = await openAdr280Preview(["ListBox"]);
  const graph = h.workspace.runtime.graph;
  const lastDefinition = () => {
    const project = graph.getEntry(graph.projectId);
    return project?.kind === "project" ? project.definitionIds.at(-1)! : "";
  };
  act(() => {
    h.workspace.execute(
      createComponent({
        id: h.ids[0] as NodeId,
        name: "Inner",
        newId: h.workspace.newId,
      }),
    );
  });
  const inner = lastDefinition();
  const J = (graph.getEntry(BODY) as NodeEntry).children[0]!;
  act(() => {
    h.workspace.execute(
      createComponent({ id: J, name: "Outer", newId: h.workspace.newId }),
    );
  });
  const outer = lastDefinition();
  const I1 = (graph.getEntry(BODY) as NodeEntry).children[0]!;
  const I2 = "project:node:i2" as NodeId;
  act(() => {
    h.workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            kind: "node",
            id: I2,
            definitionId: outer,
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as unknown as NodeEntry,
        ],
        rootIds: [I2],
        newId: h.workspace.newId,
      }),
    );
  });
  h.flush();
  type Rec = {
    id: string;
    sourceId: string;
    instancePath: readonly string[];
    collapsedSourceIds?: readonly string[];
    rowIndex?: number;
  };
  const records = [
    ...(
      h.session.root as unknown as { domInputs: Map<string, Rec> }
    ).domInputs.values(),
  ];
  return { ...h, inner, outer, J, I1, I2, records };
}

describe("ADR-294 Phase 0 — RED 4d · 5 (facts): the record shape a receiving boundary is read from", () => {
  it("an instance whose origin root is another instance: one record — the inner instance only in collapsedSourceIds", async () => {
    const h = await openNested();
    const rootOf = (instance: string) =>
      h.records.find((record) => record.sourceId === instance)!;
    for (const instance of [h.I1, h.I2]) {
      const record = rootOf(instance);
      expect(record.instancePath).not.toContain(h.J);
      expect(record.collapsedSourceIds?.[0]).toBe(h.J);
    }
    h.view.unmount();
  });

  it("a record inside the inner origin has the collapsed instance in its instancePath — and the same J under I1 and I2", async () => {
    const h = await openNested();
    const inside = (instance: string) =>
      h.records.filter(
        (record) =>
          record.instancePath.includes(instance) &&
          record.instancePath.includes(h.J),
      );
    const first = inside(h.I1);
    const second = inside(h.I2);
    expect(first.length).toBeGreaterThan(0);
    expect(second.length).toBe(first.length);
    // (The document id J is one; only the path tells the two apart.)
    const pathTo = (record: { instancePath: readonly string[] }) =>
      record.instancePath
        .slice(0, record.instancePath.indexOf(h.J) + 1)
        .join("/");
    expect(new Set(first.map(pathTo)).size).toBe(1);
    expect(pathTo(first[0]!)).not.toBe(pathTo(second[0]!));
    h.view.unmount();
  });
});

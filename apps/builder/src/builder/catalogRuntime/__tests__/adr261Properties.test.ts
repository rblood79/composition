import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  DefinitionEntry,
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
  ProjectEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  createComponent,
  duplicateNodes,
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import {
  catalogPropertyCommands,
  catalogPropertyTextTarget,
  catalogPropertyView,
} from "../componentProperties";
import { catalogEditContract } from "../editContract";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-261 Phase 4 (Builder): a component's text · boolean properties — made on an origin layer,
 * offered to its instances as Property-tab fields (named, the origin's value as the base), drawn
 * on the instance's records (Canvas and DOM read the same record) and never as the root record's
 * prop (R3); an inline text edit of the driven layer in an instance sets the property.
 */
const PROJECT = "project:project:adr261props" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:p${++next}` as EntryId<K>;
};
const node = (
  name: string,
  definitionId: string,
  extra: Partial<NodeEntry> = {},
): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: definitionId as NodeEntry["definitionId"],
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...extra,
});

/** Card: Frame A > Text T "Title" · Text X "★" → a component; I = its instance (a duplicate). */
async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Props" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr261-props-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        node("A", "lib:definition:type-frame", {
          children: [id("T"), id("X")],
        }),
        node("T", "lib:definition:text", {
          props: { children: { kind: "set", value: "Title" } },
        }),
        node("X", "lib:definition:text", {
          props: { children: { kind: "set", value: "★" } },
        }),
      ],
      rootIds: [id("A")],
      newId: allocator(),
    }),
  );
  workspace.execute(
    createComponent({ id: id("A"), name: "Card", newId: workspace.newId }),
  );
  const I = workspace.execute(
    duplicateNodes({ ids: [id("A")], newId: workspace.newId }),
  ).plan.selectAfter![0] as NodeId;
  const graph = workspace.runtime.graph;
  const project = graph.getEntry(graph.projectId) as ProjectEntry;
  return { workspace, graph, I, definitionId: project.definitionIds[0] };
}
/** The record drawn for origin node `source` inside instance `instance`. */
const recordIn = (
  workspace: CatalogWorkspace,
  instance: NodeId,
  source: NodeId,
) =>
  [...workspace.root.domInputs.values()].find(
    (record) =>
      record.sourceId === source && record.instancePath.includes(instance),
  );

describe("ADR-261 Phase 4 — component properties (Builder)", () => {
  it("an origin layer makes a text and a boolean property; the root lists both", async () => {
    const { workspace, graph } = await open();
    const view = catalogPropertyView(graph, id("T"), "children")!;
    expect(view.origin.name).toBe("Card");
    expect(view).toMatchObject({ isRoot: false, rows: [], canBoolean: true });
    workspace.execute(
      catalogPropertyCommands.create(view.origin, "text", "Title", {
        id: id("T"),
        prop: "children",
      }),
    );
    workspace.execute(
      catalogPropertyCommands.create(view.origin, "boolean", "Show icon", {
        id: id("X"),
      }),
    );
    const root = catalogPropertyView(graph, id("A"), undefined)!;
    expect(root.isRoot).toBe(true);
    expect(root.canBoolean).toBe(false);
    expect(root.rows.map((row) => [row.name, row.kind])).toEqual([
      ["Title", "text"],
      ["Show icon", "boolean"],
    ]);
    // A layer offers the properties of its kind it is not on yet.
    expect(
      catalogPropertyView(graph, id("X"), "children")!.applicable.text.map(
        (item) => item.name,
      ),
    ).toEqual(["Title"]);
  });

  it("the instance's Property tab has the fields; its values draw on its records, not as the root's prop", async () => {
    const { workspace, graph, I, definitionId } = await open();
    const origin = catalogPropertyView(graph, id("T"), "children")!.origin;
    workspace.execute(
      catalogPropertyCommands.create(origin, "text", "Title", {
        id: id("T"),
        prop: "children",
      }),
    );
    workspace.execute(
      catalogPropertyCommands.create(origin, "boolean", "Show icon", {
        id: id("X"),
      }),
    );
    const [title, show] = (graph.getEntry(definitionId) as DefinitionEntry)
      .properties!;
    const contract = catalogEditContract(graph, workspace.readModel, {
      kind: "node",
      id: I,
    });
    expect(contract.fields.slice(0, 2)).toMatchObject([
      {
        key: title.key,
        kind: "string",
        label: "Title",
        baseValue: "Title",
        currentValue: "Title",
        isOverridden: false,
      },
      { key: show.key, kind: "boolean", label: "Show icon", baseValue: true },
    ]);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: I }],
        props: {
          [title.key]: { kind: "set", value: "Hello" },
          [show.key]: { kind: "set", value: false },
        },
      }),
    );
    expect(recordIn(workspace, I, id("T"))?.props.children).toBe("Hello");
    expect(recordIn(workspace, I, id("X"))).toBeUndefined();
    // The origin draws its own values.
    expect(workspace.root.recordsOfSource(id("T"))[0]).toBeDefined();
    const originTitle = [...workspace.root.domInputs.values()].find(
      (record) =>
        record.sourceId === id("T") && !record.instancePath.includes(I),
    );
    expect(originTitle?.props.children).toBe("Title");
    // R3: the instance's record (its root) carries no property key — the DOM gets no attribute.
    const instanceRecord = workspace.root.domInputs.get(
      workspace.root.recordsOfSource(I)[0],
    )!;
    expect(instanceRecord.props).not.toHaveProperty(title.key);
    expect(instanceRecord.props).not.toHaveProperty(show.key);
    const after = catalogEditContract(graph, workspace.readModel, {
      kind: "node",
      id: I,
    });
    expect(after.fields[0]).toMatchObject({
      currentValue: "Hello",
      isOverridden: true,
    });
    // The boolean back on: the driven layer is drawn again; undo takes it away again.
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: I }],
        props: { [show.key]: { kind: "set", value: true } },
      }),
    );
    expect(recordIn(workspace, I, id("X"))?.props.children).toBe("★");
    workspace.undo();
    expect(recordIn(workspace, I, id("X"))).toBeUndefined();
    workspace.undo();
    expect(recordIn(workspace, I, id("T"))?.props.children).toBe("Title");
  });

  it("review m3: a layer the instance's first structural edit made its own is no longer the property's — its field goes", async () => {
    const { workspace, graph, I, definitionId } = await open();
    const origin = catalogPropertyView(graph, id("T"), "children")!.origin;
    workspace.execute(
      catalogPropertyCommands.create(origin, "text", "Title", {
        id: id("T"),
        prop: "children",
      }),
    );
    const [title] = (graph.getEntry(definitionId) as DefinitionEntry)
      .properties!;
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: I }],
        props: { [title.key]: { kind: "set", value: "Hello" } },
      }),
    );
    const field = () =>
      catalogEditContract(graph, workspace.readModel, { kind: "node", id: I })
        .fields[0];
    expect(field().editorHidden).toBeUndefined();
    // The first structural edit at the root position copies its children (values kept).
    workspace.execute(
      insertNodes({
        parent: {
          kind: "descendant",
          ownerId: I,
          address: { instances: [I], templatePath: [id("A")] },
        },
        entries: [node("added", "lib:definition:text")],
        rootIds: [id("added")],
        newId: workspace.newId,
      }),
    );
    expect(field()).toMatchObject({ key: title.key, editorHidden: true });
  });

  it("an inline text edit of the driven layer in an instance sets the instance's property", async () => {
    const { workspace, graph, I, definitionId } = await open();
    const origin = catalogPropertyView(graph, id("T"), "children")!.origin;
    workspace.execute(
      catalogPropertyCommands.create(origin, "text", "Title", {
        id: id("T"),
        prop: "children",
      }),
    );
    const [title] = (graph.getEntry(definitionId) as DefinitionEntry)
      .properties!;
    const record = recordIn(workspace, I, id("T"))!;
    const target = workspace.itemOfRecord(record.id)!.target;
    expect(catalogPropertyTextTarget(graph, target, "children")).toEqual({
      target: { kind: "node", id: I },
      prop: title.key,
    });
    // The origin's own text, and a text no property drives, are their own.
    expect(
      catalogPropertyTextTarget(
        graph,
        { kind: "node", id: id("T") },
        "children",
      ),
    ).toBeUndefined();
    const star = workspace.itemOfRecord(recordIn(workspace, I, id("X"))!.id)!;
    expect(
      catalogPropertyTextTarget(graph, star.target, "children"),
    ).toBeUndefined();
  });
});

/**
 * 2026-10-15 user report — a Create-component'd field's instance: its root props the library
 * template binds (`{label}` · `{description}` · `{placeholder}` · a Checkbox's `{children}`)
 * reached the Canvas records only after a later structural step. The incremental step judged
 * "does this instance's template bind the key" by the node's own definition — a user component
 * accepts nothing; the composite that binds it is the origin's, a layer the record collapses.
 */
describe("2026-10-15 — a user component instance's bound root props update incrementally", () => {
  const PALETTE = "lib:definition:origin-component-textfield";
  const CHECKBOX = "lib:definition:origin-component-checkbox";
  async function field(definitionId: string, name: string) {
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({ projectId: PROJECT, name: "Bound" }),
        await buildCodeCatalogLibrary(),
      ),
      new CatalogStorage(indexedDB, `adr261-bound-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1920, height: 1080 },
        autosaveSchedule: () => {},
      },
    );
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [node("F", definitionId)],
        rootIds: [id("F")],
        newId: allocator(),
      }),
    );
    workspace.execute(
      createComponent({ id: id("F"), name, newId: workspace.newId }),
    );
    const I = workspace.execute(
      duplicateNodes({ ids: [id("F")], newId: workspace.newId }),
    ).plan.selectAfter![0] as NodeId;
    /** The instance's parts' text by part type (Label · Description children, Input placeholder). */
    const texts = () =>
      Object.fromEntries(
        [...workspace.root.domInputs.values()]
          .filter(
            (record) =>
              record.instancePath.includes(I) &&
              /type-(Label|Description|Input)$/.test(record.definitionId),
          )
          .map((record) => [
            record.definitionId.replace(/.*type-/, ""),
            record.definitionId.endsWith("Input")
              ? record.props.placeholder
              : record.props.children,
          ]),
      );
    return { workspace, I, texts };
  }
  it("a TextField component's instance: label · description · placeholder reach the parts in the same step", async () => {
    const { workspace, I, texts } = await field(PALETTE, "Field");
    expect(texts()).toEqual({
      Label: "Text Field",
      Input: "Enter text...",
      Description: "",
    });
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: I }],
        props: {
          label: { kind: "set", value: "Name" },
          placeholder: { kind: "set", value: "Your name" },
          description: { kind: "set", value: "Required" },
        },
      }),
    );
    expect(texts()).toEqual({
      Label: "Name",
      Input: "Your name",
      Description: "Required",
    });
    workspace.undo();
    expect(texts()).toEqual({
      Label: "Text Field",
      Input: "Enter text...",
      Description: "",
    });
  });
  it("a Checkbox component's instance: its text (`children`) reaches the label part", async () => {
    const { workspace, I, texts } = await field(CHECKBOX, "Check");
    expect(texts().Label).toBe("Checkbox");
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: I }],
        props: { children: { kind: "set", value: "Agree" } },
      }),
    );
    expect(texts().Label).toBe("Agree");
  });
});

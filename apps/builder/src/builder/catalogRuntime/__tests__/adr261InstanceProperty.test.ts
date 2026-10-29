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
  insertNodes,
} from "../../../../../../packages/shared/src/catalog/commands";
import {
  catalogInstancePropertyCandidates,
  catalogInstancePropertyPlan,
  catalogInstancePropertyRows,
  catalogInstancePropertyScope,
  catalogPropertyCommands,
  catalogPropertyView,
} from "../componentProperties";
import { catalogEditContract } from "../editContract";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-261 Phase 5 (Builder): an instance swap property — made on a nested instance of an origin,
 * its preferred components set there; an instance's Component section picks its value (preferred
 * first, the current one left out), the swapped nested instance draws on the instance's records,
 * and the default folds it back. The value is no Property-tab field (it is no root prop).
 */
const PROJECT = "project:project:adr261swapprop" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:q${++next}` as EntryId<K>;
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
const glyph = (name: string, value: string) =>
  node(name, "lib:definition:text", {
    props: { children: { kind: "set", value } },
  });

/** Star (Frame S > "★") · Heart (Frame H > "♥") · Card (Frame A > "Title" · a Star) · I = a Card. */
async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Swap props" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr261-swapprop-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  const frame = (name: string, children: string[]) =>
    node(name, "lib:definition:type-frame", { children: children.map(id) });
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        frame("S", ["SG"]),
        glyph("SG", "★"),
        frame("H", ["HG"]),
        glyph("HG", "♥"),
      ],
      rootIds: [id("S"), id("H")],
      newId: allocator(),
    }),
  );
  workspace.execute(
    createComponent({ id: id("S"), name: "Star", newId: workspace.newId }),
  );
  workspace.execute(
    createComponent({ id: id("H"), name: "Heart", newId: workspace.newId }),
  );
  const graph = workspace.runtime.graph;
  const [star, heart] = (graph.getEntry(graph.projectId) as ProjectEntry)
    .definitionIds;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        frame("A", ["T", "N"]),
        glyph("T", "Title"),
        node("N", star, { name: "Icon" }),
      ],
      rootIds: [id("A")],
      newId: allocator(),
    }),
  );
  // ADR-279: the definition owns A; the instance in its place is I.
  const I = workspace.execute(
    createComponent({ id: id("A"), name: "Card", newId: workspace.newId }),
  ).plan.selectAfter![0] as NodeId;
  const card = (graph.getEntry(graph.projectId) as ProjectEntry)
    .definitionIds[2];
  return { workspace, graph, I, star, heart, card };
}
const textsIn = (workspace: CatalogWorkspace, instance: NodeId) =>
  [...workspace.root.domInputs.values()]
    .filter((record) => record.instancePath.includes(instance))
    .map((record) => record.props.children)
    .filter((value): value is string => typeof value === "string");

describe("ADR-261 Phase 5 — instance swap property (Builder)", () => {
  it("a nested instance of an origin makes one (a text layer does not); its preferred are set there", async () => {
    const { workspace, graph, card, heart } = await open();
    const view = catalogPropertyView(graph, id("N"), undefined)!;
    expect(view.canInstance).toBe(true);
    expect(catalogPropertyView(graph, id("T"), "children")!.canInstance).toBe(
      false,
    );
    expect(catalogPropertyView(graph, id("A"), undefined)!.canInstance).toBe(
      false,
    );
    workspace.execute(
      catalogPropertyCommands.create(view.origin, "instance", "Icon", {
        id: id("N"),
      }),
    );
    const [property] = (graph.getEntry(card) as DefinitionEntry).properties!;
    expect(property).toMatchObject({ kind: "instance", name: "Icon" });
    workspace.execute(
      catalogPropertyCommands.preferred(view.origin, property.key, [heart]),
    );
    expect(
      catalogPropertyView(graph, id("N"), undefined)!.rows[0].preferred,
    ).toEqual([heart]);
    // (A swapped layer offers no text property — the graph refuses one on it.)
    expect(catalogPropertyView(graph, id("N"), "children")?.textProp).toBe(
      undefined,
    );
  });

  it("an instance picks its value (preferred first); its records draw it; the default folds it back", async () => {
    const { workspace, graph, I, star, heart } = await open();
    const view = catalogPropertyView(graph, id("N"), undefined)!;
    workspace.execute(
      catalogPropertyCommands.create(view.origin, "instance", "Icon", {
        id: id("N"),
      }),
    );
    const key = catalogPropertyView(graph, id("N"), undefined)!.rows[0].key;
    workspace.execute(
      catalogPropertyCommands.preferred(view.origin, key, [heart]),
    );
    const scope = catalogInstancePropertyScope(graph, { kind: "node", id: I })!;
    expect(catalogInstancePropertyRows(graph, scope)).toEqual([
      {
        key,
        name: "Icon",
        definitionId: star,
        label: "Star",
        isDefault: true,
      },
    ]);
    const candidates = catalogInstancePropertyCandidates(graph, scope, key);
    expect(candidates[0]).toMatchObject({
      definitionId: heart,
      group: "preferred",
    });
    expect(candidates.some((item) => item.definitionId === star)).toBe(false);
    expect(textsIn(workspace, I)).toEqual(["Title", "★"]);
    // The value is no Property-tab field (no root prop).
    expect(
      catalogEditContract(graph, workspace.readModel, {
        kind: "node",
        id: I,
      }).fields.some((field) => field.key === key),
    ).toBe(false);

    const { command, report } = catalogInstancePropertyPlan(
      graph,
      scope,
      key,
      heart as never,
      workspace.newId,
    );
    expect(report).toEqual({
      kept: 0,
      dropped: 0,
      movedOut: 0,
      targetsUnset: 0,
    });
    workspace.execute(command);
    expect(textsIn(workspace, I)).toEqual(["Title", "♥"]);
    expect(catalogInstancePropertyRows(graph, scope)[0]).toMatchObject({
      definitionId: heart,
      label: "Heart",
      isDefault: false,
    });
    // The origin draws its own.
    expect((graph.getEntry(id("N")) as NodeEntry).definitionId).toBe(star);

    workspace.execute(
      catalogInstancePropertyPlan(graph, scope, key, null, workspace.newId)
        .command,
    );
    expect(textsIn(workspace, I)).toEqual(["Title", "★"]);
    expect(catalogInstancePropertyRows(graph, scope)[0].isDefault).toBe(true);
    workspace.undo();
    expect(textsIn(workspace, I)).toEqual(["Title", "♥"]);
  });
});

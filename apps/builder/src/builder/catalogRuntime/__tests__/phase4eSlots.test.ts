import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
  TemplateId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { catalogComponentCommands } from "../componentActions";
import { newCatalogProjectDocument } from "../project";
import {
  catalogSlotCommands,
  catalogSlotDeclaration,
  catalogSlotPosition,
} from "../slots";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-4 slot section: a node inside a component's template declares a slot; an
 * instance's slot position shows what fills it, takes a new node, and restores the template's
 * content — each one history step.
 */
const PROJECT = "project:project:slots" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (name: string, children: NodeId[] = []): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: "lib:definition:type-frame",
  children,
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
});

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Slots" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-slots-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [node("card", [id("content")]), node("content")],
      rootIds: [id("card")],
      newId: workspace.newId,
    }),
  );
  return { workspace, graph: workspace.runtime.graph };
}

describe("ADR-248 Phase 4e-4 slot section", () => {
  it("a template node declares a slot; an instance fills it and restores the template content", async () => {
    const { workspace, graph } = await open();
    // A plain page node has no slot to declare.
    expect(catalogSlotDeclaration(graph, id("content"))).toBe(undefined);
    const { plan } = workspace.execute(
      catalogComponentCommands.create(id("card"), "Card", workspace.newId),
    );
    const instance = plan.selectAfter![0];
    expect(catalogSlotDeclaration(graph, id("content"))).toEqual({});

    workspace.execute(
      catalogSlotCommands.declare(id("content"), {
        name: "content",
        required: false,
      }),
    );
    expect(catalogSlotDeclaration(graph, id("content"))).toEqual({
      slot: { name: "content", required: false },
    });

    const target = {
      kind: "descendant" as const,
      ownerId: instance,
      address: {
        instances: [instance],
        templatePath: [id("card"), id("content")] as TemplateId[],
      },
    };
    expect(catalogSlotPosition(graph, target)).toEqual({
      slot: { name: "content", required: false },
    });
    // The card root is no slot.
    expect(
      catalogSlotPosition(graph, {
        ...target,
        address: {
          ...target.address,
          templatePath: [id("card")] as TemplateId[],
        },
      }),
    ).toBe(undefined);

    const revision = graph.revision;
    const filling = workspace.execute(
      catalogSlotCommands.fill(target, "lib:definition:text", workspace.newId),
    );
    expect(graph.revision).toBe(revision + 1);
    // The slot position stays selected.
    expect(filling.plan.selectAfter).toBe(undefined);
    const filled = catalogSlotPosition(graph, target)!;
    expect(filled.fillIds).toHaveLength(1);
    const fillId = filled.fillIds![0];
    expect(graph.getEntry(fillId)).toMatchObject({
      definitionId: "lib:definition:text",
    });

    workspace.execute(catalogSlotCommands.restore(target));
    expect(catalogSlotPosition(graph, target)).toEqual({
      slot: { name: "content", required: false },
    });
    expect(graph.getEntry(fillId)).toBe(undefined);
    workspace.undo();
    expect(catalogSlotPosition(graph, target)?.fillIds).toEqual([fillId]);

    workspace.execute(catalogSlotCommands.declare(id("content"), undefined));
    expect(catalogSlotDeclaration(graph, id("content"))).toEqual({});
  });
});

import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { definitionTypeName } from "../../../../../../packages/shared/src/catalog/commands/context";
import type {
  DefinitionId,
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogPaletteInsertCommand } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { catalogSubpartOwnerType } from "../subpart";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BODY = "project:node:home-body" as NodeId;

describe("ADR-248 Phase 4e delegated sub-part owner (catalog records)", () => {
  it("names the field that owns its Label · Input; the field itself and a plain node have none", async () => {
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:subpart" as EntryId<"project">,
          name: "Subpart",
        }),
        await buildCodeCatalogLibrary(),
      ),
      new CatalogStorage(indexedDB, `adr248-subpart-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1920, height: 1080 },
        autosaveSchedule: () => {},
      },
    );
    const insert = (type: string) => {
      const command = catalogPaletteInsertCommand(
        {
          graph: workspace.runtime.graph,
          records: workspace.root.domInputs,
          selection: () => [],
          itemOfRecord: (identity) => workspace.itemOfRecord(identity),
          pageContent: () => ({ kind: "node", id: BODY }),
          newId: workspace.newId,
        },
        type,
      );
      return workspace.execute(command!).plan.selectAfter![0];
    };
    insert("TextField");
    insert("frame");
    const graph = workspace.runtime.graph;
    const records = workspace.root.domInputs;
    const typeOf = (id: string) =>
      definitionTypeName(graph, records.get(id)!.definitionId as DefinitionId);
    const all = [...records.keys()];
    const field = all.find((id) => typeOf(id) === "TextField")!;
    const label = all.find(
      (id) => typeOf(id) === "Label" && records.get(id)!.parentId === field,
    )!;
    const frame = all.find((id) => typeOf(id) === "frame")!;
    expect(field && label && frame).toBeTruthy();
    expect(catalogSubpartOwnerType(graph, records, label, "all")).toBe(
      "TextField",
    );
    // ADR-253: the Label is an instance of the Label origin the DOM draws from its node — its
    // text is the field's `label` prop, its style is its own.
    expect(catalogSubpartOwnerType(graph, records, label, "style")).toBeNull();
    const input = all.find(
      (id) => typeOf(id) === "Input" && records.get(id)!.parentId === field,
    )!;
    for (const axis of ["all", "style"] as const)
      expect(catalogSubpartOwnerType(graph, records, input, axis)).toBe(
        "TextField",
      );
    expect(catalogSubpartOwnerType(graph, records, field, "all")).toBeNull();
    expect(catalogSubpartOwnerType(graph, records, frame, "all")).toBeNull();
  });
});

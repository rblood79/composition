import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands/structure";
import type { NodeEntry } from "../../../../../../packages/shared/src/catalog/document/types";
import { CatalogWorkspace } from "../workspace";
import { CatalogStorage } from "../storage";
import { newCatalogProjectDocument } from "../project";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

// The remaining G0 inputs are outside the current D2/nesting contract. Rejection must be atomic;
// this is behavioral evidence, not permission to count an absent old/new visual comparison as PASS.
describe("ADR-248 G3 remaining legacy input contracts", () => {
  it.each([
    ["taggroup", "accent"],
    ["taggroup", "neutral"],
    ["taggroup", "negative"],
    ["popover", "accent"],
    ["popover", "neutral"],
    ["popover", "surface"],
    ["radio", undefined],
  ] as const)("rejects %s/%s without adding a node", async (type, variant) => {
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:g3-contract",
          name: "G3 contracts",
        }),
        await buildCodeCatalogLibrary(),
      ),
      new CatalogStorage(indexedDB, `g3-contract-${type}-${variant}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1920, height: 1080 },
        autosaveSchedule: () => {},
      },
    );
    const entry: NodeEntry = {
      kind: "node",
      id: "project:node:g3-rejected",
      definitionId: `lib:definition:origin-component-${type}`,
      children: [],
      props: variant ? { variant: { kind: "set", value: variant } } : {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
    };
    const before = workspace.runtime.graph.exportDocument();
    try {
      expect(() =>
        workspace.execute(
          insertNodes({
            parent: { kind: "node", id: "project:node:home-body" },
            entries: [entry],
            rootIds: [entry.id],
            newId: workspace.newId,
          }),
        ),
      ).toThrowError(
        expect.objectContaining({
          code: type === "radio" ? "NESTING_NOT_ALLOWED" : "PROP_NOT_ACCEPTED",
        }),
      );
      expect(workspace.runtime.graph.getEntry(entry.id)).toBeUndefined();
      expect(workspace.runtime.graph.exportDocument()).toEqual(before);
    } finally {
      workspace.dispose();
    }
  });
});

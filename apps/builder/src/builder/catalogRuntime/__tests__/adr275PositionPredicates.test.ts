import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  CatalogDocument,
  DefinitionId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogIsAuthoredAbsolute,
  catalogIsOutOfFlow,
} from "../../../../../../packages/shared/src/catalog/runtime/positioning";
import { CatalogCompositionRoot } from "../compositionRoot";
import { CatalogRuntime } from "../controller";
import { CatalogStorage } from "../storage";
import { absoluteLayout } from "./absoluteLayoutFixture";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-275 Decision 1 (리뷰 r1 M1) — one storage, two predicates: a ListBoxItem's icon is out of flow
 * by its owner's part rule (`position: absolute` · `insetLeft: 12px`) but not authored, so it is
 * not an authored absolute box (the Canvas move · Position section refuse it); a frame the author
 * made absolute is both.
 */
const node = (
  id: string,
  definitionId: string,
  extra: Partial<NodeEntry> = {},
): NodeEntry => ({
  kind: "node",
  id: id as NodeId,
  definitionId: definitionId as DefinitionId,
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...extra,
});

async function open() {
  const library = await buildCodeCatalogLibrary();
  const projectId = "project:project:p275" as const;
  const pageId = "project:page:main" as const;
  const list = node("project:node:list", "lib:definition:type-ListBox", {
    children: ["project:node:item" as NodeId],
  });
  const item = node("project:node:item", "lib:definition:type-ListBoxItem", {
    children: ["project:node:icon" as NodeId],
  });
  const icon = node("project:node:icon", "lib:definition:type-Icon", {
    props: { slot: { kind: "set", value: "icon" } },
  });
  const frame = node("project:node:frame", "lib:definition:type-frame", {
    layout: absoluteLayout(20, 30),
    sizing: {
      width: { kind: "set", value: 40 },
      height: { kind: "set", value: 20 },
    },
  });
  const document: CatalogDocument = {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 44,
    revision: 0,
    projectId,
    rootId: projectId,
    entries: {
      [projectId]: {
        kind: "project",
        id: projectId,
        name: "P275",
        pageIds: [pageId],
        definitionIds: [],
        overrideIds: [],
        themeIds: [],
        tokenIds: [],
        stateVariableIds: [],
        interactionIds: [],
        assetIds: [],
      },
      [pageId]: {
        kind: "page",
        id: pageId,
        name: "Main",
        route: "/",
        children: [list.id, frame.id],
      },
      [list.id]: list,
      [item.id]: item,
      [icon.id]: icon,
      [frame.id]: frame,
    },
  };
  const runtime = new CatalogRuntime(
    new CatalogGraph(document, library),
    new CatalogStorage(indexedDB, `adr275-${Math.random()}`),
  );
  return new CatalogCompositionRoot(runtime, await nodeLayoutEngine(), {
    width: 800,
    height: 600,
  });
}

describe("ADR-275 position predicates", () => {
  it("a rule-placed part is out of flow but not authored; an authored absolute box is both", async () => {
    const root = await open();
    const recordOf = (source: string) =>
      [...root.domInputs.values()].find(
        (record) => record.sourceId === source,
      )!;
    const icon = recordOf("project:node:icon");
    expect(icon.layout.position).toBe("absolute");
    expect(catalogIsOutOfFlow(icon)).toBe(true);
    expect(catalogIsAuthoredAbsolute(icon)).toBe(false);
    const frame = recordOf("project:node:frame");
    expect(catalogIsOutOfFlow(frame)).toBe(true);
    expect(catalogIsAuthoredAbsolute(frame)).toBe(true);
  });
});

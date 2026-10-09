import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderCatalogDom } from "../domBinding";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { catalogSemanticContracts } from "../editContract";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * S2 Heading `level` (1–6, default 3 — S2 1.8.0 · RAC `Heading`): the heading element the DOM
 * draws. It is document structure only — the size draws the type, so the Canvas box does not move.
 */
const BODY = "project:node:home-body" as NodeId;
const NODE = "project:node:title" as NodeId;

async function open() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:heading-level" as EntryId<"project">,
        name: "Heading level",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `heading-level-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const definitionId = catalogPaletteDefinitionId(library, "Heading");
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: NODE,
          definitionId,
          children: [],
          props: { children: { kind: "set", value: "Title" } },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [NODE],
      newId: workspace.newId,
    }),
  );
  const record = () =>
    [...workspace.root.canvasInputs.values()].find(
      (item) => item.sourceId === NODE,
    )!;
  const html = () =>
    renderToStaticMarkup(renderCatalogDom(workspace.root, record().id));
  const setLevel = (level: number) =>
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(record().id)!.target],
        props: { level: { kind: "set", value: level } },
      }),
    );
  return { workspace, definitionId, record, html, setLevel };
}

describe("S2 Heading level", () => {
  it("the Design panel offers Level 1–6, default 3", async () => {
    const { definitionId } = await open();
    expect(catalogSemanticContracts(definitionId, "Heading").level).toEqual({
      kind: "number",
      label: "Level",
      section: "content",
      default: 3,
      min: 1,
      max: 6,
      step: 1,
    });
  });

  it("draws h3 until a level is set, then that heading element", async () => {
    const { html, setLevel, record } = await open();
    expect(html()).toMatch(/^<h3 [^>]*class="react-aria-Heading"/);
    const height = record().visual.fontSize;
    for (const level of [1, 2, 6]) {
      setLevel(level);
      expect(record().props.level).toBe(level);
      expect(html()).toMatch(
        new RegExp(`^<h${level} [^>]*class="react-aria-Heading"`),
      );
      // The size draws the type — the level does not.
      expect(record().visual.fontSize).toBe(height);
    }
  });
});

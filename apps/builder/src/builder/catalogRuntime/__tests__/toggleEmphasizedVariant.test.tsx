// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * 2026-10-09 (사용자 「Checkbox · Switch variant ↔ isEmphasized 진행해」): Checkbox · Switch take
 * `variant` (default · emphasized — the rule's variants, which the Canvas paints) and their DOM set
 * `data-emphasized` (the sheet's accent selected colour) from `isEmphasized`, which they do not
 * accept — an emphasized toggle was accent on the Canvas and neutral in the Preview. The DOM now
 * reads the `variant` it accepts.
 */
const BODY = "project:node:home-body" as NodeId;
const ROOT = "project:node:root" as NodeId;

async function rootHtml(type: string, props: Record<string, string>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:toggle-emph" as EntryId<"project">,
        name: "Toggle emphasized",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `toggle-emph-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: ROOT,
          definitionId: catalogPaletteDefinitionId(library, type),
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [
              key,
              { kind: "set", value },
            ]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [ROOT],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const node = [...root.domInputs.values()].find(
    (r) => root.typeOf(r) === type,
  )!;
  const html = renderToStaticMarkup(renderCatalogDom(root, node.id));
  return /^<[a-z]+[^>]*>/.exec(html)![0];
}

describe("Checkbox · Switch — the DOM's emphasis is the `variant` they accept", () => {
  it.each(["Checkbox", "Switch"])(
    "%s variant emphasized → data-emphasized; default → none",
    async (type) => {
      expect(await rootHtml(type, { variant: "emphasized" })).toContain(
        "data-emphasized",
      );
      expect(await rootHtml(type, { variant: "default" })).not.toContain(
        "data-emphasized",
      );
      expect(await rootHtml(type, {})).not.toContain("data-emphasized");
    },
  );
});

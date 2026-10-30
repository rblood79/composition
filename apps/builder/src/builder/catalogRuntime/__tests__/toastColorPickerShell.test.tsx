import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { catalogAuthoredVisual } from "../../../../../../packages/shared/src/catalog/runtime/libraryVisual";
import { renderCatalogDom } from "../domBinding";
import { catalogRuleShapes } from "../ruleShapes";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * Two container shells with no palette entry (the AI · paste path) drew differently on the Canvas
 * and in the Preview:
 * - Toast: the DOM `<div role="alert">` had no rule class, so the catalog's generated sheet
 *   (`.react-aria-Toast` — height 48 at M, variant fill · border) never reached it; an empty Toast
 *   was its text's 24 px in the Preview and 48 on the Canvas.
 * - ColorPicker: RAC's ColorPicker renders no element of its own (a context for its children), and
 *   the DOM shell draws no box (`ColorPicker.css` — `background: none; border: none`); the Canvas
 *   painted the rule's variant fill and a 1 px border around it.
 */
const BODY = "project:node:home-body" as NodeId;
const NODE = "project:node:shell" as NodeId;

async function place(definitionId: string) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:shells" as EntryId<"project">,
        name: "Shells",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `shells-${Math.random()}`),
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
        {
          kind: "node",
          id: NODE,
          definitionId: definitionId as LibraryDefinitionId,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [NODE],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const id = root.recordsOfSource(NODE)[0]!;
  return { workspace, root, id };
}

describe("container shells without a palette entry: Canvas = Preview", () => {
  it("Toast: the DOM carries the rule class and its size · variant, so the generated sheet sizes it as the Canvas does", async () => {
    const { root, id } = await place("lib:definition:type-Toast");
    const html = renderToStaticMarkup(renderCatalogDom(root, id));
    const tag = /<div[^>]*role="alert"[^>]*>/.exec(html)?.[0] ?? "";
    expect(tag).toMatch(/class="react-aria-Toast"/);
    expect(tag).toMatch(/data-size="M"/);
    expect(tag).toMatch(/data-variant="info"/);
    // The Canvas box the sheet's `.react-aria-Toast { min-height: 56px }` matches (S2 Toast — ADR-295 Phase 3c-3c).
    expect(root.getGeometry([id]).get(id)?.height).toBe(56);
  });

  it("ColorPicker: the Canvas paints no fill or border of its own (RAC ColorPicker draws no element)", async () => {
    const { workspace, root, id } = await place(
      "lib:definition:type-ColorPicker",
    );
    const record = root.canvasInputs.get(id)!;
    const box = root.getGeometry([id]).get(id)!;
    const shapes = catalogRuleShapes({
      node: { ...record, props: { ...record.props, ...record.derivedProps } },
      rect: { width: box.width, height: box.height },
      rule: workspace.runtime.graph.library.rules.get("ColorPicker" as never)!,
      type: "ColorPicker",
      authoredVisual: catalogAuthoredVisual(root, record),
    }) as unknown as {
      type: string;
      fill?: string;
      borderWidth?: number;
      color?: string;
    }[];
    const visible = (color: string | undefined) =>
      !!color && !/transparent/.test(color);
    expect(
      shapes.filter(
        (shape) =>
          visible(shape.fill) ||
          (shape.type === "border" &&
            (shape.borderWidth ?? 0) > 0 &&
            visible(shape.color)),
      ),
    ).toEqual([]);
  });
});

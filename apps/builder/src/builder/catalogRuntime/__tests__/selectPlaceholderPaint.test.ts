import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { cssVarToTokenRef, resolveToken } from "@composition/rendering";
import { catalogTextMetrics } from "../../../../../../packages/shared/src/catalog/runtime/boxModel";
import { renderToStaticMarkup } from "react-dom/server";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;

async function placeSelect() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:select-placeholder" as EntryId<"project">,
        name: "Select placeholder",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `select-placeholder-${Math.random()}`),
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
          id: FIELD,
          definitionId:
            "lib:definition:origin-component-select" as LibraryDefinitionId,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [FIELD],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const value = [...root.canvasInputs.values()].find(
    (record) => record.bindingId === "selectvalue",
  )!;
  return { workspace, value };
}

/**
 * The Select's value shows its placeholder on the Canvas (the Canvas draws no selection — a
 * selection is the Preview's run state), so it paints in the Select rule's
 * `.react-aria-SelectValue[data-placeholder]` state, as the DOM does (`fg-muted` × 0.6). A color
 * the document writes on the value wins, as the DOM's inline color does over the sheet.
 */
describe("Select placeholder paint", () => {
  it("the Canvas paints the value in the placeholder state the DOM sheet declares", async () => {
    const { workspace, value } = await placeSelect();
    const node = () => workspace.root.canvasInputs.get(value.id)!;
    const parent = () => workspace.root.canvasInputs.get(node().parentId);
    // `var(--fg-muted)` at opacity 0.6 (alpha 0x99), in the root's color mode.
    const muted = `${resolveToken(cssVarToTokenRef("var(--fg-muted)")!, "light")}99`;
    expect(catalogTextMetrics(node(), parent()).color).toBe(muted);
    // The DOM leaves the color to the sheet's `[data-placeholder]` (no inline color — a chosen
    // item takes the trigger's color there).
    const html = renderToStaticMarkup(
      renderCatalogDom(
        workspace.root,
        workspace.root.recordsOfSource(FIELD)[0]!,
      ),
    );
    const valueStyle =
      /class="react-aria-SelectValue"[^>]*style="([^"]*)"/.exec(html)?.[1] ??
      "";
    expect(valueStyle).not.toMatch(/(^|;)\s*(color|opacity):/);
    // The placeholder text changes; the paint stays.
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: FIELD }],
        props: { placeholder: { kind: "set", value: "Pick one" } },
      }),
    );
    expect(catalogTextMetrics(node(), parent()).color).toBe(muted);
    // A color the document writes on the value wins in both (the DOM's inline color).
    const target = workspace.itemOfRecord(value.id)!.target;
    workspace.execute(
      setFields({
        targets: [target],
        visual: { color: { kind: "set", value: "#ff0000" } },
      }),
    );
    expect(catalogTextMetrics(node(), parent()).color).toBe("#ff0000");
  });
});

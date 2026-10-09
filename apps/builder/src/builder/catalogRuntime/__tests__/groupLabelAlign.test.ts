// @vitest-environment jsdom
/**
 * S2 1.8.0 CheckboxGroup · RadioGroup `labelAlign` (start · end — S2 `Alignment`, the side label column's text
 * alignment, as the other fields take it): the Design panel offers it beside a side label, the DOM
 * group carries `data-label-align`, and the Canvas label paints the rule's `--form-label-align`.
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogSemanticContracts } from "../editContract";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const OWNER = "project:node:owner" as NodeId;

async function openGroup(type: string, props: NodeEntry["props"]) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:group-label-align" as const,
        name: "Group label align",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `group-label-align-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const definitionId = catalogPaletteDefinitionId(library, type);
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: OWNER,
          definitionId,
          children: [],
          props,
          visual: {},
          sizing: { width: { kind: "set", value: 420 } },
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const owner = [...root.domInputs.values()].find(
    (record) => record.sourceId === OWNER,
  )!;
  const label = owner.children
    .map((id) => root.canvasInputs.get(id)!)
    .find((record) => root.typeOf(record) === "Label")!;
  const html = renderToStaticMarkup(renderCatalogDom(root, owner.id));
  return { definitionId, label, html };
}

describe.each(["CheckboxGroup", "RadioGroup"])("S2 %s labelAlign", (type) => {
  it("the Design panel offers Label Align beside a side label", async () => {
    const { definitionId } = await openGroup(type, {});
    expect(catalogSemanticContracts(definitionId, type).labelAlign).toEqual(
      expect.objectContaining({
        kind: "enum",
        default: "start",
        options: [
          { value: "start", label: "Start" },
          { value: "end", label: "End" },
        ],
        visibleWhen: { key: "labelPosition", equals: "side" },
      }),
    );
  });

  it.each(["end"])(
    "%s: the DOM group carries data-label-align and the Canvas label paints it",
    async (align) => {
      const { label, html } = await openGroup(type, {
        labelPosition: { kind: "set", value: "side" },
        labelAlign: { kind: "set", value: align },
      });
      expect(html).toContain(`data-label-align="${align}"`);
      expect(label.visual.textAlign).toBe(align);
    },
  );

  it("start (unset) keeps the label at the column start", async () => {
    const { label, html } = await openGroup(type, {
      labelPosition: { kind: "set", value: "side" },
    });
    expect(html).not.toContain("data-label-align");
    expect(label.visual.textAlign).toBe("start");
  });
});

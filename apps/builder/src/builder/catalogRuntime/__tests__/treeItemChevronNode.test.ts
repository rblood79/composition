// @vitest-environment jsdom
/**
 * TreeItem chevron node (2026-10-04, user「1안」 — the toggle indicator node's pattern): a TreeItem
 * holds its chevron button as a `TreeItemChevron` child before the label, so the Layers tree shows
 * the DOM row (`Button[slot="chevron"]` · content). Values stay where they were: the box is the
 * `Tree.css` button (20px + level indent, the old owner-composed layout part), the glyph is the
 * TreeItem rule's `leadingIcon` painted in the node's box, and the DOM absorbs the node.
 *
 * Oracle: the row geometry before the node (main `ef1ff8c04`, the chevron was a layout part with no
 * node) — the label sits where it sat. The glyph moves 2px right on purpose: the old Canvas drew it
 * at the row's `paddingX + iconSize / 2`, the DOM button centers its svg (`justify-content: center`).
 */
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  removeTargets,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import {
  buildCodeCatalogLibrary,
  catalogTypeDefinitionId,
} from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  CatalogLibrary,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import type { SkiaNodeData } from "../../workspace/canvas/skia/nodeRendererTypes";
import { bindCatalogCanvas } from "../canvasBinding";
import type { CatalogTextMeasure } from "../compositionRoot";
import { catalogDomRendersNode, renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const measure: CatalogTextMeasure = (text, font) => ({
  width: text.length * font.fontSize * 0.5,
  exactWidth: text.length * font.fontSize * 0.5,
  minWidth: text.length * font.fontSize * 0.5,
  height: font.fontSize * (font.lineHeight || 1.2),
});

const OWNER = "project:node:owner" as NodeId;

/** A node entry of `definitionId` with set props. */
const nodeEntry = (
  id: string,
  definitionId: string,
  children: string[] = [],
  props: Record<string, unknown> = {},
) =>
  ({
    kind: "node",
    id,
    definitionId,
    children,
    props: Object.fromEntries(
      Object.entries(props).map(([key, value]) => [
        key,
        { kind: "set", value },
      ]),
    ),
    visual: {},
    sizing: {},
    descendantOverrides: [],
  }) as NodeEntry;

/** A workspace whose home body holds `entries` (roots: the first). */
async function openWorkspace(
  entries: (library: CatalogLibrary) => NodeEntry[],
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:tree-chevron" as const,
        name: "Tree chevron",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `tree-chevron-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      textMeasure: measure,
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" },
      entries: entries(library),
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  return workspace;
}

async function openTree(props: Record<string, unknown> = {}) {
  const workspace = await openWorkspace((library) => [
    nodeEntry(OWNER, catalogPaletteDefinitionId(library, "Tree"), [], props),
  ]);
  const root = workspace.root;
  const record = (id: string) => root.layoutInputs.get(id)!;
  const tree = [...root.layoutInputs.values()].find(
    (entry) => entry.bindingId === "tree",
  )!;
  const kids = (id: string) => record(id).children.map(record);
  const [parentItem, leafItem] = kids(tree.id);
  return { workspace, root, record, kids, tree, parentItem, leafItem };
}

/** Icon glyph shapes under painted node data. */
function glyphs(data: SkiaNodeData | undefined): SkiaNodeData[] {
  if (!data) return [];
  return [
    ...(data.type === "icon_path" ? [data] : []),
    ...(data.children ?? []).flatMap(glyphs),
  ];
}

describe("TreeItem chevron node", () => {
  it.each([false, true])(
    "each TreeItem holds its chevron node first; the box and label keep the old part's place (expanded %s)",
    async (expanded) => {
      const { workspace, root, kids, parentItem, leafItem } = await openTree(
        expanded ? { expandedKeys: ["item-1"] } : {},
      );
      expect(kids(parentItem.id).map((child) => child.bindingId)).toEqual([
        "treeitemchevron",
        "text",
        "treeitem",
      ]);
      expect(kids(leafItem.id).map((child) => child.bindingId)).toEqual([
        "treeitemchevron",
        "text",
      ]);
      // The old owner-composed part's box and the label beside it (main `ef1ff8c04`).
      const rows = expanded
        ? [
            { item: parentItem, chevron: [8, 12, 20, 16], labelX: 30 },
            // level 2: the button grows by its level padding (`(level − 1) × --padding`)
            {
              item: kids(parentItem.id)[2],
              chevron: [8, 8, 24, 16],
              labelX: 34,
            },
          ]
        : [
            { item: parentItem, chevron: [8, 8, 20, 16], labelX: 30 },
            { item: leafItem, chevron: [8, 8, 20, 16], labelX: 30 },
          ];
      for (const { item, chevron, labelX } of rows) {
        const [node, label] = kids(item.id);
        const geometry = root.getGeometry([node.id, label.id]);
        const box = geometry.get(node.id)!;
        expect([box.x, box.y, box.width, box.height]).toEqual(chevron);
        expect(geometry.get(label.id)!.x).toBeCloseTo(labelX, 3);
      }
      workspace.dispose();
    },
  );

  it("the DOM absorbs the chevron node (one RAC chevron button per item, no record element)", async () => {
    const { workspace, root, kids, tree, parentItem, leafItem } =
      await openTree();
    const html = renderToStaticMarkup(renderCatalogDom(root, tree.id));
    for (const item of [parentItem, leafItem]) {
      const [chevron, label] = kids(item.id);
      expect(html).not.toContain(`data-catalog-id="${chevron.id}"`);
      expect(catalogDomRendersNode(root, chevron.id)).toBe(false);
      expect(html).toContain(`data-catalog-id="${label.id}"`);
    }
    expect(html.match(/slot="chevron"/g)).toHaveLength(2);
    workspace.dispose();
  });

  it("the chevron node paints the TreeItem's leading icon, centered in its button; the item paints none", async () => {
    const { workspace, root, kids, parentItem, leafItem } = await openTree();
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    const [chevron] = kids(parentItem.id);
    const painted = getSkiaNode(chevron.id)!;
    expect(painted.elementId).toBe(chevron.id);
    const rect = root.getGeometry([chevron.id]).get(chevron.id)!;
    expect([painted.x, painted.y]).toEqual([rect.x, rect.y]);
    const [glyph] = glyphs(painted);
    expect(glyph.iconPath).toMatchObject({ cx: 10, cy: 8, size: 16 });
    expect(glyphs(getSkiaNode(parentItem.id))).toHaveLength(0);
    // A leaf item's button is hidden (`visibility: hidden` without child items): no glyph.
    expect(glyphs(getSkiaNode(kids(leafItem.id)[0].id))).toHaveLength(0);
    // The Tree's expansion turns the glyph on a delta update (the chevron repaints with its item).
    const before = JSON.stringify(glyph.iconPath?.paths);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: OWNER }],
        props: { expandedKeys: { kind: "set", value: ["item-1"] } },
      }),
    );
    canvas.update();
    const [turned] = glyphs(getSkiaNode(chevron.id));
    expect(JSON.stringify(turned.iconPath?.paths)).not.toBe(before);
    canvas.dispose();
    workspace.dispose();
  });

  it("an item with no chevron node (made before it, or detached) keeps the composed part and paints its own chevron", async () => {
    const node = (
      id: string,
      type: string,
      children: string[],
      props: Record<string, unknown> = {},
    ) => nodeEntry(id, catalogTypeDefinitionId(type), children, props);
    const workspace = await openWorkspace(() => [
      node(OWNER, "Tree", ["project:node:a", "project:node:b"]),
      node("project:node:a", "TreeItem", ["project:node:a-label", "project:node:a-1"], { id: "a" }),
      node("project:node:a-label", "Text", [], { children: "A" }),
      node("project:node:a-1", "TreeItem", ["project:node:a-1-label"], { id: "a-1" }),
      node("project:node:a-1-label", "Text", [], { children: "A1" }),
      node("project:node:b", "TreeItem", ["project:node:b-label"], { id: "b" }),
      node("project:node:b-label", "Text", [], { children: "B" }),
    ]);
    const root = workspace.root;
    const recordOf = (source: string) =>
      [...root.layoutInputs.values()].find(
        (entry) => entry.sourceId === source,
      )!;
    const item = recordOf("project:node:a");
    const label = recordOf("project:node:a-label");
    expect(root.getGeometry([label.id]).get(label.id)!.x).toBeCloseTo(30, 3);
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    const [glyph] = glyphs(getSkiaNode(item.id));
    // The row's own `leading_icon` (at `paddingX + iconSize / 2`, as before the node).
    expect(glyph.iconPath).toMatchObject({ cx: 16, cy: 16, size: 16 });
    canvas.dispose();
    workspace.dispose();
  });

  it("the chevron position is not removable", async () => {
    const { workspace, kids, parentItem } = await openTree();
    const [chevron] = kids(parentItem.id);
    let code: unknown;
    try {
      workspace.execute(
        removeTargets({
          targets: [workspace.positionOfRecord(chevron.id)!.target],
        }),
      );
    } catch (error) {
      code = (error as { code?: unknown }).code;
    }
    expect(code).toBe("OWNER_DRAWN_PART_NOT_REMOVABLE");
    workspace.dispose();
  });
});

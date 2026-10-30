// @vitest-environment jsdom
/**
 * ADR-295 Phase 3c-3c ③ — S2 Menu `size` is its items' (S2 MenuItem has none — the Menu context): a MenuItem
 * takes the Menu's size (`CATALOG_SIZE_PROPAGATION.Menu`, through a MenuSection), its S2 `menuitem` control
 * box (minimum height 24 · 32 · 40), its label the control font and its description one step down — on the
 * Canvas record and the DOM (`data-size` → the generated sheet; the Text records inline).
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
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

async function openMenu(props: Record<string, unknown>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-menu-item-size" as const,
        name: "S2 menu item size",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-menu-item-size-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const node = (
    id: string,
    type: string,
    children: string[],
    nodeProps: Record<string, unknown> = {},
  ) =>
    ({
      kind: "node",
      id: id as NodeId,
      // (Type definitions — a RAC Menu collection of plain MenuItem · MenuSection elements.)
      definitionId: (type === "Text"
        ? "lib:definition:text"
        : `lib:definition:type-${type}`) as NodeEntry["definitionId"],
      children: children as NodeId[],
      props: Object.fromEntries(
        Object.entries(nodeProps).map(([key, value]) => [
          key,
          { kind: "set", value },
        ]),
      ),
      visual: {},
      sizing: {},
      descendantOverrides: [],
    }) as NodeEntry;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        node(
          "project:node:t",
          "Menu",
          ["project:node:i1", "project:node:sec"],
          props,
        ),
        node("project:node:i1", "MenuItem", [
          "project:node:l1",
          "project:node:d1",
        ]),
        node("project:node:l1", "Text", [], {
          slot: "label",
          children: "Copy",
        }),
        node("project:node:d1", "Text", [], {
          slot: "description",
          children: "Copy the text",
        }),
        node("project:node:sec", "MenuSection", ["project:node:i2"]),
        node("project:node:i2", "MenuItem", ["project:node:l2"]),
        node("project:node:l2", "Text", [], {
          slot: "label",
          children: "Paste",
        }),
      ],
      rootIds: ["project:node:t" as NodeId],
      newId: workspace.newId,
    }),
  );
  return { root: workspace.root, workspace };
}

describe("S2 Menu size reaches its items", () => {
  it.each([
    ["S", 24, 12, 11],
    ["M", 32, 14, 12],
    ["L", 40, 16, 14],
  ])(
    "Menu %s: items %d tall, label %d · description %d, both consumers",
    async (size, height, label, description) => {
      const { root } = await openMenu({ size, selectionMode: "none" });
      const records = [...root.canvasInputs.values()];
      const items = records.filter((r) => root.typeOf(r) === "MenuItem");
      // (One item in a MenuSection — the Menu's size reaches it through the section.)
      expect(items).toHaveLength(2);
      for (const item of items) {
        expect(item.props.size).toBe(size);
        expect(root.getGeometry([item.id]).get(item.id)!.height).toBe(height);
      }
      const text = (slot: string) =>
        records.filter(
          (r) => root.typeOf(r) === "Text" && r.props.slot === slot,
        );
      for (const record of text("label")) {
        expect(record.visual.fontSize).toBe(label);
        expect(record.visual.fontWeight).toBe(500);
      }
      expect(text("description")[0]!.visual.fontSize).toBe(description);
      const menu = [...root.domInputs.values()].find(
        (r) => r.sourceId === "project:node:t",
      )!;
      const html = renderToStaticMarkup(renderCatalogDom(root, menu.id));
      expect(
        html.match(
          new RegExp(`data-size="${size}" class="react-aria-MenuItem"`, "g"),
        ),
      ).toHaveLength(2);
    },
  );
});

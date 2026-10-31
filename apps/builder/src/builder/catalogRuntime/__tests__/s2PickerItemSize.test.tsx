// @vitest-environment jsdom
/**
 * ADR-295 후속 — S2 Picker · ComboBox `size` is their items' (`InternalPickerContext` → `listboxItem({size})` ·
 * `listbox({size})`, `ComboBox.tsx`): the picker's size reaches its ListBox through the Popover and the ListBox's
 * its items (`CATALOG_SIZE_PROPAGATION` Select · ComboBox → ListBox → ListBoxItem), each item the S2 control box
 * of that size (minimum height 20 · 24 · 32 · 40 · 48). Before, the ListBox and ListBoxItem rules offered M only
 * (`propChoices.size`) and nothing propagated — a Select L listed 32px items (S2 40).
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

const node = (
  id: string,
  type: string,
  children: string[],
  nodeProps: Record<string, unknown> = {},
) =>
  ({
    kind: "node",
    id: id as NodeId,
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

async function open(entries: NodeEntry[], rootId: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-picker-item-size" as const,
        name: "S2 picker item size",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-picker-item-size-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries,
      rootIds: [rootId as NodeId],
      newId: workspace.newId,
    }),
  );
  return workspace.root;
}

const items = (prefix: string) => [
  node(`project:node:${prefix}i1`, "ListBoxItem", [`project:node:${prefix}l1`]),
  node(`project:node:${prefix}l1`, "Text", [], {
    slot: "label",
    children: "One",
  }),
  node(`project:node:${prefix}sec`, "ListBoxSection", [
    `project:node:${prefix}i2`,
  ]),
  node(`project:node:${prefix}i2`, "ListBoxItem", [`project:node:${prefix}l2`]),
  node(`project:node:${prefix}l2`, "Text", [], {
    slot: "label",
    children: "Two",
  }),
];
const itemIds = (prefix: string) => [
  `project:node:${prefix}i1`,
  `project:node:${prefix}sec`,
];

describe("S2 picker size reaches its list items", () => {
  it.each(["XS", "S", "M", "L", "XL"])(
    "Select %s: its Popover's ListBox and every item (in a section too) take the size",
    async (size) => {
      const root = await open(
        [
          node("project:node:sel", "Select", ["project:node:pop"], { size }),
          node("project:node:pop", "Popover", ["project:node:lb"]),
          node("project:node:lb", "ListBox", itemIds(""), {
            selectionMode: "single",
          }),
          ...items(""),
        ],
        "project:node:sel",
      );
      const dom = [...root.domInputs.values()];
      const of = (type: string) => dom.filter((r) => root.typeOf(r) === type);
      expect(of("ListBox").map((r) => r.props.size)).toEqual([size]);
      expect(of("ListBoxItem").map((r) => r.props.size)).toEqual([size, size]);
    },
  );

  it.each(["S", "L"])(
    "ComboBox %s: its list items take the size",
    async (size) => {
      const root = await open(
        [
          node("project:node:cb", "ComboBox", ["project:node:pop"], { size }),
          node("project:node:pop", "Popover", ["project:node:lb"]),
          node("project:node:lb", "ListBox", itemIds("")),
          ...items(""),
        ],
        "project:node:cb",
      );
      const dom = [...root.domInputs.values()];
      expect(
        dom
          .filter((r) => root.typeOf(r) === "ListBoxItem")
          .map((r) => r.props.size),
      ).toEqual([size, size]);
    },
  );

  it.each([
    ["XS", 20],
    ["S", 24],
    ["M", 32],
    ["L", 40],
    ["XL", 48],
  ])(
    "a ListBox %s: its items are the S2 control box %d tall on the Canvas, data-size on the DOM",
    async (size, height) => {
      const root = await open(
        [
          node("project:node:lb", "ListBox", itemIds(""), { size }),
          ...items(""),
        ],
        "project:node:lb",
      );
      const records = [...root.canvasInputs.values()].filter(
        (r) => root.typeOf(r) === "ListBoxItem",
      );
      expect(records).toHaveLength(2);
      for (const item of records) {
        expect(item.props.size).toBe(size);
        expect(root.getGeometry([item.id]).get(item.id)!.height).toBe(height);
      }
      const list = [...root.domInputs.values()].find(
        (r) => r.sourceId === "project:node:lb",
      )!;
      const host = document.createElement("div");
      host.innerHTML = renderToStaticMarkup(renderCatalogDom(root, list.id));
      const options = [...host.querySelectorAll(".react-aria-ListBoxItem")];
      expect(options).toHaveLength(2);
      for (const option of options)
        expect(option.getAttribute("data-size")).toBe(size);
    },
  );
});

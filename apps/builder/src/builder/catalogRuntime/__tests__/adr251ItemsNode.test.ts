// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type { NodeEntry } from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogTextMeasure } from "../compositionRoot";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-251 G1 · G4: RadioGroup · CheckboxGroup hold their items in a RadioItems / CheckboxItems
 * node (TagGroup > TagList). The wrapper is a typed record the group rule's `orientation` block
 * lays out, the group size reaches the items through it, and the DOM keeps one `div.*-items`.
 *
 * Oracle: the old structure's geometry (G0, items under the group with the Canvas-only composed
 * `::part:items`, main `db76cc301`) — every size × orientation × label position, the values that
 * differ from the defaults included (sm · lg · xl, horizontal, side).
 */
const measure: CatalogTextMeasure = (text, font) => ({
  width: text.length * font.fontSize * 0.5,
  exactWidth: text.length * font.fontSize * 0.5,
  minWidth: text.length * font.fontSize * 0.5,
  height: font.fontSize * (font.lineHeight || 1.2),
});

/** G0 per size: item gap, item height (indicator), item Label x, items top (label top), side x. */
const G0: Record<
  string,
  Record<
    string,
    { gap: number; height: number; labelX: number; topY: number; sideX: number }
  >
> = {
  RadioGroup: {
    sm: { gap: 8, height: 16, labelX: 22, topY: 24, sideX: 74 },
    md: { gap: 12, height: 20, labelX: 28, topY: 32, sideX: 89 },
    lg: { gap: 16, height: 24, labelX: 34, topY: 40, sideX: 104 },
    xl: { gap: 12, height: 30, labelX: 42, topY: 45.714287, sideX: 119 },
  },
  CheckboxGroup: {
    sm: { gap: 8, height: 16, labelX: 22, topY: 24, sideX: 92 },
    md: { gap: 12, height: 20, labelX: 28, topY: 32, sideX: 110 },
    lg: { gap: 16, height: 24, labelX: 34, topY: 40, sideX: 128 },
    xl: { gap: 12, height: 30, labelX: 42, topY: 45.714287, sideX: 146 },
  },
};

async function openGroup(owner: string, props: Record<string, string>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr251" as const,
        name: "ADR-251",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr251-${Math.random()}`),
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
      entries: [
        {
          kind: "node",
          id: "project:node:owner",
          definitionId: catalogPaletteDefinitionId(library, owner),
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [
              key,
              { kind: "set", value },
            ]),
          ),
          visual: {},
          sizing: { width: { kind: "set", value: 300 } },
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: ["project:node:owner"],
      newId: workspace.newId,
    }),
  );
  return workspace;
}

const CASES = ["RadioGroup", "CheckboxGroup"].flatMap((owner) =>
  ["sm", "md", "lg", "xl"].flatMap((size) =>
    ["vertical", "horizontal"].flatMap((orientation) =>
      ["top", "side"].map((labelPosition) => ({
        owner,
        size,
        orientation,
        labelPosition,
      })),
    ),
  ),
);

describe("ADR-251 RadioItems · CheckboxItems node", () => {
  it.each(CASES)(
    "$owner $size $orientation $labelPosition: the wrapper node lays the items out as G0",
    async ({ owner, size, orientation, labelPosition }) => {
      const workspace = await openGroup(owner, {
        size,
        orientation,
        labelPosition,
      });
      const root = workspace.root;
      const item = owner === "RadioGroup" ? "radio" : "checkbox";
      const wrapperBinding = `${item}items`;
      const group = [...root.layoutInputs.values()].find(
        (record) =>
          record.sourceId === "project:node:owner" &&
          record.bindingId === owner.toLowerCase(),
      )!;
      // Structure: Label · wrapper under the group, the items under the wrapper.
      const kids = group.children.map((id) => root.layoutInputs.get(id)!);
      expect(kids.map((record) => record.bindingId)).toEqual([
        "label",
        wrapperBinding,
      ]);
      const wrapper = kids[1];
      const items = wrapper.children.map((id) => root.layoutInputs.get(id)!);
      // An item's Label (the item's indicator node sits before it — 2026-10-04).
      const labelOf = (record: (typeof items)[number]) =>
        record.children
          .map((id) => root.layoutInputs.get(id)!)
          .find((child) => child.bindingId === "label")!;
      expect(items.map((record) => record.bindingId)).toEqual([item, item]);
      // The group size reaches the wrapper and, through it, the items and their labels.
      expect(wrapper.props.size).toBe(size);
      for (const record of items) {
        expect(record.props.size).toBe(size);
        const label = labelOf(record);
        expect(label.props.size).toBe(size);
      }
      const geometry = root.getGeometry([
        wrapper.id,
        ...items.map((record) => record.id),
        ...items.map((record) => labelOf(record).id),
      ]);
      const box = geometry.get(wrapper.id)!;
      const [first, second] = items.map((record) => geometry.get(record.id)!);
      const g0 = G0[owner][size];
      // Items (relative to the wrapper) at the size's gap along the orientation.
      if (orientation === "vertical")
        expect(second.y - (first.y + first.height)).toBeCloseTo(g0.gap, 3);
      else expect(second.x - (first.x + first.width)).toBeCloseTo(g0.gap, 3);
      expect(first.height).toBeCloseTo(g0.height, 3);
      expect(geometry.get(labelOf(items[0]).id)!.x).toBeCloseTo(g0.labelX, 3);
      // The wrapper under the label (top) or beside it (side), as the composed part was.
      if (labelPosition === "top") {
        expect(box.x + first.x).toBeCloseTo(0, 3);
        expect(box.y + first.y).toBeCloseTo(g0.topY, 3);
      } else {
        expect(box.x + first.x).toBeCloseTo(g0.sideX, 3);
        expect(box.y + first.y).toBeCloseTo(0, 3);
      }
      // DOM (G4): one wrapper div holding every item; the wrapper record renders no element.
      const dom = [...root.domInputs.values()].find(
        (record) => record.sourceId === "project:node:owner",
      )!;
      const html = renderToStaticMarkup(renderCatalogDom(root, dom.id));
      const token = `${item}-items`;
      expect(html.match(new RegExp(`class="${token}"`, "g"))).toHaveLength(1);
      const inside = html.slice(html.indexOf(`class="${token}"`));
      const itemClass = `react-aria-${item === "radio" ? "Radio" : "Checkbox"}`;
      expect(
        inside.match(new RegExp(`class="${itemClass}"`, "g")) ?? [],
      ).toHaveLength(2);
      expect(html).not.toContain(`data-catalog-id="${wrapper.id}"`);
      workspace.dispose();
    },
  );
});

// @vitest-environment jsdom
/**
 * ADR-295 후속 — S2 ColorSwatch · ColorSwatchPicker (`ColorSwatch.tsx` · `ColorSwatchPicker.tsx`):
 * - a swatch's `rounding` defaults to `default` = the `sm` corner (S2 `rounding = ctx?.rounding || 'default'`;
 *   ours was a circle — `full`);
 * - a picker's `size` is its swatches' (`InternalColorSwatchContext` — XS 16 · S 24 · M 32 · L 40) and its
 *   swatches are square (`rounding = 'none'`). Ours were fixed 28 circles whatever the picker size.
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { catalogContainerVariantPaint } from "../../../../../../packages/shared/src/catalog/runtime/rulePaint";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

async function open(definitionId: string, props: Record<string, unknown>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-color-swatch" as const,
        name: "S2 color swatch",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-color-swatch-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: "project:node:root" as NodeId,
          definitionId: definitionId as NodeEntry["definitionId"],
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
      rootIds: ["project:node:root" as NodeId],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const swatches = [...root.canvasInputs.values()].filter(
    (r) => root.typeOf(r) === "ColorSwatch",
  );
  const box = (id: string) => root.getGeometry([id]).get(id)!;
  // The painted corner: the rule's prop-conditional block (`containerVariants.rounding` — the Canvas paint
  // and the DOM `[data-rounding]` sheet) over the record's size corner.
  const corner = (record: (typeof swatches)[number]) =>
    (catalogContainerVariantPaint(
      COMPONENT_RULES_TABLE.ColorSwatch!,
      record.props,
    ).borderRadius as number | undefined) ??
    record.visual.radius ??
    0;
  return { root, swatches, box, corner };
}

describe("S2 ColorSwatch rounding · picker size", () => {
  it.each([
    [{}, 4],
    [{ rounding: "default" }, 4],
    [{ rounding: "none" }, 0],
    [{ rounding: "full" }, 9999],
  ])("a swatch %j: corner %d (S2 default = sm)", async (props, radius) => {
    const { swatches, corner } = await open(
      "lib:definition:origin-component-colorswatch",
      props,
    );
    expect(swatches).toHaveLength(1);
    expect(corner(swatches[0]!)).toBe(radius);
  });

  it.each([
    ["XS", 16],
    ["S", 24],
    ["M", 32],
    ["L", 40],
  ])(
    "a ColorSwatchPicker %s: its swatches are %d square, no corner",
    async (size, side) => {
      const { swatches, box, corner } = await open(
        "lib:definition:origin-component-colorswatchpicker",
        { size },
      );
      expect(swatches).toHaveLength(6);
      for (const swatch of swatches) {
        expect(swatch.props.size).toBe(size);
        expect(corner(swatch)).toBe(0);
        const rect = box(swatch.id);
        expect([rect.width, rect.height]).toEqual([side, side]);
      }
    },
  );
});

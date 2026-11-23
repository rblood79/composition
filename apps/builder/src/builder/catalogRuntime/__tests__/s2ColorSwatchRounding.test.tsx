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
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
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
  return { root, swatches, box, corner, workspace };
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

describe("S2 체크리스트 §9.1 — ColorSwatchPicker density · rounding (2026-11-24)", () => {
  it.each([
    [undefined, 4],
    ["compact", 2],
    ["regular", 4],
    ["spacious", 6],
  ])("density %s: the gap between its swatches is %d", async (density, gap) => {
    const { root, box } = await open(
      "lib:definition:origin-component-colorswatchpicker",
      density ? { density } : {},
    );
    // (The picker's items — a swatch's box is its item's.)
    const items = [...root.canvasInputs.values()].filter(
      (r) => root.typeOf(r) === "ColorSwatchPickerItem",
    );
    const [a, b] = [box(items[0]!.id), box(items[1]!.id)];
    expect(b.x - (a.x + a.width)).toBe(gap);
  });

  it.each([
    [undefined, 0],
    ["default", 4],
    ["full", 9999],
  ])("rounding %s: its swatches' corner is %d", async (rounding, radius) => {
    const { swatches, corner } = await open(
      "lib:definition:origin-component-colorswatchpicker",
      rounding ? { rounding } : {},
    );
    for (const swatch of swatches) expect(corner(swatch)).toBe(radius);
  });

  it("a picker edit reaches its swatches; a swatch's own rounding wins", async () => {
    const { workspace, corner } = await open(
      "lib:definition:origin-component-colorswatchpicker",
      {},
    );
    const swatchesOf = () =>
      [...workspace.root.canvasInputs.values()].filter(
        (r) => workspace.root.typeOf(r) === "ColorSwatch",
      );
    const picker = [...workspace.root.canvasInputs.values()].find(
      (r) => workspace.root.typeOf(r) === "ColorSwatchPicker",
    )!;
    workspace.execute(
      setFields({
        targets: [workspace.itemOfRecord(picker.id)!.target],
        props: { rounding: { kind: "set", value: "full" } },
      }),
    );
    expect(swatchesOf().map(corner)).toEqual(swatchesOf().map(() => 9999));
    const first = swatchesOf()[0]!;
    workspace.execute(
      setFields({
        targets: [workspace.itemOfRecord(first.id)!.target],
        props: { rounding: { kind: "set", value: "none" } },
      }),
    );
    expect(swatchesOf().map(corner)).toEqual(
      swatchesOf().map((_, index) => (index === 0 ? 0 : 9999)),
    );
  });
});

// @vitest-environment jsdom
/**
 * S2 1.8.0 boolean 시각 prop 3건 (2026-10-10 — 조사 §6.1 ③ 개별):
 * - NumberField `hideStepper`: the increment · decrement Buttons are not there (S2 renders no
 *   stepper; our template's slot "increment" · "decrement" Buttons hide — `catalogHiddenAtRest`).
 * - ToggleButtonGroup `isJustified`: the buttons divide the group's width equally (S2
 *   ActionButton `flexGrow: 1 · flexBasis: 0`). DOM `data-justified` sheet; Canvas the same
 *   flex values on each button (`styleOf`).
 * - Link `isStandalone`: not inside a paragraph — S2 medium weight (`fontWeight: 'medium'`).
 *   DOM `data-standalone` sheet; Canvas the same weight (text leaf + paint).
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
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
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { catalogSemanticContracts } from "../editContract";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const OWNER = "project:node:owner" as NodeId;

async function open(
  type: string,
  props: Record<string, unknown>,
  sizing: Record<string, unknown> = {},
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-booleans" as const,
        name: "S2 booleans",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-booleans-${Math.random()}`),
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
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [
              key,
              { kind: "set", value },
            ]),
          ),
          visual: {},
          sizing,
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const record = [...root.domInputs.values()].find(
    (item) => item.sourceId === OWNER,
  )!;
  const html = renderToStaticMarkup(renderCatalogDom(root, record.id));
  return { workspace, root, record, html, definitionId };
}

describe("S2 NumberField hideStepper", () => {
  it("the Design panel offers Hide Stepper", async () => {
    const { definitionId } = await open("NumberField", {});
    expect(
      catalogSemanticContracts(definitionId, "NumberField").hideStepper,
    ).toMatchObject({ kind: "boolean" });
  });

  it("default: the stepper buttons are there in both consumers", async () => {
    const { root, html } = await open("NumberField", { label: "Qty" });
    const steppers = [...root.domInputs.values()].filter(
      (item) =>
        item.props.slot === "increment" || item.props.slot === "decrement",
    );
    expect(steppers).toHaveLength(2);
    expect(steppers.every((item) => !item.hidden)).toBe(true);
    expect(html).toContain('slot="increment"');
  });

  it("toggling hideStepper after insert re-judges the steppers (live path)", async () => {
    const { workspace, root } = await open("NumberField", { label: "Qty" });
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: OWNER }],
        props: { hideStepper: { kind: "set", value: true } },
      }),
    );
    const steppers = [...root.domInputs.values()].filter(
      (item) =>
        item.props.slot === "increment" || item.props.slot === "decrement",
    );
    expect(steppers).toHaveLength(2);
    expect(steppers.every((item) => item.hidden)).toBe(true);
  });

  it("hideStepper: the stepper buttons are not there in both consumers", async () => {
    const { root, html } = await open("NumberField", {
      label: "Qty",
      hideStepper: true,
    });
    const steppers = [...root.domInputs.values()].filter(
      (item) =>
        item.props.slot === "increment" || item.props.slot === "decrement",
    );
    expect(steppers).toHaveLength(2);
    expect(steppers.every((item) => item.hidden)).toBe(true);
    expect(html).not.toContain('slot="increment"');
  });
});

describe("S2 ToggleButtonGroup isJustified", () => {
  it("the Design panel offers Justified", async () => {
    const { definitionId } = await open("ToggleButtonGroup", {});
    expect(
      catalogSemanticContracts(definitionId, "ToggleButtonGroup").isJustified,
    ).toMatchObject({ kind: "boolean" });
  });

  it("justified: data-justified and the buttons divide the group's width equally", async () => {
    const { root, html, record } = await open(
      "ToggleButtonGroup",
      { isJustified: true },
      { width: { kind: "set", value: 600 } },
    );
    expect(html).toContain("data-justified");
    const buttons = record.children
      .map((id) => root.domInputs.get(id)!)
      .filter((child) => child !== undefined);
    expect(buttons.length).toBeGreaterThan(1);
    const geometry = root.getGeometry(buttons.map((child) => child.id));
    const widths = buttons.map(
      (child) => (geometry.get(child.id) as { width: number }).width,
    );
    const gap = 8 * (widths.length - 1);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(widths.reduce((a, b) => a + b, 0) - (600 - gap)),
    ).toBeLessThanOrEqual(widths.length);
  });

  it("default: no data-justified, the buttons keep their fit widths", async () => {
    const { root, html, record } = await open(
      "ToggleButtonGroup",
      {},
      { width: { kind: "set", value: 600 } },
    );
    expect(html).not.toContain("data-justified");
    const buttons = record.children.map((id) => root.domInputs.get(id)!);
    const geometry = root.getGeometry(buttons.map((child) => child.id));
    const sum = buttons.reduce(
      (total, child) =>
        total + (geometry.get(child.id) as { width: number }).width,
      0,
    );
    expect(sum).toBeLessThan(500);
  });
});

describe("S2 Link isStandalone", () => {
  it("the Design panel offers Standalone", async () => {
    const { definitionId } = await open("Link", {});
    expect(
      catalogSemanticContracts(definitionId, "Link").isStandalone,
    ).toMatchObject({ kind: "boolean" });
  });

  interface PaintedText {
    text?: { fontWeight?: number };
    children?: PaintedText[];
  }
  // The Link's glyph is a nested text SkiaNodeData under the box node.
  const textOf = (node: PaintedText | undefined): number | undefined =>
    node?.text?.fontWeight ??
    (node?.children ?? [])
      .map((child) => textOf(child))
      .find((weight) => weight !== undefined);

  it("standalone: data-standalone and the Canvas text at medium weight (500)", async () => {
    const { root, html, record } = await open("Link", {
      children: "More",
      isStandalone: true,
    });
    expect(html).toContain('data-standalone="true"');
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    const weight = textOf(getSkiaNode(record.id) as unknown as PaintedText);
    canvas.dispose();
    expect(weight).toBe(500);
  });

  it("default: no data-standalone, the text stays 400", async () => {
    const { root, html, record } = await open("Link", { children: "More" });
    expect(html).not.toContain("data-standalone");
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    const weight = textOf(getSkiaNode(record.id) as unknown as PaintedText);
    canvas.dispose();
    expect(weight).toBe(400);
  });
});

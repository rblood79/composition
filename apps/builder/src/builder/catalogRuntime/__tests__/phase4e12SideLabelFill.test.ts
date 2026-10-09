// @vitest-environment jsdom
/**
 * ADR-248 4e-12 — two live defects (2026-10-03):
 *   1. `labelPosition: "side"` — the generated CSS lays the field family out in a row
 *      (`[data-label-position="side"]` + nested child selectors); the new Canvas read none of it,
 *      and four DOM bindings dropped the prop (Select · ComboBox · DatePicker · DateRangePicker).
 *   2. Fills authored on a palette insert (a composite instance) never reached its record: the
 *      collapsed record took the template root's fields only.
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
import type { CatalogTextMeasure } from "../compositionRoot";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
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

async function openOwner(type: string, extra: Partial<NodeEntry> = {}) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:side" as const,
        name: "Side",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr248-4e12-${Math.random()}`),
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
          definitionId: catalogPaletteDefinitionId(library, type),
          children: [],
          props: {},
          visual: {},
          sizing: { width: { kind: "set", value: 420 } },
          descendantOverrides: [],
          ...extra,
        } as NodeEntry,
      ],
      rootIds: ["project:node:owner"],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const owner = [...root.domInputs.values()].find(
    (record) => record.sourceId === "project:node:owner",
  )!;
  const child = (type: string) =>
    owner.children
      .map((id) => root.canvasInputs.get(id)!)
      .find((record) => root.typeOf(record) === type)!;
  const box = (id: string) => root.getGeometry([id]).get(id)!;
  return { workspace, root, owner, child, box };
}

const side = {
  props: { labelPosition: { kind: "set", value: "side" } },
} as Partial<NodeEntry>;

describe("ADR-248 4e-12 labelPosition side", () => {
  it("a side TextField puts its label column (its text's width) beside the input (one row)", async () => {
    const { owner, child, box } = await openOwner("TextField", side);
    const label = box(child("Label").id);
    const input = box(child("Input").id);
    // `[data-label-position="side"]` is a grid `auto minmax(0, 1fr)` (S2 `field()`, 2026-10-10):
    // the label column is its text's width (no Form gives `--form-label-width`), in the middle of
    // the input's row.
    expect(label.width).toBeGreaterThan(0);
    expect(label.width).toBeLessThan(176);
    expect(label.y + label.height / 2).toBeCloseTo(input.y + input.height / 2, 0);
    expect(input.x).toBeGreaterThan(label.x + label.width);
    // `> :not(.react-aria-Label, …) { grid-column: 2 }`: the input takes the rest of the row.
    expect(input.x + input.width).toBeCloseTo(box(owner.id).width, 0);
  });

  it("a side label column paints its alignment (labelAlign) and binds on the Canvas", async () => {
    const { root, child } = await openOwner("TextField", {
      props: {
        labelPosition: { kind: "set", value: "side" },
        labelAlign: { kind: "set", value: "end" },
      },
    } as Partial<NodeEntry>);
    // `[data-label-align="end"] { --form-label-align: end }` → the side Label's `text-align`.
    expect(child("Label").visual.textAlign).toBe("end");
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    expect(getSkiaNode(child("Label").id)).toBeDefined();
    canvas.dispose();
  });

  it("a Disclosure still binds (side text alignment stays out of rule nodes)", async () => {
    const { root } = await openOwner("Disclosure");
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    canvas.dispose();
  });

  it("a top TextField keeps the label above the input", async () => {
    const { child, box } = await openOwner("TextField");
    expect(box(child("Input").id).y).toBeGreaterThan(box(child("Label").id).y);
  });

  it("a side ProgressBar orders label · track · value in one row (CSS `order`)", async () => {
    const { child, box } = await openOwner("ProgressBar", side);
    const label = box(child("Label").id);
    const track = box(child("ProgressBarTrack").id);
    const value = box(child("ProgressBarValue").id);
    expect(track.x).toBeGreaterThanOrEqual(label.x + label.width);
    expect(value.x).toBeGreaterThanOrEqual(track.x + track.width);
  });

  it("switching side back to top restores the source order", async () => {
    const { workspace, root, owner, child, box } = await openOwner(
      "ProgressBar",
      side,
    );
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: "project:node:owner" as NodeId }],
        props: { labelPosition: { kind: "set", value: "top" } },
      }),
    );
    expect(root.domInputs.get(owner.id)!.props.labelPosition).toBe("top");
    expect(box(child("ProgressBarTrack").id).y).toBeGreaterThan(
      box(child("Label").id).y,
    );
  });

  it.each(["Select", "ComboBox", "DatePicker", "DateRangePicker"])(
    "the %s DOM carries data-label-position=side",
    async (type) => {
      const { root, owner } = await openOwner(type, side);
      const html = renderToStaticMarkup(renderCatalogDom(root, owner.id));
      expect(html).toMatch(/data-label-position="side"/);
    },
  );
});

describe("ADR-248 4e-12 composite instance fills", () => {
  const layer = {
    id: "fill-1",
    kind: "color",
    color: "#112233FF",
    enabled: true,
    opacity: 1,
    blendMode: "normal",
  };

  it("a palette TextField's own fills reach its record, the Canvas and the DOM", async () => {
    const { root, owner } = await openOwner("TextField", {
      fills: [layer],
    } as Partial<NodeEntry>);
    expect(owner.fills).toEqual([layer]);
    const html = renderToStaticMarkup(renderCatalogDom(root, owner.id));
    expect(html).toMatch(/background(-color)?:\s*(#112233|rgb\(17, 34, 51\))/i);
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    const paint = getSkiaNode(owner.id)!;
    expect(JSON.stringify(paint.box)).toMatch(/0\.0666|0\.0667/);
    canvas.dispose();
  });

  it("a palette instance's authored layout reaches its record (over the root's rules)", async () => {
    const { owner } = await openOwner("TextField", {
      layout: {
        flexDirection: { kind: "set", value: "row" },
        marginLeft: { kind: "set", value: "7px" },
      },
    } as Partial<NodeEntry>);
    expect(owner.layout.flexDirection).toBe("row");
    expect(owner.layout.marginLeft).toBe("7px");
    expect(owner.authoredLayout).toEqual({ flexDirection: "row", marginLeft: "7px" });
  });
});

// @vitest-environment jsdom
/**
 * S2 1.8.0 Slider · TagGroup `labelAlign` (start · end — S2 `Alignment`, 2026-10-10 조사 문서 6.1 다):
 * the Design panel offers it beside a side label, the DOM owner carries `data-label-align`, and the
 * Canvas label paints the rule's block. A side label is its text's width (S2 side label column
 * `auto` — as Meter · ProgressBar, 사용자 2026-10-10 「slider 는 label width 가 fit content 가 정상
 * 적용되지 않고있다」); the track / tag list takes the rest of the row.
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
import type { CatalogTextMeasure } from "../compositionRoot";
import { renderCatalogDom } from "../domBinding";
import { catalogSemanticContracts } from "../editContract";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const OWNER = "project:node:owner" as NodeId;
/** A fixed-advance text measure (no fonts here) — a fit-content label gets its text's width. */
const measure: CatalogTextMeasure = (value, font) => ({
  width: value.length * font.fontSize * 0.5,
  exactWidth: value.length * font.fontSize * 0.5,
  minWidth: value.length * font.fontSize * 0.5,
  height: font.fontSize * (font.lineHeight || 1.2),
});

async function openGroup(type: string, props: NodeEntry["props"]) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:slider-tag-label-align" as const,
        name: "Slider TagGroup label align",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `slider-tag-label-align-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      textMeasure: measure,
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
  const filler = owner.children
    .map((id) => root.canvasInputs.get(id)!)
    .find((record) =>
      ["SliderTrack", "TagList"].includes(root.typeOf(record)),
    )!;
  const geometry = root.getGeometry([label.id, filler.id, owner.id]);
  const box = (id: string) =>
    geometry.get(id) as { x: number; width: number };
  const width = box(label.id).width;
  /** How far the track / list reaches toward the owner's end (its right edge, owner-relative). */
  const fillerEnd = box(filler.id).x + box(filler.id).width;
  return { definitionId, label, html, width, fillerEnd };
}

describe.each(["Slider", "TagGroup"])("S2 %s labelAlign", (type) => {
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
      const { label, html, width } = await openGroup(type, {
        labelPosition: { kind: "set", value: "side" },
        labelAlign: { kind: "set", value: align },
      });
      expect(html).toContain(`data-label-align="${align}"`);
      expect(label.visual.textAlign).toBe(align);
      // (the label is its text — not the fields' 176px column)
      expect(width).toBeGreaterThan(0);
      expect(width).toBeLessThan(100);
    },
  );

  it("start (unset) keeps the label at the column start", async () => {
    const { label, html } = await openGroup(type, {
      labelPosition: { kind: "set", value: "side" },
    });
    expect(html).not.toContain("data-label-align");
    expect(label.visual.textAlign).toBe("start");
  });

  it("side: the label is its text's width and the track / list takes the rest of the row", async () => {
    const { width, fillerEnd } = await openGroup(type, {
      labelPosition: { kind: "set", value: "side" },
    });
    expect(width).toBeGreaterThan(0);
    expect(width).toBeLessThan(100);
    // (the owner is 420 wide — a Slider's output sits after its track)
    expect(fillerEnd).toBeGreaterThan(type === "Slider" ? 340 : 410);
  });
});

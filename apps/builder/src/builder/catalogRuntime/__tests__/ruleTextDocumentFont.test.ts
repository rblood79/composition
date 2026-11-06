import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogAuthoredVisual } from "../../../../../../packages/shared/src/catalog/runtime/libraryVisual";
import type { CatalogTextFont, CatalogTextMeasure } from "../compositionRoot";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { catalogRuleShapes } from "../ruleShapes";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * Text a rule draws follows the document font like the DOM box it mirrors (사용자 2026-11-07 「한글폰트가
 * 아니라서 그렇다」): a placeholder drew the code default sans at weight 500 while its Label drew the
 * locale's or theme's font, so a Korean placeholder was all missing-glyph boxes on the Canvas.
 */
const BODY = "project:node:home-body" as NodeId;
const NODE = "project:node:subject" as NodeId;
const LOCALE_FONT = "adobe-clean-han-japanese";

async function place(type: string) {
  const fonts: { text: string; font: CatalogTextFont }[] = [];
  const measure: CatalogTextMeasure = (text, font) => {
    fonts.push({ text, font });
    const width = text.length * font.fontSize * 0.5;
    return {
      width,
      exactWidth: width,
      minWidth: width,
      height: font.fontSize * (font.lineHeight || 1.2),
    };
  };
  const graph = new CatalogGraph(
    newCatalogProjectDocument({
      projectId: "project:project:rule-text-font" as EntryId<"project">,
      name: "Font",
    }),
    await buildCodeCatalogLibrary(),
  );
  const workspace = new CatalogWorkspace(
    graph,
    new CatalogStorage(indexedDB, `rule-text-font-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
      locale: "ja-JP",
      textMeasure: measure,
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: NODE,
          definitionId: catalogPaletteDefinitionId(graph.library, type),
          children: [],
          props: type === "Kbd" ? { children: { kind: "set", value: "K" } } : {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [NODE],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const textOf = (type: string) => {
    const [id, record] = [...root.canvasInputs.entries()].find(
      ([, node]) => root.typeOf(node) === type,
    )!;
    const box = root.getGeometry([id]).get(id) as {
      width: number;
      height: number;
    };
    return catalogRuleShapes({
      node: { ...record, props: { ...record.props, ...record.derivedProps } },
      rect: { width: box.width, height: box.height },
      rule: workspace.runtime.graph.library.rules.get(type as never)!,
      type,
      authoredVisual: catalogAuthoredVisual(root, record),
    }).find((shape) => shape.type === "text") as unknown as
      | { fontFamily: string; fontWeight: number }
      | undefined;
  };
  return { fonts, root, textOf };
}

describe("rule text follows the document font", () => {
  it("an Input draws its placeholder in the locale font at the DOM's weight", async () => {
    const { textOf } = await place("TextField");
    const text = textOf("Input")!;
    expect(text.fontFamily).toContain(LOCALE_FONT);
    expect(text.fontWeight).toBe(400);
  });

  it("a variant's own family stays over the document font", async () => {
    const { textOf } = await place("Kbd");
    expect(textOf("Kbd")!.fontFamily).toContain("JetBrains Mono");
  });

  it("a date input measures its segments in the font it draws them with", async () => {
    const { fonts, root } = await place("DateField");
    const id = [...root.canvasInputs.values()].find(
      (node) => root.typeOf(node) === "DateInput",
    )!.id;
    const texts = new Set(root.dateSegmentPaint(id)!.runs.map((run) => run.text));
    const measured = fonts.filter(({ text }) => texts.has(text));
    expect(measured.length).toBeGreaterThan(0);
    for (const { font } of measured) {
      expect(font.fontFamily).toContain(LOCALE_FONT);
      expect(font.locale).toBe("ja-JP");
    }
  });
});

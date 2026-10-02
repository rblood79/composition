// @vitest-environment jsdom
/**
 * ADR-248 4e-10 G3 FileUpload: the file trigger is the self-composed `.react-aria-FileTrigger`
 * button (the root, no wrapper since 2026-09-10), so the rule's box — size height/padding, variant
 * fill/border — is that button's box in both consumers (generated CSS and the Canvas layout input).
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type { NodeEntry } from "../../../../../../packages/shared/src/catalog/document/types";
import { openStylesFixture } from "../../panels/styles/__tests__/support/catalogStylesFixture";
import type { SkiaNodeData } from "../../workspace/canvas/skia/nodeRendererTypes";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import type { CatalogTextMeasure } from "../compositionRoot";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const GENERATED = resolve(
  __dirname,
  "../../../../../../packages/shared/src/components/styles/generated",
);
const blockOf = (css: string, selector: string) => {
  const start = css.indexOf(`${selector} {`);
  return start < 0 ? "" : css.slice(start, css.indexOf("}", start));
};

describe("FileTrigger — rule box on the trigger button", () => {
  it("generated CSS carries the size box and the variant paint", () => {
    const css = readFileSync(`${GENERATED}/FileTrigger.css`, "utf8");
    const md = blockOf(css, '.react-aria-FileTrigger[data-size="md"]');
    expect(md).toContain("height: 40px;");
    expect(md).toContain("padding: 0px 24px;");
    expect(css).toContain('.react-aria-FileTrigger[data-variant="default"]');
    expect(blockOf(css, ".react-aria-FileTrigger")).not.toContain(
      "display: inline-block;",
    );
  });

  it("the Canvas layout input carries the same box", async () => {
    const fixture = await openStylesFixture([{ id: "ft", type: "FileTrigger" }]);
    const input = fixture.workspace.root.getLayoutInput(fixture.recordOf("ft"));
    expect(input).toMatchObject({
      display: "inline-flex",
      height: "40px",
      paddingLeft: "24px",
      paddingRight: "24px",
    });
  });
});

/**
 * A rule-backed text leaf the layout kept on one line paints on one line — at its fractional
 * max-content box (CSS does not wrap a box sized to its own max-content), like a plain text leaf
 * (`textWraps`). Only a leaf the layout wrapped paints wrapped.
 */
describe("rule-backed text — the layout's wrap decision", () => {
  // Fractional advances: the box is the exact max-content, which a paragraph laid out at that
  // width may wrap on a sub-pixel.
  const measure: CatalogTextMeasure = (text, font, maxWidth) => {
    const width = text.length * 7.13;
    const line = font.fontSize * (font.lineHeight || 1.2);
    if (maxWidth === undefined || maxWidth + 0.5 >= width)
      return { width, exactWidth: width, minWidth: 40, height: line };
    return { width: maxWidth, height: 2 * line };
  };
  async function open(sizing: NodeEntry["sizing"]) {
    const library = await buildCodeCatalogLibrary();
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:wrap" as const,
          name: "Wrap",
        }),
        library,
      ),
      new CatalogStorage(indexedDB, `adr248-4e10-wrap-${Math.random()}`),
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
            id: "project:node:ft",
            definitionId: catalogPaletteDefinitionId(library, "FileTrigger"),
            children: [],
            props: { children: { kind: "set", value: "Select files" } },
            visual: {},
            sizing,
            descendantOverrides: [],
          } as NodeEntry,
        ],
        rootIds: ["project:node:ft"],
        newId: workspace.newId,
      }),
    );
    return workspace;
  }
  const textOf = (data: SkiaNodeData | undefined): SkiaNodeData["text"] =>
    data?.text ??
    (data?.children ?? []).map(textOf).find((text) => text !== undefined);

  it("kept on one line → painted unwrapped", async () => {
    const workspace = await open({});
    const record = workspace.root.recordsOfSource("project:node:ft")[0]!;
    expect(workspace.root.textWraps(record)).toBe(false);
    const canvas = bindCatalogCanvas(workspace.root, workspace.root.pageRootRecords());
    expect(textOf(getSkiaNode(record))).toMatchObject({
      content: "Select files",
      whiteSpace: "nowrap",
    });
    canvas.dispose();
    workspace.dispose();
  });

  it("wrapped by the layout → painted wrapped", async () => {
    const workspace = await open({ width: { kind: "set", value: 90 } });
    const record = workspace.root.recordsOfSource("project:node:ft")[0]!;
    expect(workspace.root.textWraps(record)).toBe(true);
    const canvas = bindCatalogCanvas(workspace.root, workspace.root.pageRootRecords());
    expect(textOf(getSkiaNode(record))?.whiteSpace).not.toBe("nowrap");
    canvas.dispose();
    workspace.dispose();
  });
});

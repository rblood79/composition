// @vitest-environment jsdom
/**
 * S2 1.8.0 Table `isQuiet` (2026-10-10 — 조사 §6.1 ③): 바깥 틀이 없다 — 배경 transparent
 * (rule fill.quiet) · 테두리 색 지움 · radius 0 (rule containerVariants.quiet — Canvas 는 rule
 * 집행기의 containerVariantPaint, DOM 은 `Table.css` 의 `[data-quiet]` 블록이 같은 값).
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
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

const OWNER = "project:node:table" as NodeId;

async function open(props: Record<string, unknown>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:table-quiet" as const,
        name: "Table quiet",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `table-quiet-${Math.random()}`),
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
          id: OWNER,
          definitionId: catalogPaletteDefinitionId(library, "Table"),
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
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const record = [...root.domInputs.values()].find(
    (item) => item.sourceId === OWNER,
  )!;
  const html = renderToStaticMarkup(renderCatalogDom(root, record.id));
  const canvas = bindCatalogCanvas(root, root.pageRootRecords());
  const painted = getSkiaNode(record.id) as unknown as {
    box?: {
      fillColor?: Float32Array | number[];
      borderRadius?: number | number[];
    };
  };
  canvas.dispose();
  return { record, html, painted };
}

const radiusOf = (value: number | number[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

describe("S2 Table isQuiet", () => {
  it("the Design panel offers Quiet", async () => {
    const { record } = await open({});
    expect(
      catalogSemanticContracts(
        record.definitionId as Parameters<typeof catalogSemanticContracts>[0],
        "Table",
      ).isQuiet,
    ).toMatchObject({ kind: "boolean" });
  });

  it("quiet: data-quiet, a transparent frame and square corners in both consumers", async () => {
    const { html, painted } = await open({ isQuiet: true });
    expect(html).toContain('data-quiet="true"');
    expect(radiusOf(painted.box?.borderRadius)).toBe(0);
    const fill = painted.box?.fillColor;
    expect(fill && [...fill][3]).toBe(0);
  });

  it("default: the frame stays (no data-quiet, the base fill)", async () => {
    const { html, painted } = await open({});
    expect(html).not.toContain("data-quiet");
    const fill = painted.box?.fillColor;
    expect(fill && [...fill][3]).not.toBe(0);
    expect(radiusOf(painted.box?.borderRadius)).not.toBe(0);
  });

  it("the Table sheet shows the quiet frame (the same values)", () => {
    const sheet = readFileSync(
      join(
        __dirname,
        "../../../../../../packages/shared/src/components/styles/Table.css",
      ),
      "utf8",
    );
    expect(sheet).toMatch(
      /\.react-aria-Table\[data-quiet\] \{[^}]*border-color: transparent;[^}]*border-radius: 0;[^}]*background: transparent;/,
    );
  });
});

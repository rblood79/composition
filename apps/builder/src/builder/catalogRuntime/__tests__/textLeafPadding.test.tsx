// @vitest-environment jsdom
/**
 * 2026-10-14 (the Button padding spill's sibling pattern — 사용자 「padding 문제 발생 가능성 있는 패턴
 * 더 찾아」): the Canvas text binding (`bindings.text` — Text · Label · Heading · Paragraph …)
 * painted its text at inset 0 over the whole box whatever the document's padding sides, while the
 * layout and the DOM used them (`catalogBoxModel`). A Text with `paddingLeft: 13` kept its box but
 * drew the glyphs 13px left of the Preview's.
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
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const set = <T,>(value: T) => ({ kind: "set" as const, value });
const SIDES = { top: 7, right: 3, bottom: 1, left: 13 };

async function paint(type: string, border: number) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:text-padding" as const,
        name: "Text padding",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `text-padding-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const id = `project:node:${type}` as NodeId;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id,
          definitionId: catalogPaletteDefinitionId(library, type),
          children: [],
          props: { children: set("Hello") },
          visual: {
            paddingTop: set(SIDES.top),
            paddingRight: set(SIDES.right),
            paddingBottom: set(SIDES.bottom),
            paddingLeft: set(SIDES.left),
            ...(border
              ? { borderWidth: set(border), borderColor: set("#ff0000") }
              : {}),
          },
          sizing: { width: set(200) },
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [id],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const record = [...root.canvasInputs.values()].find(
    (item) => item.sourceId === id,
  )!;
  const canvas = bindCatalogCanvas(root, root.pageRootRecords());
  const data = getSkiaNode(record.id) as unknown as {
    width: number;
    text: { paddingLeft: number; paddingTop: number; maxWidth: number };
  };
  canvas.dispose();
  workspace.dispose();
  return data;
}

describe("Canvas text leaves — the authored padding sides", () => {
  it.each(["Text", "Label", "Heading", "Paragraph"])(
    "%s: its text sits inside the sides the layout and the DOM use",
    async (type) => {
      const data = await paint(type, 0);
      expect(data.text.paddingLeft).toBe(SIDES.left);
      expect(data.text.paddingTop).toBe(SIDES.top);
      expect(data.text.maxWidth).toBeCloseTo(
        data.width - SIDES.left - SIDES.right,
        3,
      );
    },
  );

  it("a border adds to the inset (the padding box is inside it)", async () => {
    const data = await paint("Text", 2);
    expect(data.text.paddingLeft).toBe(SIDES.left + 2);
    expect(data.text.paddingTop).toBe(SIDES.top + 2);
    expect(data.text.maxWidth).toBeCloseTo(
      data.width - SIDES.left - SIDES.right - 4,
      3,
    );
  });
});

/**
 * (2026-11-14, 사용자 「Pagination width · height fit-content」) A Pagination is as large as its row
 * of buttons — it does not fill its parent. Canvas (the rule's `containerStyles`) and the generated
 * sheet carry the same value.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const OWNER = "project:node:pagination" as NodeId;
const PAGE_WIDTH = 1000;

describe("Pagination box", () => {
  it("hugs its buttons in the Canvas and the generated sheet", async () => {
    const library = await buildCodeCatalogLibrary();
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:pagination-fit" as const,
          name: "Pagination fit",
        }),
        library,
      ),
      new CatalogStorage(indexedDB, `pagination-fit-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: PAGE_WIDTH, height: 800 },
        autosaveSchedule: () => {},
      },
    );
    try {
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: "project:node:home-body" as NodeId },
          entries: [
            {
              kind: "node",
              id: OWNER,
              definitionId: catalogPaletteDefinitionId(library, "Pagination"),
              children: [],
              props: {},
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
      const record = [...root.canvasInputs.values()].find(
        (item) => item.sourceId === OWNER,
      )!;
      const geometry = root.getGeometry([record.id, ...record.children]);
      const box = geometry.get(record.id)!;
      const buttons = record.children.map((id) => geometry.get(id)!);
      const last = buttons[buttons.length - 1]!;
      expect(buttons.length).toBeGreaterThan(1);
      expect(box.width).toBeLessThan(PAGE_WIDTH / 2);
      // The row ends at its last button — no free space spread between them.
      expect(last.x + last.width).toBeCloseTo(box.width, 0);
      expect(box.height).toBe(Math.max(...buttons.map((b) => b.height)));

      const sheet = readFileSync(
        join(
          dirname(fileURLToPath(import.meta.url)),
          "../../../../../../packages/shared/src/components/styles/generated/Pagination.css",
        ),
        "utf8",
      );
      expect(sheet).toContain("width: fit-content;");
      expect(sheet).toContain("height: fit-content;");
    } finally {
      workspace.dispose();
    }
  });
});

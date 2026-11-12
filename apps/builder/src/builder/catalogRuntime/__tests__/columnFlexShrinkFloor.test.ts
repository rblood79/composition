import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { createCatalogStylesHost } from "../../panels/styles/catalog/catalogStylesHost";
import { newCatalogProjectDocument } from "../project";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BODY = "project:node:home-body" as NodeId;

/**
 * A definite-height column flex box whose items overflow it (2026-11-13 user report — a `flex
 * column` + gap body): Chrome's automatic minimum size (CSS-FLEXBOX-1 §4.5) keeps an item with
 * visible overflow at its content size — an Icon (an 18 × 18 glyph box) is not squeezed. Only a
 * scroll container's (overflow hidden · auto) minimum is 0.
 */
describe("column flex: an item's automatic minimum keeps it from shrinking", () => {
  it("keeps an Icon at its glyph size in an overflowing fixed-height column", async () => {
    const ws = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:shrink",
          name: "shrink",
        }),
        await buildCodeCatalogLibrary(),
      ),
      new CatalogStorage(indexedDB, `shrink-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 800, height: 600 },
        autosaveSchedule: () => {},
      },
    );
    const host = createCatalogStylesHost(ws);
    ws.selectRecords([ws.root.recordsOfSource(BODY)[0]]);
    // (An authored height: the body is fixed — the author's choice, Chrome squeezes its items.)
    host.updateStyles({
      display: "flex",
      flexDirection: "column",
      rowGap: "24px",
      height: "300px",
    });
    const entries: NodeEntry[] = [
      {
        kind: "node",
        id: "project:node:icon" as NodeId,
        definitionId: "lib:definition:type-Icon",
        children: [],
        props: { iconName: { kind: "set", value: "settings" } },
        visual: {},
        sizing: {},
        descendantOverrides: [],
      },
      {
        kind: "node",
        id: "project:node:tall" as NodeId,
        definitionId: "lib:definition:type-frame",
        children: [],
        props: {},
        visual: {},
        sizing: { height: { kind: "set", value: 400 } },
        descendantOverrides: [],
      },
    ];
    ws.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries,
        rootIds: entries.map((e) => e.id),
        newId: ws.newId,
      }),
    );
    const rect = (sourceId: string) => {
      const id = ws.root.recordsOfSource(sourceId)[0];
      return ws.root.getGeometry([id]).get(id)!;
    };
    const icon = rect("project:node:icon");
    expect(icon.height).toBe(icon.width);
    expect(icon.height).toBeGreaterThan(0);
    // (An empty box's content size is 0, so min(specified, content) = 0: it takes the shrink —
    // Chrome: an empty `height: 400px` item in a 300 column 400 → 224.)
    expect(rect("project:node:tall").height).toBeLessThan(400);
  });
});

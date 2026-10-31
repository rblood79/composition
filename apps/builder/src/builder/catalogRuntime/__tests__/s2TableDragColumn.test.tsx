// @vitest-environment jsdom
/**
 * ADR-295 후속 — S2 / RAC Table's drag column (`TableView.tsx` · RAC reference `Table`: `allowsDragging
 * && <Column />` · `<Cell><Button slot="drag" /></Cell>`): a Table whose rules drag its items (a drag
 * and drop rule — `collectionDragState.ts`, the Preview's `dragAndDropHooks` read the same) puts a
 * 16px column first — the Canvas an empty first cell in its header row and every Row, the DOM a
 * RAC Column and in each Row a RAC Cell holding RAC's drag Button. Without such a rule: no column.
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  InteractionEntry,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import {
  catalogInteractionsCommand,
  catalogNewInteraction,
} from "../interactions";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const TABLE = "project:node:table" as NodeId;

async function open() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-table-drag" as const,
        name: "S2 table drag",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-table-drag-${Math.random()}`),
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
          id: TABLE,
          definitionId: catalogPaletteDefinitionId(library, "Table"),
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [TABLE],
      newId: workspace.newId,
    }),
  );
  const graph = workspace.runtime.graph;
  const project = graph.getEntry(graph.projectId);
  const home = (project?.kind === "project" ? project.pageIds[0] : undefined)!;
  const owner = { ownerId: TABLE };
  const setRules = (trigger: string | undefined) =>
    workspace.execute(
      catalogInteractionsCommand(
        owner,
        trigger
          ? [
              catalogNewInteraction(
                owner,
                trigger,
                { opcode: "navigate", pageId: home as EntryId<"page"> },
                workspace.newId,
              ),
            ]
          : [],
        "Rules",
      ),
    );
  const read = () => {
    const root = workspace.root;
    const records = [...root.canvasInputs.values()];
    const of = (type: string) => records.filter((r) => root.typeOf(r) === type);
    const header = of("TableHeader")[0]!;
    const rows = of("Row");
    const columns = of("Column");
    const box = (id: string) => root.getGeometry([id]).get(id)!;
    const table = [...root.domInputs.values()].find(
      (r) => r.sourceId === TABLE,
    )!;
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(renderCatalogDom(root, table.id));
    return { root, header, rows, columns, box, host };
  };
  return { workspace, setRules, read };
}

describe("S2 Table drag column", () => {
  it("no drag rule: no drag column (Canvas tracks · DOM)", async () => {
    const { read } = await open();
    const { header, host, columns, box } = read();
    expect(header.derivedProps?._allowsDragging).toBeUndefined();
    expect(String(header.derivedProps?._tableTracks)).not.toMatch(/^16px /);
    expect(box(columns[0]!.id).x).toBe(0);
    expect(host.querySelector("[data-drag-column]")).toBeNull();
    expect(host.querySelector("[data-drag-cell]")).toBeNull();
  });

  it.each(["onReorder", "onDragEnd"])(
    "a %s rule: a 16px drag column first — Canvas empty cell, DOM RAC Column + Cell with the drag Button",
    async (trigger) => {
      const { setRules, read } = await open();
      setRules(trigger);
      const { header, rows, columns, box, host } = read();
      for (const record of [header, ...rows]) {
        expect(record.derivedProps?._allowsDragging).toBe(true);
        expect(String(record.derivedProps?._tableTracks)).toMatch(/^16px /);
      }
      // The first authored Column starts 16px into its row (the drag cell before it — geometry is
      // parent-relative).
      expect(box(columns[0]!.id).x).toBe(16);
      const dragColumn = host.querySelector("[data-drag-column]");
      expect(dragColumn?.getAttribute("role")).toBe("columnheader");
      expect(dragColumn?.textContent).toBe("Drag");
      const cells = host.querySelectorAll("[data-drag-cell]");
      expect(cells).toHaveLength(rows.length);
      for (const cell of cells) {
        expect(cell.getAttribute("role")).toBe("gridcell");
        expect(
          cell.querySelector('button[slot="drag"], [slot="drag"]'),
        ).not.toBeNull();
      }
    },
  );

  it("a drag rule edited in place to another event: the column goes", async () => {
    const { workspace, setRules, read } = await open();
    setRules("onReorder");
    expect(read().header.derivedProps?._allowsDragging).toBe(true);
    const graph = workspace.runtime.graph;
    const project = graph.getEntry(graph.projectId);
    const ruleId = (
      project?.kind === "project" ? project.interactionIds[0] : undefined
    )!;
    const rule = graph.getEntry(ruleId) as InteractionEntry;
    // The rule edited in place (same id): its trigger is no longer a drag and drop event.
    workspace.execute(
      catalogInteractionsCommand(
        { ownerId: TABLE },
        [{ ...rule, trigger: "onAction" }],
        "Rules",
      ),
    );
    const after = read();
    expect(after.header.derivedProps?._allowsDragging).toBeUndefined();
    expect(after.box(after.columns[0]!.id).x).toBe(0);
    expect(after.host.querySelector("[data-drag-cell]")).toBeNull();
  });
});

// @vitest-environment jsdom
/**
 * ADR-257 Phase 1 — a Table's columns are its header row's and every Row's shared grid tracks:
 * a Column's S2 width moves its whole column (the header cell and every Cell), on the Canvas
 * (`styleOf` → the real engine) and in the DOM (`catalogDomStyle` · the TableView parts), right
 * after the edit (no reload — R1), after undo · redo and after a column is inserted.
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
import { renderCatalogDom } from "../domBinding";
import { catalogItemInsertChoices } from "../itemInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const id = (name: string) => `project:node:${name}` as NodeId;
const node = (
  name: string,
  type: string,
  children: string[] = [],
  props: Record<string, unknown> = {},
) =>
  ({
    kind: "node",
    id: id(name),
    definitionId: `lib:definition:type-${type}` as NodeEntry["definitionId"],
    children: children.map(id),
    props: Object.fromEntries(
      Object.entries(props).map(([key, value]) => [
        key,
        { kind: "set", value },
      ]),
    ),
    visual: {},
    sizing: {},
    descendantOverrides: [],
  }) as NodeEntry;

async function openTable(
  type: "Table" | "TableView",
  columns: Record<string, unknown>[],
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr257-tracks" as const,
        name: "ADR-257 tracks",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr257-tracks-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const cols = columns.map((_, index) => `c${index}`);
  const rows = ["r1", "r2"];
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        node("t", type, ["th", "tb"], {
          ...(type === "Table" ? { heightMode: "auto" } : {}),
        }),
        node("th", "TableHeader", cols),
        ...columns.map((props, index) =>
          node(`c${index}`, "Column", [], { children: `C${index}`, ...props }),
        ),
        node("tb", "TableBody", rows),
        ...rows.flatMap((row) => [
          node(
            row,
            "Row",
            cols.map((_, index) => `${row}d${index}`),
          ),
          ...cols.map((_, index) =>
            node(`${row}d${index}`, "Cell", [], {
              children: index === 0 ? "a long cell value here" : "x",
            }),
          ),
        ]),
      ],
      rootIds: [id("t")],
      newId: workspace.newId,
    }),
  );
  return workspace;
}

function recordOf(workspace: CatalogWorkspace, name: string) {
  return [...workspace.root.domInputs.values()].find(
    (record) => record.sourceId === id(name),
  )!;
}

/** Each column's (x, width) of the header and each row (the engine's rects). */
function columnBoxes(workspace: CatalogWorkspace, rows: string[][]) {
  return rows.map((names) => {
    const ids = names.map((name) => recordOf(workspace, name).id);
    const rects = workspace.root.getGeometry(ids);
    return ids.map((key) => {
      const rect = rects.get(key)!;
      return [
        Math.round(rect.x * 100) / 100,
        Math.round(rect.width * 100) / 100,
      ];
    });
  });
}

describe("ADR-257 Table column tracks", () => {
  it("a Column's width moves its whole column — header cell and every Cell (Canvas)", async () => {
    const workspace = await openTable("Table", [
      { width: 120 },
      { width: "1fr" },
      { width: "2fr" },
    ]);
    const header = recordOf(workspace, "th");
    const row = recordOf(workspace, "r1");
    expect(header.derivedProps?._tableTracks).toBe(
      "120px minmax(75px, 1fr) minmax(75px, 2fr)",
    );
    expect(row.derivedProps?._tableTracks).toBe(
      header.derivedProps?._tableTracks,
    );
    const [head, r1, r2] = columnBoxes(workspace, [
      ["c0", "c1", "c2"],
      ["r1d0", "r1d1", "r1d2"],
      ["r2d0", "r2d1", "r2d2"],
    ]);
    expect(head![0]![1]).toBe(120);
    expect(r1).toEqual(head);
    expect(r2).toEqual(head);
    // (1fr : 2fr of what is left.)
    expect(head![2]![1]).toBeCloseTo(2 * head![1]![1], 1);
  });

  it("an edit moves every row without a reload; undo · redo too (R1)", async () => {
    const workspace = await openTable("Table", [{}, {}]);
    const before = columnBoxes(workspace, [
      ["c0", "c1"],
      ["r1d0", "r1d1"],
    ]);
    expect(before[1]).toEqual(before[0]);
    expect(before[0]![0]![1]).toBeCloseTo(before[0]![1]![1], 1);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("c0") }],
        props: { width: { kind: "set", value: 200 } },
      }),
    );
    const edited = columnBoxes(workspace, [
      ["c0", "c1"],
      ["r1d0", "r1d1"],
      ["r2d0", "r2d1"],
    ]);
    expect(edited[0]![0]![1]).toBe(200);
    expect(edited[1]).toEqual(edited[0]);
    expect(edited[2]).toEqual(edited[0]);
    workspace.undo();
    const undone = columnBoxes(workspace, [
      ["c0", "c1"],
      ["r1d0", "r1d1"],
    ]);
    expect(undone).toEqual(before);
    workspace.redo();
    expect(
      columnBoxes(workspace, [
        ["c0", "c1"],
        ["r2d0", "r2d1"],
      ]),
    ).toEqual([edited[0], edited[2]]);
  });

  it("a column inserted (Insert Column — header + one cell per row) joins the tracks", async () => {
    const workspace = await openTable("Table", [{ width: 100 }]);
    const header = recordOf(workspace, "th");
    const insert = catalogItemInsertChoices(
      {
        graph: workspace.runtime.graph,
        readModel: workspace.readModel,
        newId: workspace.newId,
      },
      workspace.positionOfRecord(header.id)!,
    ).find((choice) => choice.type === "Column")!;
    workspace.execute(insert.build());
    const columns = [...workspace.root.domInputs.values()].filter(
      (record) =>
        record.parentId === header.id &&
        workspace.root.typeOf(record) === "Column",
    );
    expect(columns).toHaveLength(2);
    const added = columns.find((record) => record.sourceId !== id("c0"))!;
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: added.sourceId as NodeId }],
        props: { width: { kind: "set", value: 150 } },
      }),
    );
    expect(recordOf(workspace, "r2").derivedProps?._tableTracks).toBe(
      "100px 150px",
    );
    const cellsOf = (row: string) =>
      recordOf(workspace, row).children.map((child) => {
        const rect = workspace.root.getGeometry([child]).get(child)!;
        return [rect.x, rect.width];
      });
    const headRects = workspace.root.getGeometry(columns.map((c) => c.id));
    const head = columns.map((c) => {
      const rect = headRects.get(c.id)!;
      return [rect.x, rect.width];
    });
    expect(head).toEqual([
      [0, 100],
      [100, 150],
    ]);
    expect(cellsOf("r1")).toEqual(head);
    expect(cellsOf("r2")).toEqual(head);
  });

  it("the DOM: Rows are grids on the tracks, the header row reads them from its TableHeader", async () => {
    const workspace = await openTable("Table", [{ width: 120 }, {}]);
    const html = renderToStaticMarkup(
      renderCatalogDom(workspace.root, recordOf(workspace, "t").id),
    );
    expect(html).toContain("--table-column-tracks:120px minmax(75px, 1fr)");
    expect(html).toMatch(
      /<tr[^>]*style="[^"]*display:grid[^"]*grid-template-columns:120px minmax\(75px, 1fr\)/,
    );
  });

  it("TableView: the header row · Rows are grids on the same tracks (DOM parts and Canvas)", async () => {
    const workspace = await openTable("TableView", [{ width: 90 }, {}]);
    const html = renderToStaticMarkup(
      renderCatalogDom(workspace.root, recordOf(workspace, "t").id),
    );
    const grids = html.match(
      /data-tableview-part="(TableHeader|Row)"[^>]*style="[^"]*display:grid;[^"]*grid-template-columns:90px minmax\(75px, 1fr\)/g,
    );
    expect(grids?.length).toBe(3);
    const [head, r1] = columnBoxes(workspace, [
      ["c0", "c1"],
      ["r1d0", "r1d1"],
    ]);
    expect(head![0]![1]).toBe(90);
    expect(r1).toEqual(head);
  });

  it("the selection column (a Column with Checkbox[slot=selection]) is S2's 40px track", async () => {
    const workspace = await openTable("Table", [{}, {}]);
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: id("c0") },
        index: 0,
        entries: [node("sel", "Checkbox", [], { slot: "selection" })],
        rootIds: [id("sel")],
        newId: workspace.newId,
      }),
    );
    expect(recordOf(workspace, "r1").derivedProps?._tableTracks).toBe(
      "40px minmax(75px, 1fr)",
    );
  });
});

describe("ADR-257 load-time conversion and Styles routing (사용자 결정 2)", () => {
  it("a Column's Styles width → its width prop; a Cell's is dropped; a numeric string → number", async () => {
    const { createCatalogGraph } = await import(
      "../../../../../../packages/shared/src/catalog/document/graph"
    );
    const library = await buildCodeCatalogLibrary();
    const document = newCatalogProjectDocument({
      projectId: "project:project:adr257-load" as const,
      name: "ADR-257 load",
    });
    const entries = document.entries as Record<string, unknown>;
    const body = entries["project:node:home-body"] as { children: string[] };
    const table = [
      node("t", "Table", ["th", "tb"]),
      node("th", "TableHeader", ["c0", "c1"]),
      {
        ...node("c0", "Column", [], { children: "A" }),
        sizing: { width: { kind: "set", value: 120 } },
      },
      {
        ...node("c1", "Column", [], { children: "B", minWidth: "90" }),
        visual: { width: { kind: "set", value: "30%" } },
      },
      node("tb", "TableBody", ["r1"]),
      node("r1", "Row", ["d0", "d1"]),
      {
        ...node("d0", "Cell", [], { children: "x" }),
        sizing: { width: { kind: "set", value: 300 } },
      },
      node("d1", "Cell", [], { children: "y" }),
    ];
    for (const entry of table) entries[entry.id] = entry;
    body.children = [...body.children, id("t")];
    const graph = createCatalogGraph(structuredClone(document), library);
    const c0 = graph.getEntry(id("c0")) as NodeEntry;
    const c1 = graph.getEntry(id("c1")) as NodeEntry;
    const d0 = graph.getEntry(id("d0")) as NodeEntry;
    expect(c0.props.width).toEqual({ kind: "set", value: 120 });
    expect(c0.sizing.width).toBeUndefined();
    expect(c1.props.width).toEqual({ kind: "set", value: "30%" });
    expect(c1.props.minWidth).toEqual({ kind: "set", value: 90 });
    expect((c1.visual as Record<string, unknown>).width).toBeUndefined();
    expect(d0.sizing.width).toBeUndefined();
  });

  it("the Styles width of a Column parses as an S2 column width", async () => {
    const { catalogColumnStyleValue } = await import(
      "../../panels/styles/catalog/catalogStylesHost"
    );
    expect(catalogColumnStyleValue("120px", false)).toBe(120);
    expect(catalogColumnStyleValue("120", false)).toBe(120);
    expect(catalogColumnStyleValue("2fr", false)).toBe("2fr");
    expect(catalogColumnStyleValue("25%", true)).toBe("25%");
    expect(catalogColumnStyleValue("auto", false)).toBeUndefined();
    expect(catalogColumnStyleValue("2fr", true)).toBeNull();
    expect(catalogColumnStyleValue("fit-content", false)).toBeNull();
  });
});

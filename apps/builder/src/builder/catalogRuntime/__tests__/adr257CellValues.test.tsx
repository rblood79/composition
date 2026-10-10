// @vitest-environment jsdom
/**
 * ADR-257 Phase 3 — S2 cell values and Table-wide values, read by both consumers from one
 * resolved record: Cell · Column `align` (S2 — a Column's is its header cell's only, 사용자 결정 7),
 * Cell `showDivider`, the Table's `overflowMode` (carried to its Columns · Cells) and
 * `selectionStyle` (highlight: RAC `selectionBehavior="replace"`, no selection checkbox column).
 */
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
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
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
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

const LONG = "a long cell value that does not fit in its column at all";

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

async function openTable(
  type: "Table" | "TableView",
  tableProps: Record<string, unknown> = {},
  options: { selection?: boolean } = {},
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr257-cells" as const,
        name: "ADR-257 cells",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr257-cells-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const cols = options.selection ? ["cs", "c0", "c1"] : ["c0", "c1"];
  const rows = ["r1", "r2"];
  const cellOf = (row: string, col: string) => `${row}${col}`;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        node("t", type, ["th", "tb"], {
          ...(type === "Table" ? { heightMode: "auto" } : {}),
          ...tableProps,
        }),
        node("th", "TableHeader", cols),
        ...(options.selection
          ? [
              node("cs", "Column", ["csx"]),
              node("csx", "Checkbox", [], { slot: "selection" }),
            ]
          : []),
        node("c0", "Column", [], { children: "Name", width: 120 }),
        node("c1", "Column", [], { children: "Value" }),
        node("tb", "TableBody", rows),
        ...rows.flatMap((row) => [
          node(
            row,
            "Row",
            cols.map((col) => cellOf(row, col)),
          ),
          ...(options.selection
            ? [
                node(cellOf(row, "cs"), "Cell", [`${row}csx`]),
                node(`${row}csx`, "Checkbox", [], { slot: "selection" }),
              ]
            : []),
          node(cellOf(row, "c0"), "Cell", [], { children: LONG }),
          node(cellOf(row, "c1"), "Cell", [], { children: "x" }),
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

function rectOf(workspace: CatalogWorkspace, name: string) {
  const key = recordOf(workspace, name).id;
  return workspace.root.getGeometry([key]).get(key)!;
}

function set(
  workspace: CatalogWorkspace,
  name: string,
  props: Record<string, unknown>,
) {
  workspace.execute(
    setFields({
      targets: [{ kind: "node", id: id(name) }],
      props: Object.fromEntries(
        Object.entries(props).map(([key, value]) => [
          key,
          { kind: "set" as const, value: value as string | number | boolean },
        ]),
      ),
    }),
  );
}

function dom(workspace: CatalogWorkspace) {
  return renderToStaticMarkup(
    renderCatalogDom(workspace.root, recordOf(workspace, "t").id),
  );
}

/** The inline style of the element carrying `data-catalog-id` of `name`. */
function styleOf(html: string, workspace: CatalogWorkspace, name: string) {
  const key = recordOf(workspace, name).id.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  const match = new RegExp(`<[^>]*data-catalog-id="${key}"[^>]*>`).exec(html);
  return /style="([^"]*)"/.exec(match?.[0] ?? "")?.[1] ?? "";
}

describe("ADR-257 Phase 3 — cell values (S2 Cell · Column)", () => {
  it("a Cell's align is its own text alignment; a Column's does not reach its Cells (사용자 결정 7)", async () => {
    const workspace = await openTable("Table");
    // (start = the rule's left — no value of its own.)
    expect(recordOf(workspace, "r1c1").visual.textAlign).toBeUndefined();
    set(workspace, "c1", { align: "end" });
    expect(recordOf(workspace, "c1").visual.textAlign).toBe("right");
    // (S2 Cell reads only its own `align` — the Column's leaves the Cells at start.)
    expect(recordOf(workspace, "r1c1").visual.textAlign).toBeUndefined();
    set(workspace, "r1c1", { align: "center" });
    expect(recordOf(workspace, "r1c1").visual.textAlign).toBe("center");
    expect(recordOf(workspace, "r2c1").visual.textAlign).toBeUndefined();
    const html = dom(workspace);
    expect(styleOf(html, workspace, "r1c1")).toContain("text-align:center");
    expect(styleOf(html, workspace, "c1")).toContain("text-align:right");
    expect(styleOf(html, workspace, "r2c1")).not.toContain("text-align");
  });

  it("showDivider: a 1px end line in the border color, on the Canvas box and in the DOM", async () => {
    const workspace = await openTable("Table");
    expect(recordOf(workspace, "r1c0").visual.borderRightWidth).toBeUndefined();
    set(workspace, "r1c0", { showDivider: true });
    const cell = recordOf(workspace, "r1c0");
    expect(cell.visual.borderRightWidth).toBe(1);
    expect(cell.visual.borderColor).toBe("var(--border)");
    // (Only the end side — the other cells keep none.)
    expect(recordOf(workspace, "r2c0").visual.borderRightWidth).toBeUndefined();
    const style = styleOf(dom(workspace), workspace, "r1c0");
    expect(style).toMatch(/border-right-width:1px/);
    expect(style).toContain("border-color:var(--border)");
    // (The track keeps the column — the line is inside the cell's box.)
    expect(rectOf(workspace, "r1c0").width).toBe(rectOf(workspace, "c0").width);
    set(workspace, "r1c0", { showDivider: false });
    expect(recordOf(workspace, "r1c0").visual.borderRightWidth).toBeUndefined();
  });
});

describe("ADR-257 Phase 3 — Table overflowMode (S2 default truncate)", () => {
  it("truncate (default): every cell's text is one line with an ellipsis — Canvas and DOM", async () => {
    const workspace = await openTable("Table");
    const cell = recordOf(workspace, "r1c0");
    expect(cell.props.overflowMode).toBe("truncate");
    expect(cell.visual.whiteSpace).toBe("nowrap");
    expect(cell.visual.textOverflow).toBe("ellipsis");
    expect(recordOf(workspace, "c1").visual.whiteSpace).toBe("nowrap");
    const style = styleOf(dom(workspace), workspace, "r1c0");
    expect(style).toContain("white-space:nowrap");
    expect(style).toContain("text-overflow:ellipsis");
  });

  it("wrap: the text wraps at the column width and the row grows — right after the edit", async () => {
    const workspace = await openTable("Table");
    set(workspace, "t", { overflowMode: "wrap" });
    const cell = recordOf(workspace, "r1c0");
    expect(cell.props.overflowMode).toBe("wrap");
    expect(cell.visual.whiteSpace).toBe("normal");
    expect(recordOf(workspace, "c0").visual.whiteSpace).toBe("normal");
    expect(rectOf(workspace, "r1c0").width).toBe(120);
    expect(styleOf(dom(workspace), workspace, "r1c0")).toContain(
      "white-space:normal",
    );
    workspace.undo();
    expect(recordOf(workspace, "r1c0").visual.whiteSpace).toBe("nowrap");
  });

  it("TableView: the parts carry the same values (wrap · align · divider)", async () => {
    const workspace = await openTable("TableView", { overflowMode: "wrap" });
    set(workspace, "r1c1", { align: "end", showDivider: true });
    const html = dom(workspace);
    const long = styleOf(html, workspace, "r1c0");
    expect(long).toContain("white-space:normal");
    const short = styleOf(html, workspace, "r1c1");
    expect(short).toContain("text-align:right");
    expect(short).toMatch(/border-right-width:1px/);
    expect(recordOf(workspace, "r1c0").visual.whiteSpace).toBe("normal");
  });
});

describe("ADR-257 Phase 3 — Table selectionStyle (S2 default checkbox)", () => {
  it("highlight: no selection checkbox column on the Canvas, in the DOM, in the tracks", async () => {
    const workspace = await openTable(
      "Table",
      { selectionMode: "multiple" },
      { selection: true },
    );
    expect(recordOf(workspace, "r1").derivedProps?._tableTracks).toBe(
      "40px 120px minmax(75px, 1fr)",
    );
    expect(recordOf(workspace, "cs").hidden).toBeUndefined();
    let html = dom(workspace);
    expect(html).toContain('slot="selection"');
    set(workspace, "t", { selectionStyle: "highlight" });
    expect(recordOf(workspace, "r1").derivedProps?._tableTracks).toBe(
      "120px minmax(75px, 1fr)",
    );
    expect(recordOf(workspace, "cs").hidden).toBe(true);
    expect(recordOf(workspace, "r1cs").hidden).toBe(true);
    expect(recordOf(workspace, "r2cs").hidden).toBe(true);
    // (The other columns move left into the freed track.)
    expect(rectOf(workspace, "c0").x).toBe(rectOf(workspace, "r1c0").x);
    html = dom(workspace);
    expect(html).not.toContain(
      `data-catalog-id="${recordOf(workspace, "cs").id}"`,
    );
    expect(html).not.toContain(
      `data-catalog-id="${recordOf(workspace, "r1cs").id}"`,
    );
    expect(html).toContain('data-selection-style="highlight"');
    // (RAC renders exactly the shown columns — it throws on a cell count mismatch.)
    expect(html.match(/role="columnheader"/g)?.length).toBe(2);
    workspace.undo();
    expect(recordOf(workspace, "cs").hidden).toBeUndefined();
    expect(recordOf(workspace, "r1").derivedProps?._tableTracks).toBe(
      "40px 120px minmax(75px, 1fr)",
    );
  });

  it("TableView highlight: its selection parts are not drawn either", async () => {
    const workspace = await openTable(
      "TableView",
      { selectionStyle: "highlight" },
      { selection: true },
    );
    expect(recordOf(workspace, "cs").hidden).toBe(true);
    const html = dom(workspace);
    expect(html).not.toContain(
      `data-catalog-id="${recordOf(workspace, "r1cs").id}"`,
    );
    expect(recordOf(workspace, "r1").derivedProps?._tableTracks).toBe(
      "120px minmax(75px, 1fr)",
    );
  });
});

describe("ADR-257 Phase 3 — Canvas scene", () => {
  it("a Cell holding nodes (or none) carries its text values to the text inside — the scene builds, the inner text paints them", async () => {
    const workspace = await openTable("Table", { overflowMode: "wrap" });
    // (The selection Cell holds a Checkbox; an empty Cell holds nothing — both are rule nodes.)
    set(workspace, "r1c1", { children: "", align: "center" });
    set(workspace, "r2c0", { align: "end" });
    const root = workspace.root;
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    cleanups.push(() => canvas.dispose());
    expect(getSkiaNode(recordOf(workspace, "r1c1").id)).toBeDefined();
    // (The rule painter draws the cell's text as its child text node.)
    const textOf = (name: string) =>
      getSkiaNode(recordOf(workspace, name).id)?.children?.find(
        (child) => child.type === "text",
      )?.text;
    expect(textOf("r1c0")?.whiteSpace).not.toBe("nowrap");
    expect(textOf("r1c0")?.textOverflow).toBeUndefined();
    expect(textOf("r2c1")?.align).toBe("left");
    expect(textOf("r2c0")?.align).toBe("right");
    // (An edit re-derives the dirty nodes on the binding's update — the Builder's frame.)
    set(workspace, "t", { overflowMode: "truncate" });
    expect(canvas.update().status).toBe("patched");
    expect(textOf("r1c0")?.whiteSpace).toBe("nowrap");
    expect(textOf("r1c0")?.textOverflow).toBe("ellipsis");
  });
});

describe("ADR-257 Phase 3 — a palette Table (its origin's template nodes)", () => {
  it("the Table's overflowMode (and density) reach its template Columns · Cells — inserted, then edited", async () => {
    const library = await buildCodeCatalogLibrary();
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:adr257-palette" as const,
          name: "ADR-257 palette",
        }),
        library,
      ),
      new CatalogStorage(indexedDB, `adr257-palette-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1000, height: 800 },
        autosaveSchedule: () => {},
      },
    );
    workspace.root.execute(
      insertNodes({
        parent: { kind: "node", id: "project:node:home-body" as NodeId },
        entries: [
          {
            kind: "node",
            id: id("t"),
            definitionId:
              "lib:definition:origin-component-table" as NodeEntry["definitionId"],
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as NodeEntry,
        ],
        rootIds: [id("t")],
        newId: workspace.newId,
      }),
    );
    const root = workspace.root;
    const ofType = (type: string) =>
      [...root.domInputs.values()].filter((r) => root.typeOf(r) === type);
    const header = ofType("TableHeader")[0]!;
    workspace.execute(
      catalogItemInsertChoices(
        {
          graph: workspace.runtime.graph,
          readModel: workspace.readModel,
          newId: workspace.newId,
        },
        workspace.positionOfRecord(header.id)!,
      )
        .find((choice) => choice.type === "Column")!
        .build(),
    );
    expect(ofType("Column")[0]!.props.overflowMode).toBe("truncate");
    const table = ofType("Table")[0]!;
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(table.id)!.target],
        props: {
          overflowMode: { kind: "set", value: "wrap" },
          density: { kind: "set", value: "compact" },
        },
      }),
    );
    const column = ofType("Column")[0]!;
    expect(column.props.overflowMode).toBe("wrap");
    expect(column.visual.whiteSpace).toBe("normal");
    expect(column.props.density).toBe("compact");
    expect(column.visual.paddingY).toBe(4);
  });
});

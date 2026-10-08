// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, fireEvent, render } from "@testing-library/react";
import { createElement } from "react";
import { CheckboxButton, CheckboxField } from "react-aria-components/Checkbox";
import {
  Cell,
  Column,
  Row,
  Table,
  TableBody,
  TableHeader,
} from "react-aria-components/Table";
import { afterEach, describe, expect, it } from "vitest";
import {
  insertNodes,
  insertTableColumns,
  insertTableRow,
  moveNodes,
  removeTargets,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 5i-1 (G2) — a Table draws its node tree (react-aria.adobe.com Table, G0 example
 * 11): `Table > TableHeader > Column` · `TableBody > Row > Cell` as RAC's own parts. Before, the
 * Preview drew the shared data table, which read none of these nodes (an empty grid).
 */
const BODY = "project:node:home-body" as NodeId;
const OWNER = "project:node:table" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

const node = (
  id: string,
  type: string,
  props: Record<string, unknown> = {},
  children: string[] = [],
): NodeEntry =>
  ({
    kind: "node",
    id,
    definitionId: `lib:definition:type-${type}`,
    children,
    props: Object.fromEntries(
      Object.entries(props).map(([key, value]) => [key, set(value)]),
    ),
    visual: {},
    sizing: {},
    descendantOverrides: [],
  }) as NodeEntry;

const ROWS = [
  ["Games", "File folder"],
  ["Program Files", "File folder"],
  ["bootmgr", "System file"],
] as const;

/** The author's table (G0 example 11 without selection): Name · Type columns, three rows. */
async function open(
  tableProps: Record<string, unknown> = {},
  tableExtra: Partial<NodeEntry> = {},
  /** ADR-256 Phase 5i-2: a selection column first (its Column and each row's Cell, with a Checkbox). */
  withSelection = false,
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-table" as EntryId<"project">,
        name: "Table",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr256-table-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const selectionBox = (id: string) =>
    ({
      ...node(id, "Checkbox", { children: "", slot: "selection" }),
      definitionId: "lib:definition:origin-component-checkbox",
    }) as NodeEntry;
  const rows = ROWS.map((cells, r) =>
    node(`project:node:r${r}`, "Row", {}, [
      ...(withSelection ? [`project:node:r${r}s`] : []),
      ...cells.map((_, c) => `project:node:r${r}c${c}`),
    ]),
  );
  const cells = ROWS.flatMap((cells, r) => [
    ...(withSelection
      ? [
          node(`project:node:r${r}s`, "Cell", { children: "" }, [
            `project:node:r${r}s-box`,
          ]),
          selectionBox(`project:node:r${r}s-box`),
        ]
      : []),
    ...cells.map((text, c) =>
      node(`project:node:r${r}c${c}`, "Cell", { children: text }),
    ),
  ]);
  workspace.root.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          ...node(OWNER, "Table", tableProps, [
            "project:node:header",
            "project:node:body",
          ]),
          ...tableExtra,
        } as NodeEntry,
        node("project:node:header", "TableHeader", {}, [
          ...(withSelection ? ["project:node:select"] : []),
          "project:node:name",
          "project:node:type",
        ]),
        ...(withSelection
          ? [
              node("project:node:select", "Column", { children: "" }, [
                "project:node:select-box",
              ]),
              selectionBox("project:node:select-box"),
            ]
          : []),
        node("project:node:name", "Column", { children: "Name" }),
        node("project:node:type", "Column", { children: "Type" }),
        node(
          "project:node:body",
          "TableBody",
          {},
          rows.map((row) => row.id),
        ),
        ...rows,
        ...cells,
      ],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  cleanups.push(() => act(() => workspace.dispose()));
  const root = workspace.root;
  const record = (sourceId: string) =>
    [...root.domInputs.values()].find((r) => r.sourceId === sourceId)!;
  const draw = () => {
    const view = render(renderCatalogDom(root, record(OWNER).id));
    cleanups.push(() => view.unmount());
    return view.container.querySelector("[role=grid]")!;
  };
  return { workspace, root, record, draw, library };
}

/** Decision 11 structure: tag · role · aria (links as positions) · text. */
function structure(grid: Element): string {
  const all = [...grid.querySelectorAll("*")];
  const position = (id: string) => {
    const index = all.findIndex((element) => element.id === id);
    return index < 0 ? "outside" : `#${index}`;
  };
  const walk = (element: Element): string => {
    const attributes = [...element.attributes]
      .filter((attribute) => /^(role|aria-.*)$/.test(attribute.name))
      .map((attribute) =>
        /^aria-(labelledby|describedby)$/.test(attribute.name)
          ? `${attribute.name}=${attribute.value.split(" ").map(position).join(",")}`
          : `${attribute.name}=${attribute.value}`,
      )
      .sort();
    const content = [...element.childNodes].map((child) =>
      child.nodeType === 1
        ? walk(child as Element)
        : (child.textContent ?? "").trim(),
    );
    return `<${element.tagName.toLowerCase()} ${attributes.join(" ")}>${content.join("")}</>`;
  };
  return walk(grid);
}

function reference(): Element {
  const view = render(
    createElement(
      Table,
      { "aria-label": "Table" },
      createElement(
        TableHeader,
        null,
        createElement(Column, { isRowHeader: true }, "Name"),
        createElement(Column, null, "Type"),
      ),
      createElement(
        TableBody,
        null,
        ...ROWS.map((cells, r) =>
          createElement(
            Row,
            { key: r },
            ...cells.map((text, c) => createElement(Cell, { key: c }, text)),
          ),
        ),
      ),
    ),
  );
  cleanups.push(() => view.unmount());
  return view.container.querySelector("[role=grid]")!;
}

describe("ADR-256 Phase 5i-1 — Table draws its node tree", () => {
  it("TableHeader > Column · TableBody > Row > Cell: the reference structure (the first column names the rows)", async () => {
    const { draw, record } = await open();
    const grid = draw();
    expect(structure(grid)).toBe(structure(reference()));
    // (The RAC `<table>` is the Table record's element — no marker wrapper.)
    expect(grid.tagName).toBe("TABLE");
    expect(grid.getAttribute("data-catalog-id")).toBe(record(OWNER).id);
  });

  it("a column the author marks as the row header names the rows instead of the first", async () => {
    const { workspace, record, draw } = await open();
    workspace.execute(
      setFields({
        targets: [
          workspace.positionOfRecord(record("project:node:type").id)!.target,
        ],
        props: { isRowHeader: set(true) },
      }),
    );
    const grid = draw();
    expect(
      [...grid.querySelectorAll("[role=rowheader]")].map(
        (cell) => cell.textContent,
      ),
    ).toEqual(["File folder", "File folder", "System file"]);
  });

  it("the Table's body takes a row (a cell per column) and its header a column (a cell per row)", async () => {
    const { workspace, record, draw, library } = await open();
    const entry = (type: string) => {
      const id = workspace.newId("node") as NodeId;
      return node(id, type, type === "Cell" ? { children: "" } : {});
    };
    workspace.execute(
      insertTableRow({
        body: workspace.positionOfRecord(record("project:node:body").id)!
          .target,
        buildRow: (count) => {
          const cells = Array.from({ length: count }, () => entry("Cell"));
          const row = {
            ...entry("Row"),
            children: cells.map((cell) => cell.id),
          };
          return { entries: [row, ...cells], rootId: row.id };
        },
        newId: workspace.newId,
      }),
    );
    workspace.execute(
      insertTableColumns({
        header: workspace.positionOfRecord(record("project:node:header").id)!
          .target,
        buildColumn: () => {
          const column = {
            ...entry("Column"),
            definitionId: catalogPaletteDefinitionId(library, "Column"),
          } as NodeEntry;
          return { entries: [column], rootId: column.id };
        },
        buildCell: () => {
          const cell = entry("Cell");
          return { entries: [cell], rootId: cell.id };
        },
        newId: workspace.newId,
      }),
    );
    const grid = draw();
    expect(grid.querySelectorAll("[role=columnheader]")).toHaveLength(3);
    const rows = [...grid.querySelectorAll("tbody [role=row]")];
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.children.length === 3)).toBe(true);
  });

  it("a fixed-height Table keeps its height on both sides (Canvas box = DOM box)", async () => {
    const { root, record, draw } = await open({
      heightMode: "fixed",
      height: 240,
    });
    const grid = draw() as HTMLElement;
    // (Its 1px border outside the 240 — `catalogTableHeight`; a `<table>` is border-box.)
    expect(grid.style.height).toBe("242px");
    const table = record(OWNER);
    expect(root.getGeometry([table.id]).get(table.id)!.height).toBe(242);
  });

  it("a bound Table's body takes no row (its rows are the data's — the projected rows)", async () => {
    const { workspace, record } = await open({}, {
      binding: {
        collectionId: "data:collection:files",
        fieldMap: {},
      },
    } as Partial<NodeEntry>);
    let code: unknown;
    try {
      workspace.execute(
        insertTableRow({
          body: workspace.positionOfRecord(record("project:node:body").id)!
            .target,
          buildRow: () => {
            const row = node(workspace.newId("node"), "Row");
            return { entries: [row], rootId: row.id as NodeId };
          },
          newId: workspace.newId,
        }),
      );
    } catch (error) {
      code = (error as { code?: unknown }).code;
    }
    expect(code).toBe("TABLE_ROWS_FROM_DATA");
  });
});

/**
 * ADR-256 Phase 5i-2 — the selection column is the author's nodes (G0 example 11): a Column holding
 * `Checkbox[slot=selection]` (RAC's select-all) and a Cell per row holding one (the row's). G0 ④:
 * no `selectionMode` condition — the author puts them in.
 */
describe("ADR-256 Phase 5i-2 — the Table's selection column is Checkbox[selection] nodes", () => {
  /** The selection column first: a Column and one Cell per row, each with its Checkbox. */
  const openSelection = (selectionMode = "multiple") =>
    open({ selectionMode }, {}, true);
  const checkbox = () =>
    createElement(
      CheckboxField,
      { slot: "selection" },
      createElement(
        CheckboxButton,
        null,
        createElement("div", { className: "indicator" }),
      ),
    );
  function selectionReference(): Element {
    const view = render(
      createElement(
        Table,
        { "aria-label": "Table", selectionMode: "multiple" },
        createElement(
          TableHeader,
          null,
          createElement(Column, null, checkbox()),
          createElement(Column, { isRowHeader: true }, "Name"),
          createElement(Column, null, "Type"),
        ),
        createElement(
          TableBody,
          null,
          ...ROWS.map((cells, r) =>
            createElement(
              Row,
              { key: r },
              createElement(Cell, null, checkbox()),
              ...cells.map((text, c) => createElement(Cell, { key: c }, text)),
            ),
          ),
        ),
      ),
    );
    cleanups.push(() => view.unmount());
    return view.container.querySelector("[role=grid]")!;
  }

  it("the reference structure: select-all in the column, the row's checkbox in its cell — the Name column still names the rows", async () => {
    const { draw } = await openSelection();
    expect(structure(draw())).toBe(structure(selectionReference()));
  });

  it("on the Canvas: unchecked as the rows are, selectable in a multiple-selection Table; select-all needs multiple selection and rows", async () => {
    const { workspace, root, record } = await openSelection();
    const boxes = () =>
      [...root.canvasInputs.values()].filter(
        (entry) => root.typeOf(entry) === "Checkbox",
      );
    expect(boxes()).toHaveLength(4);
    for (const entry of boxes()) {
      expect(entry.derivedProps?._isSelected).toBe(false);
      expect(entry.derivedProps?.isDisabled).toBeUndefined();
    }
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(record(OWNER).id)!.target],
        props: { selectionMode: set("single") },
      }),
    );
    const selectAll = boxes().find(
      (entry) =>
        root.typeOf(root.canvasInputs.get(entry.parentId)!) === "Column",
    )!;
    expect(selectAll.derivedProps?.isDisabled).toBe(true);
    expect(
      boxes()
        .filter((entry) => entry.id !== selectAll.id)
        .every((entry) => entry.derivedProps?.isDisabled === undefined),
    ).toBe(true);
    // A Table that selects nothing: every row's checkbox too (re-derived through its Cell).
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(record(OWNER).id)!.target],
        props: { selectionMode: set("none") },
      }),
    );
    expect(
      boxes().every((entry) => entry.derivedProps?.isDisabled === true),
    ).toBe(true);
  });

  it("in the Preview a row's checkbox selects its row and select-all every row (RAC)", async () => {
    const { draw } = await openSelection();
    const grid = draw();
    const inputs = () => [...grid.querySelectorAll("input[type=checkbox]")];
    const selected = () =>
      [...grid.querySelectorAll("tbody [role=row]")].map(
        (row) => row.getAttribute("aria-selected") === "true",
      );
    expect(inputs()).toHaveLength(4);
    fireEvent.click(inputs()[1]!);
    expect(selected()).toEqual([true, false, false]);
    fireEvent.click(inputs()[0]!);
    expect(selected()).toEqual([true, true, true]);
  });
});

/**
 * ADR-256 Phase 5i-3 — a RAC Table's rows keep one cell per column (G0 ⑨: RAC throws otherwise).
 * Deleting a column takes its cell in every row along (one step, as a new column gives every row a
 * cell); a command that would leave a row with another cell count is refused.
 */
describe("ADR-256 Phase 5i-3 — Column count = Cell count", () => {
  const refusal = (run: () => void) => {
    try {
      run();
    } catch (error) {
      return (error as { code?: unknown }).code;
    }
    return undefined;
  };

  it("deleting a column deletes its cell in every row — one step, undone together", async () => {
    const { workspace, record, draw } = await open();
    const before = workspace.runtime.historyDepth.undo;
    workspace.execute(
      removeTargets({
        targets: [
          workspace.positionOfRecord(record("project:node:name").id)!.target,
        ],
      }),
    );
    expect(workspace.runtime.historyDepth.undo).toBe(before + 1);
    let grid = draw();
    expect(grid.querySelectorAll("[role=columnheader]")).toHaveLength(1);
    expect(
      [...grid.querySelectorAll("tbody [role=row]")].map(
        (row) => row.textContent,
      ),
    ).toEqual(["File folder", "File folder", "System file"]);
    await workspace.undo();
    grid = draw();
    expect(grid.querySelectorAll("[role=columnheader]")).toHaveLength(2);
    expect(
      [...grid.querySelectorAll("tbody [role=row]")].every(
        (row) => row.children.length === 2,
      ),
    ).toBe(true);
  });

  it("moving a column takes its cell in every row along (RAC pairs cells with columns by place)", async () => {
    const { workspace, record, draw } = await open();
    workspace.execute(
      moveNodes({
        ids: [record("project:node:type").sourceId as NodeId],
        parent: workspace.positionOfRecord(record("project:node:header").id)!
          .target as never,
        index: 0,
        newId: workspace.newId,
      }),
    );
    const grid = draw();
    expect(
      [...grid.querySelectorAll("[role=columnheader]")].map(
        (c) => c.textContent,
      ),
    ).toEqual(["Type", "Name"]);
    expect(
      [...grid.querySelectorAll("tbody [role=row]")].map((row) =>
        [...row.children].map((cell) => cell.textContent),
      ),
    ).toEqual([
      ["File folder", "Games"],
      ["File folder", "Program Files"],
      ["System file", "bootmgr"],
    ]);
  });

  it("a cell alone cannot be deleted, added to a row or moved to another row", async () => {
    const { workspace, record } = await open();
    const at = (id: string) =>
      workspace.positionOfRecord(record(id).id)!.target;
    expect(
      refusal(() =>
        workspace.execute(
          removeTargets({ targets: [at("project:node:r0c1")] }),
        ),
      ),
    ).toBe("TABLE_CELLS_NOT_ALIGNED");
    expect(
      refusal(() =>
        workspace.execute(
          insertNodes({
            parent: at("project:node:r0") as never,
            entries: [node("project:node:extra", "Cell", { children: "x" })],
            rootIds: ["project:node:extra" as NodeId],
            newId: workspace.newId,
          }),
        ),
      ),
    ).toBe("TABLE_CELLS_NOT_ALIGNED");
    expect(
      refusal(() =>
        workspace.execute(
          moveNodes({
            ids: ["project:node:r0c1" as NodeId],
            parent: at("project:node:r1") as never,
            index: 0,
            newId: workspace.newId,
          }),
        ),
      ),
    ).toBe("TABLE_CELLS_NOT_ALIGNED");
    // (A whole row goes freely — the others stay aligned.)
    expect(
      refusal(() =>
        workspace.execute(removeTargets({ targets: [at("project:node:r2")] })),
      ),
    ).toBeUndefined();
  });

  it("the palette's Table (an instance): its added columns and rows keep the rule too", async () => {
    const library = await buildCodeCatalogLibrary();
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId:
            "project:project:adr256-table-palette" as EntryId<"project">,
          name: "Table",
        }),
        library,
      ),
      new CatalogStorage(indexedDB, `adr256-table-p-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1200, height: 800 },
        autosaveSchedule: () => {},
      },
    );
    cleanups.push(() => act(() => workspace.dispose()));
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            ...node(OWNER, "Table"),
            definitionId: catalogPaletteDefinitionId(library, "Table"),
          } as NodeEntry,
        ],
        rootIds: [OWNER],
        newId: workspace.newId,
      }),
    );
    const root = workspace.root;
    const of = (type: string) =>
      [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type);
    const entry = (type: string) =>
      node(
        workspace.newId("node"),
        type,
        type === "Row" ? {} : { children: "" },
      );
    const header = workspace.positionOfRecord(of("TableHeader")[0]!.id)!.target;
    const body = workspace.positionOfRecord(of("TableBody")[0]!.id)!.target;
    for (let k = 0; k < 2; k++)
      workspace.execute(
        insertTableColumns({
          header,
          buildColumn: () => {
            const column = entry("Column");
            return { entries: [column], rootId: column.id as NodeId };
          },
          buildCell: () => {
            const cell = entry("Cell");
            return { entries: [cell], rootId: cell.id as NodeId };
          },
          newId: workspace.newId,
        }),
      );
    workspace.execute(
      insertTableRow({
        body,
        buildRow: (count) => {
          const cells = Array.from({ length: count }, () => entry("Cell"));
          const row = {
            ...entry("Row"),
            children: cells.map((cell) => cell.id),
          };
          return { entries: [row, ...cells], rootId: row.id as NodeId };
        },
        newId: workspace.newId,
      }),
    );
    expect(of("Cell")).toHaveLength(2);
    workspace.execute(
      removeTargets({
        targets: [workspace.positionOfRecord(of("Column")[0]!.id)!.target],
      }),
    );
    expect(of("Column")).toHaveLength(1);
    expect(of("Cell")).toHaveLength(1);
    expect(
      refusal(() =>
        workspace.execute(
          removeTargets({
            targets: [workspace.positionOfRecord(of("Cell")[0]!.id)!.target],
          }),
        ),
      ),
    ).toBe("TABLE_CELLS_NOT_ALIGNED");
  });
});

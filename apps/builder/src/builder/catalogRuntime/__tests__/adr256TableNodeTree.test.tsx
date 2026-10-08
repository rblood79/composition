// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, render } from "@testing-library/react";
import { createElement } from "react";
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
  const rows = ROWS.map((cells, r) =>
    node(
      `project:node:r${r}`,
      "Row",
      {},
      cells.map((_, c) => `project:node:r${r}c${c}`),
    ),
  );
  const cells = ROWS.flatMap((cells, r) =>
    cells.map((text, c) =>
      node(`project:node:r${r}c${c}`, "Cell", { children: text }),
    ),
  );
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
          "project:node:name",
          "project:node:type",
        ]),
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

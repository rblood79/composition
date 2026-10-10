// @vitest-environment jsdom
/**
 * ADR-257 Phase 2 (G2) — a Cell's `colSpan` takes that many of its row's grid tracks: it starts and
 * ends with the columns it crosses (padding and a `minWidth` column included) on the Canvas and in
 * the DOM; a span change keeps the row at one cell per column (RAC throws otherwise — the cells to
 * its right are taken, new empty ones left); deleting a crossed column narrows the span.
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  insertNodes,
  removeTargets,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogPropertiesPatchCommand } from "../editContract";
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

async function openTable(columns: Record<string, unknown>[]) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr257-span" as const,
        name: "ADR-257 span",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr257-span-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const cols = columns.map((_, index) => `c${index}`);
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        node("t", "Table", ["th", "tb"], { heightMode: "auto" }),
        node("th", "TableHeader", cols),
        ...columns.map((props, index) =>
          node(`c${index}`, "Column", [], { children: `C${index}`, ...props }),
        ),
        node("tb", "TableBody", ["r1", "r2"]),
        ...["r1", "r2"].flatMap((row) => [
          node(
            row,
            "Row",
            cols.map((_, index) => `${row}d${index}`),
          ),
          ...cols.map((_, index) =>
            node(`${row}d${index}`, "Cell", [], { children: `${row}${index}` }),
          ),
        ]),
      ],
      rootIds: [id("t")],
      newId: workspace.newId,
    }),
  );
  return workspace;
}
const recordOf = (workspace: CatalogWorkspace, name: string) =>
  [...workspace.root.domInputs.values()].find(
    (record) => record.sourceId === id(name),
  )!;
const box = (workspace: CatalogWorkspace, name: string) => {
  const record = recordOf(workspace, name);
  const rect = workspace.root.getGeometry([record.id]).get(record.id)!;
  return [Math.round(rect.x * 100) / 100, Math.round(rect.width * 100) / 100];
};
const span = (workspace: CatalogWorkspace, cell: string, value: unknown) => {
  const command = catalogPropertiesPatchCommand(
    workspace.runtime.graph,
    [{ kind: "node", id: id(cell) }],
    { colSpan: value },
    (key) =>
      workspace.readModel.propSource({ kind: "node", id: id(cell) }, key)
        .value,
    new Set(),
    workspace.newId,
  )!;
  workspace.execute(command);
};
const rowCells = (workspace: CatalogWorkspace, row: string) =>
  (workspace.runtime.graph.getEntry(id(row)) as NodeEntry).children;

describe("ADR-257 Phase 2 — colSpan", () => {
  it("span 2 takes the next cell; the spanned cell covers exactly the two columns (Canvas)", async () => {
    // (A minWidth column and padded cells: the span is the tracks', not a flex sum.)
    const workspace = await openTable([
      { width: 100 },
      { width: "1fr", minWidth: 200 },
      {},
    ]);
    span(workspace, "r1d0", 2);
    expect(rowCells(workspace, "r1")).toEqual([id("r1d0"), id("r1d2")]);
    const [x0] = box(workspace, "c0");
    const [x1, w1] = box(workspace, "c1");
    const [x2, w2] = box(workspace, "c2");
    expect(box(workspace, "r1d0")).toEqual([x0, x1 + w1 - x0]);
    expect(box(workspace, "r1d2")).toEqual([x2, w2]);
    // (The other row keeps a cell per column.)
    expect(box(workspace, "r2d1")).toEqual([x1, w1]);
  });

  it("the DOM: the spanned cell is `grid-column: span 2`, RAC gives aria-colspan", async () => {
    const workspace = await openTable([{}, {}, {}]);
    span(workspace, "r1d0", 2);
    const html = renderToStaticMarkup(
      renderCatalogDom(workspace.root, recordOf(workspace, "t").id),
    );
    const cell = html.match(/<td[^>]*r1d0::[^>]*>/)?.[0] ?? "";
    expect(cell).toContain("grid-column:span 2");
    expect(cell).toContain('aria-colspan="2"');
  });

  it("span 3 → 1 leaves two new empty cells; a span that does not fit is refused", async () => {
    const workspace = await openTable([{}, {}, {}]);
    span(workspace, "r1d0", 3);
    expect(rowCells(workspace, "r1")).toEqual([id("r1d0")]);
    // (Three columns: from the first column's start to the last one's end.)
    const [x0] = box(workspace, "c0");
    const [x2, w2] = box(workspace, "c2");
    expect(box(workspace, "r1d0")).toEqual([x0, x2 + w2 - x0]);
    span(workspace, "r1d0", 1);
    expect(rowCells(workspace, "r1")).toHaveLength(3);
    expect(rowCells(workspace, "r1")[0]).toBe(id("r1d0"));
    expect(() => span(workspace, "r1d2", 2)).toThrow();
  });

  it("deleting a crossed column narrows the span; the rows stay aligned", async () => {
    const workspace = await openTable([{}, {}, {}]);
    span(workspace, "r1d0", 2);
    workspace.execute(
      removeTargets({
        targets: [{ kind: "node", id: id("c1") }],
        newId: workspace.newId,
      }),
    );
    const cell = workspace.runtime.graph.getEntry(id("r1d0")) as NodeEntry;
    expect(cell.props.colSpan).toBeUndefined();
    expect(rowCells(workspace, "r1")).toEqual([id("r1d0"), id("r1d2")]);
    expect(rowCells(workspace, "r2")).toEqual([id("r2d0"), id("r2d2")]);
    expect(recordOf(workspace, "r1").derivedProps?._tableTracks).toBe(
      "minmax(75px, 1fr) minmax(75px, 1fr)",
    );
  });

  it("Insert Column after a span: every row gets its cell (spans counted)", async () => {
    const workspace = await openTable([{}, {}]);
    span(workspace, "r1d0", 2);
    const { catalogItemInsertChoices } = await import("../itemInsert");
    const header = recordOf(workspace, "th");
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
    expect(rowCells(workspace, "r1")).toHaveLength(2);
    expect(rowCells(workspace, "r2")).toHaveLength(3);
  });

  it("the Preview DOM re-renders a narrowed span without RAC's stale column index (live G2-3)", async () => {
    const { createRoot } = await import("react-dom/client");
    const { act } = await import("react");
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const workspace = await openTable([{}, {}, {}]);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const errors: unknown[] = [];
    const draw = () =>
      act(() => {
        try {
          root.render(
            renderCatalogDom(workspace.root, recordOf(workspace, "t").id),
          );
        } catch (error) {
          errors.push(error);
        }
      });
    const original = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args[0]);
    };
    try {
      await draw();
      span(workspace, "r1d0", 2);
      await draw();
      workspace.execute(
        removeTargets({
          targets: [{ kind: "node", id: id("c1") }],
          newId: workspace.newId,
        }),
      );
      await draw();
    } finally {
      console.error = original;
      await act(() => root.unmount());
      host.remove();
    }
    expect(
      errors.filter((error) => String(error).includes("Cell count")),
    ).toEqual([]);
    expect(host.innerHTML).toBe("");
  });

  it("a column reorder is refused while a row spans columns", async () => {
    const workspace = await openTable([{}, {}, {}]);
    span(workspace, "r1d0", 2);
    const { moveNodes } = await import(
      "../../../../../../packages/shared/src/catalog/commands"
    );
    expect(() =>
      workspace.execute(
        moveNodes({
          ids: [id("c2")],
          parent: { kind: "node", id: id("th") },
          index: 0,
          newId: workspace.newId,
        } as never),
      ),
    ).toThrow();
  });
});

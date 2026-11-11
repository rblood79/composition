import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  DataBindingRef,
  DefinitionId,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type {
  CatalogBoundRow,
  CatalogBoundRows,
} from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import {
  createPage,
  insertNodes,
  removeTargets,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { catalogPageLayoutCommand } from "../pageLayoutSettings";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import {
  catalogRowRemainderBox,
  catalogRowRemainders,
} from "../rowSample";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-157 sample (2026-11-11 row window): a bound ListBox/GridList/Table that grows with its rows
 * builds only the rows its page shows — the page's height (800 here) over the list's laid-out row
 * pitch, + 1 — and keeps the area of the rest at that pitch (the owner is the DOM's height); the
 * editor marks it "+N more" with the collection's count. A list seen for the first time builds one
 * row, and is built again with its measured pitch right after the step. A bounded owner (authored
 * height, a fixed Table) shows every row it has.
 */
const BODY = "project:node:home-body" as NodeId;
const LIST = "project:node:list" as NodeId;
const BINDING: DataBindingRef = {
  collectionId: "data:collection:c1" as DataBindingRef["collectionId"],
  fieldMap: {},
};
const rowsOf = (count: number, total?: number): CatalogBoundRows =>
  Object.assign(
    Array.from({ length: count }, (_, index): CatalogBoundRow => ({
      key: `r${index}`,
      values: {
        id: `r${index}`,
        label: `Row ${index}`,
        description: "",
        icon: "",
        value: `r${index}`,
        name: `Row ${index}`,
      },
    })),
    total === undefined ? {} : { total },
  );

/** After the step: the resample the root asked for (a task of its own). */
const resampled = () => new Promise((resolve) => setTimeout(resolve, 0));
/** `sampled` false = the Preview root (no sample). */
async function open(type: string, rows: CatalogBoundRows, sampled = true) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:sample" as EntryId<"project">,
        name: "Sample",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr248-4e-sample-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
      root: {
        ...(sampled ? { rowSample: true } : {}),
        rows: () => rows,
      },
    },
  );
  const node: NodeEntry = {
    kind: "node",
    id: LIST,
    definitionId: catalogPaletteDefinitionId(library, type),
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
    binding: BINDING,
  };
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [node],
      rootIds: [LIST],
      newId: workspace.newId,
    }),
  );
  await resampled();
  return workspace;
}

const typeOf = (workspace: CatalogWorkspace, definitionId: string) =>
  workspace.runtime.graph.getDefinition(definitionId as DefinitionId)?.name ??
  "";
function rowRecords(workspace: CatalogWorkspace, type: string) {
  return [...workspace.root.canvasInputs.values()].filter(
    (record) =>
      record.rowIndex !== undefined &&
      typeOf(workspace, record.definitionId) === type,
  );
}

/** A record's top below its page root's top (the boxes are parent-relative). */
function pageTop(workspace: CatalogWorkspace, id: string) {
  const inputs = workspace.root.canvasInputs;
  let top = 0;
  for (
    let cursor = inputs.get(id);
    cursor && inputs.has(cursor.parentId);
    cursor = inputs.get(cursor.parentId)
  )
    top += workspace.root.getGeometry([cursor.id]).get(cursor.id)!.y;
  return top;
}
/** The rows a page `height` tall shows of a list whose first two built rows are `rows`. */
function pageRows(
  workspace: CatalogWorkspace,
  rows: readonly { id: string }[],
  height = 800,
) {
  const geometry = workspace.root.getGeometry(rows.slice(0, 2).map((r) => r.id));
  const pitch =
    geometry.get(rows[1]!.id)!.y - geometry.get(rows[0]!.id)!.y;
  const start = pageTop(workspace, rows[0]!.id);
  return {
    pitch,
    start,
    count: Math.ceil(Math.max(0, height - start) / pitch) + 1,
  };
}

describe("ADR-248 4e row sample", () => {
  it("a list seen for the first time builds the smallest rows' count, then the rows its page shows at its laid-out pitch", async () => {
    const workspace = await open("ListBox", rowsOf(60, 200));
    // A second list, seen for the first time: the rows of the smallest row height (800 ÷ 20 + 1)
    // until the resample after the step.
    const second = "project:node:list-2" as NodeId;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            ...(workspace.runtime.graph.getEntry(LIST) as NodeEntry),
            id: second,
            children: [],
            descendantOverrides: [],
          },
        ],
        rootIds: [second],
        newId: workspace.newId,
      }),
    );
    const secondRows = () =>
      rowRecords(workspace, "ListBoxItem").filter((row) =>
        row.parentId.includes(second),
      );
    expect(secondRows()).toHaveLength(41);
    await resampled();
    // It starts below the first list — past the page: the page shows none of it (one row kept).
    expect(pageTop(workspace, secondRows()[0]!.id)).toBeGreaterThan(800);
    expect(secondRows()).toHaveLength(1);
    const rows = rowRecords(workspace, "ListBoxItem").filter(
      (row) => !row.parentId.includes(second),
    );
    const { pitch, count } = pageRows(workspace, rows);
    expect(count).toBeLessThan(60);
    expect(rows.map((row) => row.rowIndex)).toEqual(
      Array.from({ length: count }, (_, index) => index),
    );
    const owner = workspace.root.canvasInputs.get(rows[0]!.parentId)!;
    expect(owner.rowCount).toBe(200);
    const [remainder] = catalogRowRemainders(workspace.root);
    expect(remainder).toMatchObject({
      ownerId: owner.id,
      hiddenRows: 200 - count,
    });
    expect(remainder!.rowIds).toEqual(rows.map((row) => row.id));
    // The area is the delivered rows' (the DOM lays out 60 — the window — not the 200).
    expect(remainder!.height).toBeCloseTo((60 - count) * pitch, 3);
    // A later step builds the list with the measured pitch at once (no second build).
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: second }],
        visual: { width: { kind: "set", value: 300 } },
      }),
    );
    expect(secondRows()).toHaveLength(1);
    workspace.dispose();
  });

  it("the sampled owner is as tall as the Preview's with every row built", async () => {
    const sampled = await open("ListBox", rowsOf(60));
    const preview = await open("ListBox", rowsOf(60), false);
    const ownerHeight = (workspace: CatalogWorkspace) => {
      const id = rowRecords(workspace, "ListBoxItem")[0]!.parentId;
      return workspace.root.getGeometry([id]).get(id)!.height;
    };
    expect(rowRecords(sampled, "ListBoxItem").length).toBeLessThan(60);
    expect(rowRecords(preview, "ListBoxItem")).toHaveLength(60);
    expect(ownerHeight(sampled)).toBeCloseTo(ownerHeight(preview), 1);
    sampled.dispose();
    preview.dispose();
  });

  // A page below another on the page grid: its list counts from its own page's top, not from the
  // grid's (the page frame's place is not part of the list's start).
  it("a list on a page lower on the page grid builds the same rows as on the first page", async () => {
    const workspace = await open("ListBox", rowsOf(60));
    const project = workspace.runtime.graph.getEntry(
      workspace.runtime.graph.projectId,
    ) as { pageLayout?: Parameters<typeof catalogPageLayoutCommand>[0] };
    workspace.execute(
      catalogPageLayoutCommand(project.pageLayout, "desktop", {
        kind: "columns",
        columns: 1,
      }),
    );
    const body = "project:node:lower-body" as NodeId;
    const lower = "project:node:lower-list" as NodeId;
    workspace.execute(
      createPage({
        page: {
          kind: "page",
          id: "project:page:lower" as EntryId<"page">,
          route: "/lower",
          name: "lower",
          children: [body],
        },
        entries: [
          {
            kind: "node",
            id: body,
            definitionId: "lib:definition:type-body",
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as NodeEntry,
        ],
      }),
    );
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: body },
        entries: [
          {
            ...(workspace.runtime.graph.getEntry(LIST) as NodeEntry),
            id: lower,
            children: [],
            descendantOverrides: [],
          },
        ],
        rootIds: [lower],
        newId: workspace.newId,
      }),
    );
    await resampled();
    const frames = [...workspace.root.pageFrameRects().values()];
    expect(Math.max(...frames.map((frame) => frame.y))).toBeGreaterThan(800);
    const rowsOn = (id: string) =>
      rowRecords(workspace, "ListBoxItem").filter(
        (row) =>
          row.parentId.includes(id) && !row.parentId.includes(`${id}-`),
      );
    const first = rowRecords(workspace, "ListBoxItem").filter(
      (row) => !row.parentId.includes(lower),
    );
    expect(rowsOn(lower)).toHaveLength(first.length);
    expect(first.length).toBe(pageRows(workspace, first).count);
    workspace.dispose();
  });

  it("a page's own height decides its sample", async () => {
    const workspace = await open("ListBox", rowsOf(60));
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: BODY }],
        sizing: { height: { kind: "set", value: 300 } },
      }),
    );
    await resampled();
    const rows = rowRecords(workspace, "ListBoxItem");
    expect(rows).toHaveLength(pageRows(workspace, rows, 300).count);
    expect(catalogRowRemainders(workspace.root)).toMatchObject([
      { hiddenRows: 60 - rows.length },
    ]);
    workspace.dispose();
  });

  // 2026-10-22 user 「listbox 에 child 가 없을 때 data collection 선택 시 row 가 생성되지 않는다 · slot 에서
  // item 추가 시 생성됨」: a bound ListBox whose own items were all removed still repeats a row
  // template — the origin's item, as a ListBox whose items are template positions does.
  it("a bound ListBox with no item of its own left repeats its origin's item per row", async () => {
    const workspace = await open("ListBox", rowsOf(3));
    const graph = workspace.runtime.graph;
    const fill = (graph.getEntry(LIST) as NodeEntry).descendantOverrides.find(
      (override) => override.kind === "fillSlot",
    ) as { childIds: readonly NodeId[] };
    expect(fill.childIds.length).toBeGreaterThan(0);
    // (Its items — its EmptyState goes only with the list, 2026-10-23.)
    const isEmptyState = (id: NodeId) =>
      (graph.getEntry(id) as NodeEntry).definitionId ===
      "lib:definition:origin-component-illustratedmessage";
    workspace.execute(
      removeTargets({
        targets: fill.childIds
          .filter((id) => !isEmptyState(id))
          .map((id) => ({ kind: "node" as const, id })),
      }),
    );
    expect(
      (
        (graph.getEntry(LIST) as NodeEntry).descendantOverrides.find(
          (override) => override.kind === "fillSlot",
        ) as { childIds: readonly NodeId[] }
      ).childIds.filter((id) => !isEmptyState(id)),
    ).toEqual([]);
    expect(
      rowRecords(workspace, "ListBoxItem").map((row) => row.rowIndex),
    ).toEqual([0, 1, 2]);
    workspace.dispose();
  });

  it("the marked area is as wide as the sample rows, its height below the lowest, cut to the owner's shown box", () => {
    const boxes: Record<
      string,
      { x: number; y: number; width: number; height: number }
    > = {
      a: { x: 10, y: 40, width: 200, height: 30 },
      b: { x: 10, y: 70, width: 200, height: 30 },
    };
    const remainder = {
      ownerId: "o",
      rowIds: ["a", "b"],
      hiddenRows: 2,
      height: 60,
    };
    expect(catalogRowRemainderBox(remainder, (id) => boxes[id])).toEqual({
      x: 10,
      y: 100,
      width: 200,
      height: 60,
    });
    expect(
      catalogRowRemainderBox(remainder, (id) => boxes[id], {
        x: 0,
        y: 0,
        width: 300,
        height: 120,
      }),
    ).toEqual({ x: 10, y: 100, width: 200, height: 20 });
    expect(
      catalogRowRemainderBox(remainder, (id) => boxes[id], {
        x: 0,
        y: 0,
        width: 300,
        height: 90,
      }),
    ).toBeUndefined();
  });

  it("a bounded owner (authored height) and the Preview (no sample) show every row", async () => {
    const workspace = await open("ListBox", rowsOf(15));
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: LIST }],
        visual: { height: { kind: "set", value: 300 } },
      }),
    );
    const rows = rowRecords(workspace, "ListBoxItem");
    expect(rows).toHaveLength(15);
    expect(
      workspace.root.canvasInputs.get(rows[0]!.parentId)!.rowCount,
    ).toBeUndefined();
    expect(catalogRowRemainders(workspace.root)).toEqual([]);
    workspace.dispose();
    const preview = await open("ListBox", rowsOf(15), false);
    expect(rowRecords(preview, "ListBoxItem")).toHaveLength(15);
    expect(catalogRowRemainders(preview.root)).toEqual([]);
    preview.dispose();
  });

  it("a GridList samples too; a 10-row list shows everything without a mark", async () => {
    const grid = await open("GridList", rowsOf(100));
    const built = rowRecords(grid, "GridListItem");
    expect(built).toHaveLength(pageRows(grid, built).count);
    expect(catalogRowRemainders(grid.root)).toMatchObject([
      { hiddenRows: 100 - built.length },
    ]);
    grid.dispose();
    const ten = await open("ListBox", rowsOf(10));
    expect(catalogRowRemainders(ten.root)).toEqual([]);
    ten.dispose();
  });

  it("a Table samples in auto height; a fixed Table shows the rows its height holds", async () => {
    const workspace = await open("Table", rowsOf(100));
    // Fixed (the binding default): no sample.
    expect(catalogRowRemainders(workspace.root)).toEqual([]);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: LIST }],
        props: { heightMode: { kind: "set", value: "auto" } },
      }),
    );
    await resampled();
    const rows = rowRecords(workspace, "Row");
    expect(rows).toHaveLength(pageRows(workspace, rows).count);
    expect(catalogRowRemainders(workspace.root)).toMatchObject([
      { hiddenRows: 100 - rows.length },
    ]);
    workspace.dispose();
  });
});

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
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { setDataEntries } from "../../../../../../packages/shared/src/catalog/commands/data";
import { setRowDisplay } from "../../../../../../packages/shared/src/catalog/commands/rowDisplay";
import { catalogBuilderBoundRows } from "../catalogDataRead";
import {
  catalogPagedListCommand,
  catalogUnpagedListCommand,
} from "../pagedList";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { catalogRowRemainders } from "../rowSample";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-310 Decision 10 「Pages」 on the Canvas (2026-11-19 사용자 보고 — Compare Mode: 「css, preview 는
 * 정상, canvas 는 전체 다 나옴」): a paged list's Canvas rows are its first page — `size` rows, as the
 * Preview draws them — through the Builder's own row reader (`catalogBuilderBoundRows`, the
 * Builder root's `rows`). Before, the Canvas drew every row its height held.
 */
const BODY = "project:node:home-body" as NodeId;
const LIST = "project:node:list" as NodeId;
const COLLECTION = "data:collection:people" as DataBindingRef["collectionId"];
const resampled = () => new Promise((resolve) => setTimeout(resolve, 0));

async function open(type: string) {
  const library = await buildCodeCatalogLibrary();
  const graph = new CatalogGraph(
    newCatalogProjectDocument({
      projectId: "project:project:pages" as EntryId<"project">,
      name: "Pages",
    }),
    library,
  );
  const workspace = new CatalogWorkspace(
    graph,
    new CatalogStorage(indexedDB, `adr310-builder-pages-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
      root: {
        // (The Builder's root — `CatalogBuilderCore`.)
        rowSample: true,
        rows: (binding, kind, ownerId) =>
          catalogBuilderBoundRows(graph, binding, kind, ownerId),
      },
    },
  );
  workspace.execute(
    setDataEntries({
      puts: [
        {
          kind: "collection",
          id: COLLECTION,
          name: "People",
          schema: [
            { id: "f-id", key: "id", type: "string" },
            { id: "f-name", key: "name", type: "string" },
          ],
          mockData: Array.from({ length: 40 }, (_, index) => ({
            id: `u${index + 1}`,
            name: `Person${index + 1}`,
          })),
          useMockData: true,
        } as never,
      ],
    }),
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
    binding: { collectionId: COLLECTION, fieldMap: {} },
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
  const typeOf = (definitionId: string) =>
    workspace.runtime.graph.getDefinition(definitionId as DefinitionId)?.name ??
    "";
  const rows = (item: string) =>
    [...workspace.root.canvasInputs.values()].filter(
      (record) =>
        record.rowIndex !== undefined && typeOf(record.definitionId) === item,
    ).length;
  const paged = async (size: number | undefined) => {
    workspace.execute(
      setRowDisplay(LIST, size ? { mode: "pages", size } : undefined),
    );
    await resampled();
  };
  return { workspace, rows, paged };
}

describe("ADR-310 — a paged list's Canvas rows are its first page", () => {
  it("a Table: 「Rows per page」 5 draws 5 rows (400 held 14); 20 draws what the height holds; 「더 보기」 gives the rows back", async () => {
    const { workspace, rows, paged } = await open("Table");
    // (400 — the origin's Styles height: ceil(400 / 32) + 1 of the 40 rows.)
    expect(rows("Row")).toBe(14);
    await paged(5);
    expect(rows("Row")).toBe(5);
    // (The page is all the Canvas counts — no 「+35 more」.)
    expect(catalogRowRemainders(workspace.root)).toEqual([]);
    // (A page taller than the Table: the Builder's sample of it — the Preview scrolls.)
    await paged(20);
    expect(rows("Row")).toBe(14);
    // A hug Table is as tall as its page.
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: LIST }],
        visual: { height: { kind: "set", value: "fit-content" } },
      }),
    );
    await paged(5);
    expect(rows("Row")).toBe(5);
    expect(catalogRowRemainders(workspace.root)).toEqual([]);
    workspace.undo();
    await resampled();
    workspace.dispose();
  });

  it("a ListBox too — the same reader", async () => {
    const { workspace, rows, paged } = await open("ListBox");
    const sampled = rows("ListBoxItem");
    expect(sampled).toBeGreaterThan(5);
    await paged(5);
    expect(rows("ListBoxItem")).toBe(5);
    expect(catalogRowRemainders(workspace.root)).toEqual([]);
    await paged(undefined);
    expect(rows("ListBoxItem")).toBe(sampled);
    workspace.dispose();
  });
});

// 사용자 결정 2026-11-19 「pages 를 선택시 자동으로 pagination 을 붙여주는 게 편하다」.
describe("「Show rows」 → Pages brings its Pagination", () => {
  it("a Pagination goes right after the list and pages it — one step, the list stays selected; a paged list gets no second one", async () => {
    const { workspace, rows } = await open("Table");
    const graph = workspace.runtime.graph;
    const record = () =>
      [...workspace.root.domInputs.values()].find(
        (item) => item.sourceId === LIST,
      )!;
    const paginations = () =>
      [...workspace.root.domInputs.values()].filter(
        (item) => workspace.root.typeOf(item) === "Pagination",
      );
    const bodyChildren = () =>
      (graph.getEntry(BODY) as NodeEntry).children as readonly string[];
    workspace.selectRecords([record().id]);
    const selected = () =>
      workspace.session.getSnapshot().selection.map((item) => item.identity);
    const before = bodyChildren();
    expect(paginations()).toHaveLength(0);

    workspace.execute(
      catalogPagedListCommand(workspace, record().id, LIST, 5, false),
    );
    await resampled();
    expect((graph.getEntry(LIST) as NodeEntry).rowDisplay).toEqual({
      mode: "pages",
      size: 5,
    });
    expect(rows("Row")).toBe(5);
    expect(paginations()).toHaveLength(1);
    const pagination = paginations()[0]!.sourceId as NodeId;
    // (Right after the list — not inside it, not at the page's end.)
    expect(bodyChildren()).toEqual([
      ...before.slice(0, before.indexOf(LIST) + 1),
      pagination,
      ...before.slice(before.indexOf(LIST) + 1),
    ]);
    expect((graph.getEntry(pagination) as NodeEntry).pagesOf).toBe(LIST);
    expect(selected()).toEqual([record().id]);

    // A list a Pagination pages already: only the size changes.
    workspace.execute(
      catalogPagedListCommand(workspace, record().id, LIST, 10, true),
    );
    await resampled();
    expect(paginations()).toHaveLength(1);
    expect(rows("Row")).toBe(10);
    workspace.undo();
    await resampled();

    // One Undo: the Pagination and the display go together.
    workspace.undo();
    await resampled();
    expect(paginations()).toHaveLength(0);
    expect(bodyChildren()).toEqual(before);
    expect((graph.getEntry(LIST) as NodeEntry).rowDisplay).toBeUndefined();
    workspace.dispose();
  });

  // 사용자 결정 2026-11-19 「page → scroll 로 변경시 pagination 은 제거」.
  it.each([
    ["「더 보기」", undefined],
    ["virtual scroll", { mode: "virtual" } as const],
  ])(
    "away from Pages to %s its Pagination goes too — one step, Undo gives it back connected",
    async (_name, display) => {
      const { workspace, rows } = await open("Table");
      const graph = workspace.runtime.graph;
      const record = () =>
        [...workspace.root.domInputs.values()].find(
          (item) => item.sourceId === LIST,
        )!;
      const paginations = () =>
        [...workspace.root.domInputs.values()].filter(
          (item) => workspace.root.typeOf(item) === "Pagination",
        );
      workspace.selectRecords([record().id]);
      workspace.execute(
        catalogPagedListCommand(workspace, record().id, LIST, 5, false),
      );
      await resampled();
      const pagination = paginations()[0]!.sourceId as NodeId;
      const paged = (graph.getEntry(BODY) as NodeEntry).children;

      workspace.execute(catalogUnpagedListCommand(LIST, display, [pagination]));
      await resampled();
      expect(paginations()).toHaveLength(0);
      expect(graph.getEntry(pagination)).toBeUndefined();
      expect((graph.getEntry(LIST) as NodeEntry).rowDisplay).toEqual(display);
      expect(rows("Row")).toBe(14);
      expect(
        workspace.session.getSnapshot().selection.map((item) => item.identity),
      ).toEqual([record().id]);

      workspace.undo();
      await resampled();
      expect((graph.getEntry(BODY) as NodeEntry).children).toEqual(paged);
      expect((graph.getEntry(pagination) as NodeEntry).pagesOf).toBe(LIST);
      expect((graph.getEntry(LIST) as NodeEntry).rowDisplay).toEqual({
        mode: "pages",
        size: 5,
      });
      workspace.dispose();
    },
  );
});

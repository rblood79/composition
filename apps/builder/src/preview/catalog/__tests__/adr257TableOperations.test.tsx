import "fake-indexeddb/auto";
import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  CatalogLibrary,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import type { CollectionDataSource } from "@composition/shared";
import { CatalogPreviewChannel } from "../../../builder/catalogRuntime/previewChannel";
import { NullLayoutEngine } from "../../../builder/catalogRuntime/nullLayoutEngine";
import { newCatalogProjectDocument } from "../../../builder/catalogRuntime/project";
import { CatalogStorage } from "../../../builder/catalogRuntime/storage";
import { CatalogWorkspace } from "../../../builder/catalogRuntime/workspace";
import { nodeLayoutEngine } from "../../../builder/catalogRuntime/__tests__/support/nodeLayoutEngine";
import {
  catalogBoundRows,
  catalogCollectionId,
} from "../../../builder/catalogRuntime/dataBinding";
import { catalogItemInsertChoices } from "../../../builder/catalogRuntime/itemInsert";
import { catalogPaletteDefinitionId } from "../../../builder/catalogRuntime/paletteInsert";
import {
  catalogPreviewRuntime,
  CatalogPreviewView,
} from "../catalogPreviewApp";
import { CatalogPreviewSession } from "../catalogPreviewSession";

/**
 * ADR-257 Phase 4 — the RAC Table's Preview operations (S2 Column `allowsSorting` ·
 * `allowsResizing`). The sort and the widths a drag leaves are the Preview's runtime state
 * (사용자 결정 4 · 5): no history step, the Builder's records (the Canvas) keep the document's
 * order. An authored Table's Rows sort by their cell text; a bound Table's rows by their field
 * value over every row — before the rows its height shows are taken.
 */
const BODY = "project:node:home-body" as NodeId;
const HOME = "project:page:home" as EntryId<"page">;
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

const unmounts: Array<() => void> = [];
afterEach(() => {
  for (const unmount of unmounts.splice(0)) unmount();
});

let library: CatalogLibrary | undefined;
async function open(
  entries: (library: CatalogLibrary) => NodeEntry[],
  collections: CollectionDataSource[] = [],
) {
  library ??= await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr257-ops" as EntryId<"project">,
        name: "ADR-257 operations",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr257-ops-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      root: {
        rows: (binding, kind) => catalogBoundRows(binding, collections, kind),
      },
    },
  );
  const list = entries(library);
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: list,
      rootIds: [list[0]!.id],
      newId: workspace.newId,
    }),
  );
  const flushes: (() => void)[] = [];
  const session: CatalogPreviewSession = new CatalogPreviewSession(library, {
    requestSnapshot: (request) =>
      channel.onPreviewMessage(structuredClone(request)),
    engine: () => new NullLayoutEngine(),
    viewport: { width: 1000, height: 800 },
    stateStorage: null,
  });
  const channel = new CatalogPreviewChannel(workspace.runtime, {
    post: (message) => session.receive(structuredClone(message)),
    schedule: (flush) => flushes.push(flush),
  });
  const flush = () => act(() => flushes.splice(0).forEach((run) => run()));
  channel.setView(HOME);
  channel.onReady();
  if (collections.length)
    session.receive(
      structuredClone({ type: "CATALOG_DATA", version: 1, collections }),
    );
  const runtime = catalogPreviewRuntime(session, { show: () => {} });
  const view = render(
    <CatalogPreviewView session={session} runtime={runtime} />,
  );
  unmounts.push(() => view.unmount());
  return { workspace, session, view, flush };
}

function authoredTable(columnProps: Record<string, unknown>) {
  const values = ["b10", "a", "b9", "C"];
  return () => [
    node("t", "Table", ["th", "tb"], { heightMode: "auto" }),
    node("th", "TableHeader", ["c0", "c1"]),
    node("c0", "Column", [], { children: "Name", width: 120, ...columnProps }),
    node("c1", "Column", [], { children: "Index" }),
    node(
      "tb",
      "TableBody",
      values.map((_, index) => `r${index}`),
    ),
    ...values.flatMap((value, index) => [
      node(`r${index}`, "Row", [`r${index}c0`, `r${index}c1`]),
      node(`r${index}c0`, "Cell", [], { children: value }),
      node(`r${index}c1`, "Cell", [], { children: String(index) }),
    ]),
  ];
}

/** Each body row's first cell text, in the DOM's order. */
const firstCells = (container: HTMLElement) =>
  [...container.querySelectorAll("tbody [role='row']")].map(
    (row) =>
      row.querySelector("[role='rowheader'], [role='gridcell']")?.textContent,
  );
const header = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll("[role='columnheader']")].find((cell) =>
    cell.textContent?.includes(text),
  ) as HTMLElement;

describe("ADR-257 Phase 4a — Preview sort (S2 Column allowsSorting)", () => {
  it("an authored Table sorts its Rows by the column's cell text; the document keeps its order", async () => {
    const { view, workspace } = await open(
      authoredTable({ allowsSorting: true }),
    );
    const history = workspace.history.getSnapshot().labels.length;
    expect(firstCells(view.container)).toEqual(["b10", "a", "b9", "C"]);
    const name = header(view.container, "Name");
    // (At rest no sort icon — the Canvas has none.)
    expect(name.querySelector(".sort-indicator")).toBeNull();
    act(() => {
      fireEvent.click(name);
    });
    // Numeric-aware, case-insensitive text order (b9 before b10).
    expect(firstCells(view.container)).toEqual(["a", "b9", "b10", "C"]);
    expect(name.getAttribute("aria-sort")).toBe("ascending");
    expect(
      name.querySelector(".sort-indicator")?.getAttribute("data-direction"),
    ).toBe("ascending");
    act(() => {
      fireEvent.click(name);
    });
    expect(firstCells(view.container)).toEqual(["C", "b10", "b9", "a"]);
    expect(name.getAttribute("aria-sort")).toBe("descending");
    // Nothing reached the document: no history step, the Builder's rows in document order.
    expect(workspace.history.getSnapshot().labels.length).toBe(history);
    const body = workspace.root.domInputs.get(
      workspace.root.recordsOfSource(id("tb"))[0]!,
    )!;
    expect(
      body.children.map(
        (rowId) => workspace.root.domInputs.get(rowId)!.sourceId,
      ),
    ).toEqual([id("r0"), id("r1"), id("r2"), id("r3")]);
  });

  it("a column without allowsSorting does not sort", async () => {
    const { view } = await open(authoredTable({}));
    act(() => {
      fireEvent.click(header(view.container, "Name"));
    });
    expect(firstCells(view.container)).toEqual(["b10", "a", "b9", "C"]);
    expect(header(view.container, "Name").getAttribute("aria-sort")).toBeNull();
  });

  it("a bound Table sorts every data row by value before its height takes the rows it shows", async () => {
    // 30 rows; a fixed-height Table (the default 400) shows its first 14. The smallest and largest
    // values are past them, so sorting only the shown rows could not bring them up.
    const values = [
      ...Array.from({ length: 14 }, (_, index) => index + 10),
      ...Array.from({ length: 9 }, (_, index) => index + 1),
      ...Array.from({ length: 7 }, (_, index) => index + 24),
    ];
    const collections: CollectionDataSource[] = [
      {
        id: "c1",
        name: "Scores",
        schema: [{ key: "score" }],
        mockData: values.map((score, index) => ({ id: `row${index}`, score })),
        useMockData: true,
      },
    ];
    const TABLE = id("bound");
    const { view, workspace, flush } = await open(
      (lib) => [
        {
          kind: "node",
          id: TABLE,
          definitionId: catalogPaletteDefinitionId(lib, "Table"),
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
          binding: { collectionId: catalogCollectionId("c1"), fieldMap: {} },
        } as NodeEntry,
      ],
      collections,
    );
    // The palette Table's header starts empty: Design "+" adds a Column; it reads `score` (its key)
    // and allows sorting.
    const root = workspace.root;
    const ofType = (type: string) =>
      [...root.domInputs.values()].filter((record) => root.typeOf(record) === type);
    workspace.execute(
      catalogItemInsertChoices(
        {
          graph: workspace.runtime.graph,
          readModel: workspace.readModel,
          newId: workspace.newId,
        },
        workspace.positionOfRecord(ofType("TableHeader")[0]!.id)!,
      )
        .find((choice) => choice.type === "Column")!
        .build(),
    );
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(ofType("Column")[0]!.id)!.target],
        props: {
          key: { kind: "set", value: "score" },
          allowsSorting: { kind: "set", value: true },
        },
      }),
    );
    flush();
    const shown = () => firstCells(view.container);
    expect(shown()[0]).toBe("10");
    expect(shown().length).toBeLessThan(values.length);
    const scoreHeader = view.container.querySelector(
      "[role='columnheader']",
    ) as HTMLElement;
    act(() => {
      fireEvent.click(scoreHeader);
    });
    expect(shown().slice(0, 3)).toEqual(["1", "2", "3"]);
    act(() => {
      fireEvent.click(scoreHeader);
    });
    expect(shown().slice(0, 3)).toEqual(["30", "29", "28"]);
    // The Builder's rows keep the data's order.
    expect(ofType("Cell")[0]!.props.children).toBe("10");
  });
});

describe("ADR-257 Phase 4b — Preview column resizing (S2 Column allowsResizing)", () => {
  it("a resizable Table is in RAC's container; its rows take RAC's widths as tracks; the width is where the drag starts", async () => {
    const { view } = await open(authoredTable({ allowsResizing: true }));
    const container = view.container.querySelector(
      ".react-aria-ResizableTableContainer[data-node-table-container]",
    ) as HTMLElement;
    expect(container).not.toBeNull();
    const table = container.querySelector(
      "table[data-node-table]",
    ) as HTMLElement;
    // (RAC's widths — jsdom measures 0, so the fr column is at its 75 floor; the 120 is kept.)
    expect(table.style.getPropertyValue("--table-resized-tracks")).toBe(
      "120px 75px",
    );
    const row = view.container.querySelector(
      "tbody [role='row']",
    ) as HTMLElement;
    expect(row.style.gridTemplateColumns).toContain(
      "var(--table-resized-tracks",
    );
    // Only the resizable column has RAC's resizer.
    expect(
      header(view.container, "Name").querySelector(".react-aria-ColumnResizer"),
    ).not.toBeNull();
    expect(
      header(view.container, "Index").querySelector(
        ".react-aria-ColumnResizer",
      ),
    ).toBeNull();
  });

  it("a Table without a resizable column is not wrapped", async () => {
    const { view } = await open(authoredTable({ allowsSorting: true }));
    expect(
      view.container.querySelector(".react-aria-ResizableTableContainer"),
    ).toBeNull();
    const row = view.container.querySelector(
      "tbody [role='row']",
    ) as HTMLElement;
    expect(row.style.gridTemplateColumns).toBe("120px minmax(75px, 1fr)");
  });
});

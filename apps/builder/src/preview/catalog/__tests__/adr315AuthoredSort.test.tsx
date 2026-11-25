import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setDataEntries } from "../../../../../../packages/shared/src/catalog/commands/data";
import { removeTargets } from "../../../../../../packages/shared/src/catalog/commands";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands/fields";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { CATALOG_TABLE_AUTHORED_SORT_PROP } from "../../../../../../packages/shared/src/catalog/resolution/tableColumns";
import {
  CATALOG_SORT_MARK_PART,
  type CatalogCompositionRoot,
} from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import { catalogTableColumnKey } from "../../../../../../packages/shared/src/catalog/runtime/tableSort";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { bindCatalogCanvas } from "../../../builder/catalogRuntime/canvasBinding";
import { getSkiaNode } from "../../../builder/workspace/canvas/skia/useSkiaNode";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-315 Phase 4 증분 6 — a bound Table's authored sort (its view's) shows in its header: the
 * Canvas draws it (the authored layer — HC9), the Preview shows it until a Table state's sort
 * stands in for it, and a header press · the menu start from it (breakdown §4.2).
 *
 * Fixture (Type · Status sortable; the view sorts Type ↑ then Status ↓):
 *   p1 Bora  B 2 · p2 Chan  A 1 · p3 Ara  B 3 · p4 Dana  A 5 · p5 Eun  A —
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

const USERS = {
  id: "users",
  name: "Users",
  schema: [
    { id: "f-id", key: "id", type: "string" },
    { id: "f-name", key: "name", type: "string" },
    { id: "f-type", key: "type", type: "string" },
    { id: "f-status", key: "status", type: "number" },
  ],
  mockData: [
    { id: "p1", name: "Bora", type: "B", status: 2 },
    { id: "p2", name: "Chan", type: "A", status: 1 },
    { id: "p3", name: "Ara", type: "B", status: 3 },
    { id: "p4", name: "Dana", type: "A", status: 5 },
    { id: "p5", name: "Eun", type: "A", status: null },
  ],
  useMockData: true,
};

const BOTH = [
  { field: ["data:field:f-type"], direction: "ascending" },
  { field: ["data:field:f-status"], direction: "descending" },
];

async function openTable(
  sort: readonly unknown[],
  props: Readonly<Record<string, unknown>> = {},
) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["Table"]);
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [USERS],
      variables: [],
      apiEndpoints: [],
    } as never);
  });
  // (The Builder's document holds the collection too — the Canvas reads its rows.)
  act(() => {
    h.workspace.execute(
      setDataEntries({
        puts: [
          {
            kind: "collection",
            id: "data:collection:users",
            name: USERS.name,
            schema: USERS.schema,
            mockData: USERS.mockData,
            useMockData: true,
          } as never,
        ],
      }),
    );
  });
  const id = h.ids[0] as NodeId;
  h.workspace.execute(
    catalogBindingCommand([{ kind: "node", id }], {
      ...catalogBindingRef({
        source: "dataTable",
        collectionId: "users",
        name: "Users",
      })!,
      ...(sort.length
        ? { view: { where: { id: "where", op: "and", items: [] }, sort } }
        : {}),
    } as never),
  );
  if (Object.keys(props).length)
    h.workspace.execute(
      setFields({
        targets: [{ kind: "node", id }],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [
            key,
            { kind: "set" as const, value: value as never },
          ]),
        ),
      }),
    );
  h.flush();
  await settle();
  const root = () => h.session.root!;
  const tableOf = (of: CatalogCompositionRoot) =>
    [...of.domInputs.values()].find((record) => record.ruleId === "Table")!;
  const table = () => tableOf(root());
  const columnOf = (of: CatalogCompositionRoot, key: string) => {
    const header = tableOf(of)
      .children.map((child) => of.domInputs.get(child))
      .find((record) => record?.ruleId === "TableHeader")!;
    return header.children
      .map((child) => of.domInputs.get(child)!)
      .find(
        (record) => record.ruleId === "Column" && record.props.key === key,
      )!;
  };
  const column = (key: string) => columnOf(root(), key);
  for (const key of ["type", "status"])
    h.workspace.execute(
      setFields({
        targets: [h.workspace.positionOfRecord(column(key).id)!.target],
        props: { allowsSorting: { kind: "set", value: true } },
      }),
    );
  h.flush();
  await settle();
  const rowKeys = () =>
    [...root().domInputs.values()]
      .filter(
        (record) =>
          record.bindingId === "row" &&
          root().domInputs.get(record.parentId)?.bindingId === "tablebody",
      )
      .sort((a, b) => a.rowIndex! - b.rowIndex!)
      .map((record) => record.props.id);
  const press = async (key: string, add = false) => {
    act(() => {
      h.session.tables.pressTableSort(
        table().id,
        catalogTableColumnKey(column(key)),
        add,
      );
    });
    await settle();
  };
  const header = () => {
    const cells = [
      ...h.view.container.querySelectorAll('[role="columnheader"]'),
    ];
    const name = (cell: Element) =>
      cell.textContent!.replace(/^\d+/, "").trim();
    return {
      ariaSort: cells
        .filter(
          (cell) =>
            cell.getAttribute("aria-sort") &&
            cell.getAttribute("aria-sort") !== "none",
        )
        .map((cell) => `${name(cell)}:${cell.getAttribute("aria-sort")}`),
      arrows: cells.flatMap((cell) => {
        const arrow = cell.querySelector(".sort-indicator");
        const mark = cell.querySelector(".sort-order");
        return arrow
          ? [
              `${name(cell)}:${arrow.getAttribute("data-sort-direction")}${mark ? `:${mark.textContent}` : ""}`,
            ]
          : [];
      }),
    };
  };
  return { h, root, table, column, columnOf, rowKeys, press, header };
}

describe("a bound Table's authored sort in its header (ADR-315 Phase 4 증분 6)", () => {
  it("shows its view's sort of several columns — rows in that order, the state empty", async () => {
    const t = await openTable(BOTH);
    expect(t.table().props[CATALOG_TABLE_AUTHORED_SORT_PROP]).toBe(
      JSON.stringify([
        { column: "type", direction: "ascending" },
        { column: "status", direction: "descending" },
      ]),
    );
    // A: 5 (p4) · 1 (p2) · none (p5) — B: 3 (p3) · 2 (p1)
    expect(t.rowKeys()).toEqual(["p4", "p2", "p5", "p3", "p1"]);
    expect(t.h.session.tables.tableState(t.table().id).sort).toBeUndefined();
    expect(t.header()).toEqual({
      ariaSort: ["Type:ascending"],
      arrows: ["Type:ascending:1", "Status:descending:2"],
    });
    // (Arrow and order are one box — the Canvas lays the same box out: fixed px, the digits at a
    //  fixed advance, not a measure.)
    const mark = t.h.view.container.querySelector(".sort-mark")!;
    expect(mark.querySelector(".sort-indicator")).not.toBeNull();
    const order = mark.querySelector(".sort-order") as HTMLElement;
    expect([order.style.width, order.style.fontSize]).toEqual(["7.2px", "12px"]);
  });

  it("a header press starts from it — the state's sort stands in, then the authored one again", async () => {
    const t = await openTable(BOTH, { allowsUnsorted: true });
    // (Type shows ascending — a press turns it.)
    await t.press("type");
    expect(t.h.session.tables.tableState(t.table().id).sort).toEqual([
      { column: "type", direction: "descending" },
    ]);
    expect(t.header()).toEqual({
      ariaSort: ["Type:descending"],
      arrows: ["Type:descending"],
    });
    // (A stable sort over the authored order — B: p3 · p1, A: p4 · p2 · p5.)
    expect(t.rowKeys()).toEqual(["p3", "p1", "p4", "p2", "p5"]);
    // (「Allow unsorted」: the next press leaves no state sort — the authored sort again.)
    await t.press("type");
    expect(t.h.session.tables.tableState(t.table().id).sort).toBeUndefined();
    expect(t.header()).toEqual({
      ariaSort: ["Type:ascending"],
      arrows: ["Type:ascending:1", "Status:descending:2"],
    });
    expect(t.rowKeys()).toEqual(["p4", "p2", "p5", "p3", "p1"]);
  });

  it("Shift adds to the authored list (a Table of several sorts)", async () => {
    const t = await openTable(
      [{ field: ["data:field:f-type"], direction: "ascending" }],
      { allowsMultiSort: true, allowsColumnReordering: true },
    );
    expect(t.header()).toEqual({
      ariaSort: ["Type:ascending"],
      arrows: ["Type:ascending"],
    });
    // (The menu reads the same sort: 「Add to sort」 on Status — the authored sort is one.)
    const items = t.h.session.tables.tableColumnMenu(
      t.table().id,
      catalogTableColumnKey(t.column("status")),
    );
    expect(items.find((item) => item.id === "sort-add")).toEqual({
      id: "sort-add",
    });
    await t.press("status", true);
    expect(t.h.session.tables.tableState(t.table().id).sort).toEqual([
      { column: "type", direction: "ascending" },
      { column: "status", direction: "ascending" },
    ]);
    expect(t.header().arrows).toEqual([
      "Type:ascending:1",
      "Status:ascending:2",
    ]);
  });

  it("the Canvas draws it: the content wrapper's mark part before the name", async () => {
    const t = await openTable(BOTH);
    const canvas = t.h.workspace.root as unknown as CatalogCompositionRoot;
    const wrapperOf = (key: string) => {
      const column = t.columnOf(canvas, key);
      return column.children
        .map((child) => canvas.domInputs.get(child)!)
        .find((record) => record.bindingId === "frame")!;
    };
    for (const [key, mark] of [
      ["type", "ascending:1"],
      ["status", "descending:2"],
    ] as const) {
      const wrapper = wrapperOf(key);
      expect(wrapper.derivedProps?._sortMark).toBe(mark);
      const part = `${wrapper.id}${CATALOG_SORT_MARK_PART}`;
      const name = wrapper.children.find(
        (child) => canvas.domInputs.get(child)?.bindingId === "text",
      )!;
      const rects = canvas.getGeometry([part, name]);
      // (Arrow 16 · 2 · one digit's 7.2 — fixed px, the DOM's too; then 8 before the name.)
      expect(rects.get(part)!.width).toBeCloseTo(16 + 2 + 7.2, 3);
      expect(rects.get(part)!.height).toBe(16);
      expect(rects.get(name)!.x).toBeGreaterThanOrEqual(
        rects.get(part)!.x + rects.get(part)!.width + 8 - 0.01,
      );
    }
    // (The Name Column is not in the sort: no mark.)
    expect(wrapperOf("name").derivedProps?._sortMark).toBeUndefined();
    // (The author turns the view's sort: the marks follow — the Table's Columns re-derive.)
    act(() => {
      t.h.workspace.execute(
        catalogBindingCommand([{ kind: "node", id: t.h.ids[0] as NodeId }], {
          ...catalogBindingRef({
            source: "dataTable",
            collectionId: "users",
            name: "Users",
          })!,
          view: {
            where: { id: "where", op: "and", items: [] },
            sort: [{ field: ["data:field:f-status"], direction: "ascending" }],
          },
        } as never),
      );
    });
    t.h.flush();
    await settle();
    expect(wrapperOf("type").derivedProps?._sortMark).toBeUndefined();
    expect(wrapperOf("status").derivedProps?._sortMark).toBe("ascending");
    // (Status stops sorting: S2 draws no arrow on a Column that does not sort.)
    act(() => {
      t.h.workspace.execute(
        setFields({
          targets: [
            t.h.workspace.positionOfRecord(t.columnOf(canvas, "status").id)!
              .target,
          ],
          props: { allowsSorting: { kind: "set", value: false } },
        }),
      );
    });
    t.h.flush();
    await settle();
    expect(wrapperOf("status").derivedProps?._sortMark).toBeUndefined();
    expect(
      canvas.getGeometry([
        `${wrapperOf("status").id}${CATALOG_SORT_MARK_PART}`,
      ]).size,
    ).toBe(0);
  });

  it("a hidden Column of the authored sort has no header to mark — the rest show without it", async () => {
    const t = await openTable(BOTH);
    act(() => {
      t.h.session.tables.setTableState(t.table().id, { hiddenColumns: ["type"] });
    });
    await settle();
    expect(t.header()).toEqual({
      ariaSort: ["Status:descending"],
      arrows: ["Status:descending"],
    });
    // (Shown again: its mark again.)
    act(() => {
      t.h.session.tables.setTableState(t.table().id, { hiddenColumns: [] });
    });
    await settle();
    expect(t.header().arrows).toEqual([
      "Type:ascending:1",
      "Status:descending:2",
    ]);
  });

  it("a state sort's hidden Column too (구현 중 찾은 것 — 증분 1 부터): the shown Column keeps its mark", async () => {
    const t = await openTable([], { allowsMultiSort: true });
    await t.press("type");
    await t.press("status", true);
    expect(t.header().arrows).toEqual([
      "Type:ascending:1",
      "Status:ascending:2",
    ]);
    act(() => {
      t.h.session.tables.setTableState(t.table().id, { hiddenColumns: ["type"] });
    });
    await settle();
    expect(t.header()).toEqual({
      ariaSort: ["Status:ascending"],
      arrows: ["Status:ascending"],
    });
  });

  it("one authored sort: the arrow alone, no order mark", async () => {
    const t = await openTable([
      { field: ["data:field:f-status"], direction: "ascending" },
    ]);
    expect(t.header()).toEqual({
      ariaSort: ["Status:ascending"],
      arrows: ["Status:ascending"],
    });
  });

  it("an authored sort whose first field no Column shows: nothing to show — a press starts afresh", async () => {
    const t = await openTable([
      { field: ["data:field:f-id"], direction: "descending" },
      { field: ["data:field:f-type"], direction: "ascending" },
    ]);
    expect(t.header()).toEqual({ ariaSort: [], arrows: [] });
    await t.press("type");
    expect(t.h.session.tables.tableState(t.table().id).sort).toEqual([
      { column: "type", direction: "ascending" },
    ]);
  });

  it("the Canvas's hidden Column (「Hidden by default」) is left out of the marks", async () => {
    const t = await openTable(BOTH);
    const canvas = t.h.workspace.root as unknown as CatalogCompositionRoot;
    act(() => {
      t.h.workspace.execute(
        setFields({
          targets: [
            t.h.workspace.positionOfRecord(t.columnOf(canvas, "type").id)!
              .target,
          ],
          props: { defaultHidden: { kind: "set", value: true } },
        }),
      );
    });
    t.h.flush();
    await settle();
    const status = t.columnOf(canvas, "status");
    const wrapper = status.children
      .map((child) => canvas.domInputs.get(child)!)
      .find((record) => record.bindingId === "frame")!;
    expect(wrapper.derivedProps?._sortMark).toBe("descending");
  });

  it("the Canvas binding paints the marks — kept through another structure edit, bound again when the sort turns", async () => {
    const t = await openTable(BOTH);
    const canvas = t.h.workspace.root as unknown as CatalogCompositionRoot;
    const markOf = (key: string) => {
      const wrapper = t
        .columnOf(canvas, key)
        .children.map((child) => canvas.domInputs.get(child)!)
        .find((record) => record.bindingId === "frame")!;
      return `${wrapper.id}${CATALOG_SORT_MARK_PART}`;
    };
    let binding = bindCatalogCanvas(canvas, canvas.pageRootRecords());
    const drawn = (key: string) => {
      const data = getSkiaNode(markOf(key));
      return data?.children?.map((child) =>
        child.type === "text" ? `text:${child.text?.content}` : child.type,
      );
    };
    expect(drawn("type")).toEqual(["icon_path", "text:1"]);
    expect(drawn("status")).toEqual(["icon_path", "text:2"]);
    // (Another Column's structure edit — Name removed, the header's child list changes: the marks
    //  stay drawn.)
    act(() => {
      t.h.workspace.execute(
        removeTargets({
          targets: [
            t.h.workspace.positionOfRecord(t.columnOf(canvas, "name").id)!
              .target,
          ],
        }),
      );
    });
    t.h.flush();
    await settle();
    const kept = binding.update();
    expect(kept.status).toBe("patched");
    expect(drawn("type")).toEqual(["icon_path", "text:1"]);
    // (The arrow paints in the header's color — its name Text's, the DOM's `currentColor`.)
    const wrapperOf = (key: string) =>
      t
        .columnOf(canvas, key)
        .children.map((child) => canvas.domInputs.get(child)!)
        .find((record) => record.bindingId === "frame")!;
    const arrowColor = (key: string) =>
      Array.from(
        getSkiaNode(markOf(key))!.children![0]!.iconPath!.strokeColor,
      ).map((v) => Math.round(v * 255));
    const nameText = wrapperOf("type").children.find(
      (child) => canvas.domInputs.get(child)?.bindingId === "text",
    )!;
    expect(arrowColor("type")).toEqual(
      Array.from(getSkiaNode(nameText)!.text!.color).map((v) =>
        Math.round(v * 255),
      ),
    );
    // (The content wrapper's own color: its mark paints again with it.)
    act(() => {
      t.h.workspace.execute(
        setFields({
          targets: [
            t.h.workspace.positionOfRecord(wrapperOf("type").id)!.target,
          ],
          visual: { color: { kind: "set", value: "#ff0000" } },
        } as never),
      );
    });
    t.h.flush();
    await settle();
    expect(binding.update().status).toBe("patched");
    expect(arrowColor("type")).toEqual([255, 0, 0, 255]);
    // (A sorted Column removed: the authored sort's first entry has no header — the rest's
    //  marks go, bound again.)
    act(() => {
      t.h.workspace.execute(
        removeTargets({
          targets: [
            t.h.workspace.positionOfRecord(t.columnOf(canvas, "type").id)!
              .target,
          ],
        }),
      );
    });
    t.h.flush();
    await settle();
    const removed = binding.update();
    expect(removed.status === "rebind-required" && removed.reason).toBe(
      "sort-mark",
    );
    binding.dispose();
    binding = bindCatalogCanvas(canvas, canvas.pageRootRecords());
    expect(drawn("status")).toBeUndefined();
    // (The author turns the view's sort: the marks change — bound again.)
    act(() => {
      t.h.workspace.execute(
        catalogBindingCommand([{ kind: "node", id: t.h.ids[0] as NodeId }], {
          ...catalogBindingRef({
            source: "dataTable",
            collectionId: "users",
            name: "Users",
          })!,
          view: {
            where: { id: "where", op: "and", items: [] },
            sort: [{ field: ["data:field:f-status"], direction: "ascending" }],
          },
        } as never),
      );
    });
    t.h.flush();
    await settle();
    const turned = binding.update();
    expect(turned.status === "rebind-required" && turned.reason).toBe(
      "sort-mark",
    );
    binding.dispose();
    binding = bindCatalogCanvas(canvas, canvas.pageRootRecords());
    expect(drawn("status")).toEqual(["icon_path"]);
    binding.dispose();
  });
});

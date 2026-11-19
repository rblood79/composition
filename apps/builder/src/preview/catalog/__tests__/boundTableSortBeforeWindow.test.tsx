import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setRowDisplay } from "../../../../../../packages/shared/src/catalog/commands/rowDisplay";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogTableColumnKey } from "../../../../../../packages/shared/src/catalog/runtime/tableSort";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * A bound Table's header sort orders the collection's rows, then its display cuts them — 「더 보기」
 * shows the first 100 of the sorted rows, a page its rows of the sorted rows.
 *
 * Before (2026-11-20): the rows were cut first (`catalogBoundRows`' limit) and the resolver sorted
 * what was left — a Table of 250 rows sorted descending showed its first 100 rows turned around
 * (`Person100` first), and a page its own 20 rows re-ordered.
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
  ],
  mockData: Array.from({ length: 250 }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Person${index + 1}`,
  })),
  useMockData: true,
};

describe("a bound Table's sort resolves that Table", () => {
  it("another bound list of the page is not resolved again", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const h = await openAdr280Preview(["Table", "Table"]);
    act(() => {
      h.session.receive({
        type: "CATALOG_DATA",
        version: 1,
        collections: [USERS],
        variables: [],
        apiEndpoints: [],
      });
    });
    for (const id of h.ids)
      h.workspace.execute(
        catalogBindingCommand(
          [{ kind: "node", id: id as NodeId }],
          catalogBindingRef({
            source: "dataTable",
            collectionId: "users",
            name: "Users",
          })!,
        ),
      );
    h.flush();
    await settle();
    const root = () => h.session.root!;
    const tables = () =>
      [...root().domInputs.values()].filter(
        (record) => record.ruleId === "Table",
      );
    const firstKey = (table: ReturnType<typeof tables>[number]) => {
      const body = table.children
        .map((child) => root().domInputs.get(child)!)
        .find((record) => record.bindingId === "tablebody")!;
      return body.children
        .map((child) => root().domInputs.get(child)!)
        .filter((record) => record.bindingId === "row")
        .sort((a, b) => a.rowIndex! - b.rowIndex!)[0]!.props.id;
    };
    expect(tables().length).toBe(2);
    // (Both lists resolved again — what a sort did before, 2026-11-20: every bound owner of every
    //  root, `refreshRows()` with no collection.)
    act(() => void root().refreshRows());
    const both = root().metrics.layoutInputVisits;
    const [sorted, other] = tables();
    const header = sorted!.children
      .map((child) => root().domInputs.get(child))
      .find((record) => record?.ruleId === "TableHeader")!;
    const name = header.children
      .map((child) => root().domInputs.get(child)!)
      .find(
        (record) => record.ruleId === "Column" && record.props.key === "name",
      )!;
    act(() => {
      h.session.sortTable(sorted!.id, {
        column: catalogTableColumnKey(name),
        direction: "descending",
      });
    });
    await settle();
    expect(firstKey(tables()[0]!)).toBe("p250");
    expect(firstKey(tables()[1]!)).toBe("p1");
    expect(other!.id).toBe(tables()[1]!.id);
    expect(root().metrics.layoutInputVisits).toBeLessThan(both * 0.75);
    h.view.unmount();
  }, 90_000);
});

describe("a bound Table's sort runs before its display window", () => {
  it("「더 보기」 and pages show the sorted collection's rows, not their own rows re-ordered", async () => {
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
      });
    });
    const id = h.ids[0] as NodeId;
    h.workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id }],
        catalogBindingRef({
          source: "dataTable",
          collectionId: "users",
          name: "Users",
        })!,
      ),
    );
    h.flush();
    await settle();
    const root = () => h.session.root!;
    /** The data rows' keys in the order drawn. */
    const rowKeys = () =>
      [...root().domInputs.values()]
        .filter(
          (record) =>
            record.bindingId === "row" &&
            root().domInputs.get(record.parentId)?.bindingId === "tablebody",
        )
        .sort((a, b) => a.rowIndex! - b.rowIndex!)
        .map((record) => record.props.id);
    const table = () =>
      [...root().domInputs.values()].find(
        (record) => record.ruleId === "Table",
      )!;
    const nameColumn = () => {
      const header = table()
        .children.map((child) => root().domInputs.get(child))
        .find((record) => record?.ruleId === "TableHeader")!;
      return header.children
        .map((child) => root().domInputs.get(child)!)
        .find(
          (record) => record.ruleId === "Column" && record.props.key === "name",
        )!;
    };
    const sort = (direction: "ascending" | "descending") =>
      act(() => {
        h.session.sortTable(table().id, {
          column: catalogTableColumnKey(nameColumn()),
          direction,
        });
      });
    expect(rowKeys().length).toBe(100);
    expect(rowKeys()[0]).toBe("p1");
    // 「더 보기」: the 100 rows shown are the sorted collection's first 100.
    sort("descending");
    await settle();
    expect(rowKeys().length).toBe(100);
    expect(rowKeys()[0]).toBe("p250");
    expect(rowKeys()[99]).toBe("p151");
    // (More rows: the window grows along the same order.)
    await act(() => h.session.showMore("users", id, true));
    await settle();
    expect(rowKeys().length).toBe(200);
    expect(rowKeys()[199]).toBe("p51");
    // Pages: a page is its rows of the sorted collection.
    h.workspace.execute(setRowDisplay(id, { mode: "pages", size: 20 }));
    h.flush();
    await settle();
    expect(rowKeys().length).toBe(20);
    expect(rowKeys()[0]).toBe("p250");
    await act(() => h.session.goToPage(id, 2));
    await settle();
    expect(rowKeys()[0]).toBe("p230");
    expect(rowKeys()[19]).toBe("p211");
    // (Another sort is another order of the list: it starts over at its first page.)
    sort("ascending");
    await settle();
    expect(h.session.pageOf(id)?.page).toBe(1);
    expect(rowKeys()[0]).toBe("p1");
    expect(rowKeys()[19]).toBe("p20");
    h.view.unmount();
  }, 90_000);
});

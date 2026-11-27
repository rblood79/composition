import { act, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  NodeId,
  ViewConditionGroup,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { setFilterBarTargets } from "../../../../../../packages/shared/src/catalog/commands/filterBar";
import {
  catalogFilterColumnCondition,
  catalogFilterTreeWithColumn,
} from "../../../../../../packages/shared/src/catalog/runtime/filterScope";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-320 Phase 3 (G3) — a filter bar's scope in the running Preview: one tree over its lists (a
 * Table and a ListBox of one collection). The authored start filters both lists and is the chips;
 * a write through the Table's Column filter is the scope's (a chip appears, the ListBox follows —
 * HC3); a tree is judged once for the scope (a field the rows lack is left out and counted);
 * 「Clear」 is the start again. Expected rows are written by hand from the fixture.
 *
 * Fixture — u1 … u6: type A A B B C C, status male female male female male female.
 */
afterEach(() => vi.restoreAllMocks());

const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

const ROWS = ["A", "A", "B", "B", "C", "C"].map((type, index) => ({
  id: `u${index + 1}`,
  name: `User ${index + 1}`,
  type,
  status: index % 2 === 0 ? "male" : "female",
}));
const USERS = {
  id: "users",
  name: "Users",
  schema: [
    { id: "f-id", key: "id", type: "string" },
    { id: "f-name", key: "name", type: "string" },
    { id: "f-type", key: "type", type: "string" },
    { id: "f-status", key: "status", type: "string" },
  ],
  mockData: ROWS,
  runtimeData: [],
  useMockData: true,
};
const tree = (
  ...items: ViewConditionGroup["items"][number][]
): ViewConditionGroup => ({ id: "filter-scope", op: "and", items });
const TYPE_AB: ViewConditionGroup["items"][number] = {
  id: "c1",
  fields: [["data:field:f-type" as never]],
  op: "oneOf",
  value: ["A", "B"],
};

async function scope() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["FilterBar", "Table", "ListBox"]);
  const [bar, table, list] = h.ids as [NodeId, NodeId, NodeId];
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [USERS],
      variables: [],
      apiEndpoints: [],
    } as never);
  });
  for (const id of [table, list])
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
  h.workspace.execute(setFilterBarTargets(bar, [table, list]));
  h.declare(bar, { defaultQuery: tree(TYPE_AB) as never });
  await settle();
  // (The bar's DOM is the chip line's chunk — drawn once it loads.)
  await waitFor(
    () =>
      expect(h.element(bar)?.querySelector('[role="group"]')).toBeTruthy(),
    { timeout: 5000 },
  );
  const names = (id: NodeId, role: string) =>
    [...(h.element(id)?.querySelectorAll(`[role="${role}"]`) ?? [])].flatMap(
      (item) => /User \d/.exec(item.textContent ?? "")?.[0] ?? [],
    );
  const chips = () =>
    [...(h.element(bar)?.querySelectorAll('[role="group"]') ?? [])].map(
      (chip) => chip.getAttribute("aria-label"),
    );
  const tableRecord = h.element(table)!.getAttribute("data-catalog-id")!;
  const scopes = h.session.tables.scopes;
  const write = async (value: unknown) => {
    act(() => {
      scopes.assign(bar, value);
    });
    await settle();
  };
  return {
    ...h,
    bar,
    table,
    list,
    tableRecord,
    scopes,
    write,
    rows: () => names(table, "row"),
    options: () => names(list, "option"),
    chips,
  };
}

describe("ADR-320 Phase 3 — a filter bar's scope", () => {
  it("the authored start filters every list of the scope and is the chips", async () => {
    const h = await scope();
    expect(h.rows()).toEqual(["User 1", "User 2", "User 3", "User 4"]);
    expect(h.options()).toEqual(["User 1", "User 2", "User 3", "User 4"]);
    expect(h.chips()).toHaveLength(1);
  });

  it("a Column filter of the Table is the scope's: a chip appears, the ListBox follows", async () => {
    const h = await scope();
    act(() => {
      h.session.tables.setTableState(h.tableRecord, {
        filters: catalogFilterTreeWithColumn(
          h.session.tables.tableState(h.tableRecord).filters,
          "status",
          "data:field:f-status" as never,
          { op: "equals", value: "male" },
        ),
      });
    });
    await settle();
    // (type A or B, and male: u1 · u3)
    expect(h.rows()).toEqual(["User 1", "User 3"]);
    expect(h.options()).toEqual(["User 1", "User 3"]);
    expect(h.chips()).toHaveLength(2);
    expect(h.scopes.tree(h.bar)?.items.map((item) => item.id)).toEqual([
      "c1",
      "table-filter:status",
    ]);
    // (The Table holds no filters of its own — the scope's tree is its state's.)
    expect(h.session.tables.tableStates.get(h.tableRecord)?.filters).toBe(
      undefined,
    );
  });

  it("the other way: a Column's condition edited in the scope is what its Column menu reads", async () => {
    const h = await scope();
    await h.write(
      tree(TYPE_AB, {
        id: "table-filter:status",
        fields: [["data:field:f-status" as never]],
        op: "equals",
        value: "female",
      }),
    );
    expect(
      catalogFilterColumnCondition(
        h.session.tables.tableState(h.tableRecord).filters,
        "status",
      ),
    ).toMatchObject({ op: "equals", value: "female" });
    // (type A or B, and female: u2 · u4)
    expect(h.rows()).toEqual(["User 2", "User 4"]);
  });

  it("a tree is judged for the scope — a field the rows lack is left out and counted", async () => {
    const h = await scope();
    await h.write(
      tree(TYPE_AB, {
        id: "gone",
        fields: [["data:field:f-removed" as never]],
        op: "equals",
        value: "x",
      }),
    );
    expect(h.scopes.tree(h.bar)?.items.map((item) => item.id)).toEqual(["c1"]);
    expect(h.scopes.refusedOf(h.bar)).toBe(1);
    // (The bar says so after its parts — a line of text, no role of ours.)
    await waitFor(() =>
      expect(
        h.element(h.bar)?.querySelector(".filter-bar-refused")?.textContent,
      ).toBe("1 condition could not be applied"),
    );
    expect(h.rows()).toEqual(["User 1", "User 2", "User 3", "User 4"]);
  });

  it("an empty tree shows every row and no chip; 「Clear」 is the start again", async () => {
    const h = await scope();
    await h.write(null);
    expect(h.rows()).toHaveLength(6);
    expect(h.options()).toHaveLength(6);
    expect(h.chips()).toEqual([]);
    act(() => {
      h.scopes.clear(h.bar);
    });
    await settle();
    expect(h.rows()).toEqual(["User 1", "User 2", "User 3", "User 4"]);
    expect(h.chips()).toHaveLength(1);
  });

  it("a condition turned off is skipped — every row", async () => {
    const h = await scope();
    await h.write(tree({ ...TYPE_AB, enabled: false }));
    expect(h.rows()).toHaveLength(6);
    expect(h.chips()).toHaveLength(1);
  });

  describe("the chip line runs (RAC parts — breakdown §5.5)", () => {
    const chipOf = (h: Awaited<ReturnType<typeof scope>>, index = 0) =>
      h.element(h.bar)!.querySelectorAll<HTMLElement>('[role="group"]')[
        index
      ]!;
    const button = (root: HTMLElement, name: string) =>
      [...root.querySelectorAll<HTMLButtonElement>("button")].find(
        (item) =>
          item.getAttribute("aria-label") === name ||
          (item.textContent ?? "").trim() === name,
      )!;
    const click = async (target: HTMLElement) => {
      act(() => {
        fireEvent.click(target);
      });
      await settle();
    };
    const menuItems = () =>
      [...document.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]')];
    const pick = async (label: string) => {
      const item = menuItems().find(
        (entry) => (entry.textContent ?? "").trim() === label,
      );
      expect(item, label).toBeTruthy();
      await click(item!);
    };
    /** The run's lazy chunk loaded (the chips' menus answer). */
    const running = async (h: Awaited<ReturnType<typeof scope>>) =>
      waitFor(
        () =>
          expect(
            h.element(h.bar)!.querySelector("button[aria-haspopup]"),
          ).toBeTruthy(),
        { timeout: 5000 },
      );

    it("a chip's comparison menu changes its comparison — a value of another shape goes, its editor opens", async () => {
      const h = await scope();
      await running(h);
      await click(button(chipOf(h), "Is one of"));
      await pick("Equals");
      // (A list value does not mean the same under 「Equals」: it goes — the condition is skipped
      //  until a value is entered, and the value editor opens for it.)
      expect(h.rows()).toHaveLength(6);
      expect(chipOf(h).getAttribute("aria-label")).toBe("type Equals");
      expect(h.scopes.tree(h.bar)?.items[0]).toEqual({
        id: "c1",
        fields: [["data:field:f-type"]],
        op: "equals",
      });
      await waitFor(() =>
        expect(document.querySelector('[role="dialog"]')).toBeTruthy(),
      );
    });

    it("the remove button deletes the condition; the condition menu turns it off · on and duplicates", async () => {
      const h = await scope();
      await running(h);
      await click(button(chipOf(h), "Condition menu"));
      await pick("Turn off");
      expect(h.rows()).toHaveLength(6);
      expect(chipOf(h).getAttribute("aria-label")).toBe(
        "type Is one of A, B off",
      );
      await click(button(chipOf(h), "Condition menu"));
      await pick("Turn on");
      expect(h.rows()).toHaveLength(4);
      await click(button(chipOf(h), "Condition menu"));
      await pick("Duplicate");
      expect(h.chips()).toHaveLength(2);
      await click(button(chipOf(h, 1), "Remove condition"));
      await click(button(chipOf(h), "Remove condition"));
      expect(h.chips()).toEqual([]);
      expect(h.rows()).toHaveLength(6);
    });

    it("「Add filter」 adds a field's condition and opens its comparison menu; 「Clear」 is the start", async () => {
      const h = await scope();
      await running(h);
      await click(button(h.element(h.bar)!, "Add filter"));
      await pick("status");
      expect(h.chips()).toHaveLength(2);
      // (A new condition without its value is skipped — the rows as before; its comparisons open.)
      expect(h.rows()).toEqual(["User 1", "User 2", "User 3", "User 4"]);
      await waitFor(() =>
        expect(menuItems().map((item) => item.textContent?.trim())).toContain(
          "Equals",
        ),
      );
      await pick("Equals");
      expect(h.scopes.tree(h.bar)?.items.at(-1)).toMatchObject({
        fields: [["data:field:f-status"]],
        op: "equals",
      });
      await click(button(h.element(h.bar)!, "Clear"));
      expect(h.chips()).toHaveLength(1);
      expect(h.scopes.tree(h.bar)?.items.map((item) => item.id)).toEqual([
        "c1",
      ]);
    });

    it("a chip's value editor is the Column filter dialog — its candidates leave that condition out", async () => {
      const h = await scope();
      await running(h);
      await click(button(chipOf(h), "A, B"));
      const dialog = await waitFor(() => {
        const found = document.querySelector<HTMLElement>('[role="dialog"]');
        expect(found).toBeTruthy();
        return found!;
      });
      // (Candidates of type with c1 left out: A · B · C — two rows each.)
      const options = [
        ...dialog.querySelectorAll<HTMLElement>('[role="option"]'),
      ].map((option) => option.textContent?.trim());
      expect(options).toEqual(["A2", "B2", "C2"]);
    });
  });
});

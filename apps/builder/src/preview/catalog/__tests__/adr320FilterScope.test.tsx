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

    /**
     * ADR-320 Phase 4 (G4) — the condition builder: RAC `Tree` rows of the scope's tree. Shapes are
     * written here (`c1` = type is one of A · B). Drags run live (pointer · keyboard — the G4 live
     * script); the moves' shapes are `adr320FilterTreeEdit.test.ts`.
     */
    describe("the condition builder (Phase 4)", () => {
      const STATUS_F: ViewConditionGroup["items"][number] = {
        id: "c2",
        fields: [["data:field:f-status" as never]],
        op: "equals",
        value: "female",
      };
      const treeRows = () =>
        [...document.querySelectorAll<HTMLElement>('[role="treegrid"] [role="row"]')].map(
          (row) => `${row.getAttribute("aria-level")} ${row.getAttribute("aria-label")}`,
        );
      const rowOf = (label: string) =>
        [...document.querySelectorAll<HTMLElement>('[role="treegrid"] [role="row"]')].find(
          (row) => row.getAttribute("aria-label") === label,
        )!;
      const shape = (h: Awaited<ReturnType<typeof scope>>) => {
        const walk = (item: ViewConditionGroup["items"][number]): string =>
          "items" in item ? `${item.op}(${item.items.map(walk).join(" ")})` : item.id;
        return (h.scopes.tree(h.bar)?.items ?? []).map(walk).join(" ");
      };
      /** Esc pressed and released (a key held is the chip line's cue to wait — `afterKeyRelease`). */
      const escape = async () => {
        const at = document.activeElement ?? document.body;
        act(() => {
          fireEvent.keyDown(at, { key: "Escape" });
          fireEvent.keyUp(at, { key: "Escape" });
        });
        await settle();
      };
      const open = async (h: Awaited<ReturnType<typeof scope>>) => {
        await click(button(h.element(h.bar)!, "Edit conditions"));
        await waitFor(
          () => expect(document.querySelector('[role="treegrid"]')).toBeTruthy(),
          { timeout: 5000 },
        );
      };

      it("「Edit conditions」 opens the tree; 「Add group」 adds an 「or」 group of the picked field", async () => {
        const h = await scope();
        await running(h);
        await open(h);
        expect(treeRows()).toEqual(["1 type Is one of A, B"]);
        await click(button(document.body, "Add group"));
        await pick("status");
        expect(shape(h)).toMatch(/^c1 or\(filter-bar:\S+\)$/);
        await waitFor(() =>
          expect(treeRows()).toEqual([
            "1 type Is one of A, B",
            "1 Conditions Or",
            "2 status Contains",
          ]),
        );
        // (The new condition's comparisons open on its builder row, not on a chip.)
        expect(menuItems().map((item) => item.textContent?.trim())).toContain("Equals");
      });

      it("the 「and · or」 switch · 「Ungroup」 · 「Group」 · 「Move up」 match the shapes", async () => {
        const h = await scope();
        await h.write(tree(TYPE_AB, { id: "g", op: "or", items: [STATUS_F] }));
        await running(h);
        await open(h);
        // or(c2) — type A/B and status female: u2 · u4.
        expect(h.rows()).toEqual(["User 2", "User 4"]);
        await click(button(rowOf("Conditions Or"), "Or"));
        expect(shape(h)).toBe("c1 and(c2)");
        await click(button(rowOf("Conditions And"), "Group actions"));
        await pick("Ungroup");
        expect(shape(h)).toBe("c1 c2");
        await click(button(rowOf("status Equals female"), "Condition actions"));
        await pick("Move up");
        expect(shape(h)).toBe("c2 c1");
        await click(button(rowOf("status Equals female"), "Condition actions"));
        await pick("Group");
        expect(shape(h)).toBe("or(c2) c1");
        expect(h.rows()).toEqual(["User 2", "User 4"]);
      });

      it("a row's comparison change opens its value editor with that comparison (not the row's last draw)", async () => {
        const h = await scope();
        await running(h);
        await open(h);
        await click(button(rowOf("type Is one of A, B"), "Is one of"));
        await pick("Equals");
        const editor = await waitFor(
          () => {
            const found = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find(
              (dialog) => !dialog.querySelector('[role="treegrid"]'),
            );
            expect(found).toBeTruthy();
            return found!;
          },
          { timeout: 5000 },
        );
        // (The editor's comparison picker reads the scope's condition now: 「Equals」.)
        await waitFor(() =>
          expect(
            [...editor.querySelectorAll("button")].map((b) => b.textContent?.trim()),
          ).toContain("Equals"),
        );
        expect(
          [...editor.querySelectorAll("button")].map((b) => b.textContent?.trim()),
        ).not.toContain("Is one of");
      });

      it("a row whose condition did not change reads the tree now — 「Move down」 once a row follows it", async () => {
        const h = await scope();
        await running(h);
        await open(h);
        await click(button(rowOf("type Is one of A, B"), "Condition actions"));
        expect(menuItems().map((item) => item.textContent?.trim())).not.toContain("Move down");
        await escape();
        // (The builder's own 「Add condition」.)
        await click(button(document.body, "Add condition"));
        await pick("status");
        await escape();
        await waitFor(() => expect(treeRows()).toHaveLength(2));
        await click(button(rowOf("type Is one of A, B"), "Condition actions"));
        expect(menuItems().map((item) => item.textContent?.trim())).toContain("Move down");
      });

      it("three levels of groups at most — the third offers no 「Add group」, its condition no 「Group」", async () => {
        const h = await scope();
        const deep = tree(
          TYPE_AB,
          {
            id: "l1",
            op: "or",
            items: [{ id: "l2", op: "and", items: [{ id: "l3", op: "or", items: [STATUS_F] }] }],
          },
        );
        await h.write(deep);
        await running(h);
        await open(h);
        expect(treeRows().map((row) => row.split(" ")[0])).toEqual(["1", "1", "2", "3", "4"]);
        // (The third group is the row at level 3.)
        const third = [...document.querySelectorAll<HTMLElement>('[role="treegrid"] [role="row"]')].find(
          (row) => row.getAttribute("aria-level") === "3",
        )!;
        await click(button(third, "Group actions"));
        expect(menuItems().map((item) => item.textContent?.trim())).not.toContain("Add group");
        expect(menuItems().map((item) => item.textContent?.trim())).toContain("Add condition");
        await escape();
        const second = [...document.querySelectorAll<HTMLElement>('[role="treegrid"] [role="row"]')].find(
          (row) => row.getAttribute("aria-level") === "2",
        )!;
        await click(button(second, "Group actions"));
        expect(menuItems().map((item) => item.textContent?.trim())).toContain("Add group");
        await escape();
        await click(button(rowOf("status Equals female"), "Condition actions"));
        expect(menuItems().map((item) => item.textContent?.trim())).not.toContain("Group");
      });

      it("a scope that takes no group offers no group feature", async () => {
        const h = await scope();
        vi.spyOn(
          h.session.tables.filterBarAccess(
            h.element(h.bar)!.getAttribute("data-catalog-id")!,
          )!,
          "takes",
        ).mockReturnValue(false);
        await running(h);
        await open(h);
        expect(button(document.body, "Add group")).toBeUndefined();
        expect(button(document.body, "Add condition")).toBeTruthy();
        await click(button(rowOf("type Is one of A, B"), "Condition actions"));
        expect(menuItems().map((item) => item.textContent?.trim())).not.toContain("Group");
      });

      it("a group chip's menu opens the builder; 「Builder」 lays it out in the bar", { timeout: 20000 }, async () => {
        const h = await scope();
        await h.write(tree({ id: "g", op: "or", items: [TYPE_AB, STATUS_F] }));
        await running(h);
        await click(button(chipOf(h), "Condition menu"));
        await pick("Edit conditions");
        await waitFor(() => expect(treeRows()).toHaveLength(3), { timeout: 5000 });
        await escape();
        h.declare(h.bar, { variant: "builder" });
        await settle();
        await waitFor(
          () => expect(h.element(h.bar)!.querySelector('[role="treegrid"]')).toBeTruthy(),
          { timeout: 5000 },
        );
        expect(button(h.element(h.bar)!, "Edit conditions")).toBeUndefined();
        expect(h.element(h.bar)!.querySelectorAll('[role="group"]')).toHaveLength(0);
      });
    });
  });
});

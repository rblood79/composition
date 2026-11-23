import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { catalogTableTotalsCommand } from "../../../builder/catalogRuntime/tableTotals";
import { catalogDerivedRestVisual } from "../../../../../../packages/shared/src/catalog/runtime/libraryVisual";
import { catalogCanvasNodeData } from "../../../builder/catalogRuntime/canvasBinding";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * S2 체크리스트 §9.3 (6-6) — S2 `TableFooter`'s rows (`TableView.tsx` Row `isInFooter`): the row's
 * background `gray-200` (`rowBackgroundColor`), its text `neutral` and bold (`rowTextColor` ·
 * `fontWeight`), and out of the selection (`isDisabled` + `disabledBehavior: "selection"` — not
 * dimmed, never selected). Our footer is the Table's 「Totals row」 (ADR-315 5c) — the Canvas record
 * and the Preview DOM read the Row rule's derived `in-footer` block.
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
    { id: "f-status", key: "status", type: "number" },
  ],
  mockData: [
    { id: "p1", name: "Bora", status: 2 },
    { id: "p2", name: "Chan", status: 1 },
  ],
  useMockData: true,
};

async function openTotals() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
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
  h.declare(id as never, { selectionMode: "multiple" } as never);
  h.workspace.execute(
    catalogTableTotalsCommand(
      h.workspace.runtime.graph,
      id,
      true,
      h.workspace.newId,
    ),
  );
  h.flush();
  await settle();
  const root = h.workspace.root;
  const typeOf = (record: { definitionId: string }) =>
    root.typeOf(record as never);
  const canvas = () => {
    const records = [...root.canvasInputs.values()];
    const footer = records.find((record) => typeOf(record) === "TableFooter")!;
    const row = root.canvasInputs.get(footer.children[0]!)!;
    const body = records.find((record) => typeOf(record) === "TableBody")!;
    const bodyRow = root.canvasInputs.get(body.children[0]!)!;
    const cells = (record: typeof row) =>
      record.children.map((child) => root.canvasInputs.get(child)!);
    return { row, bodyRow, cells };
  };
  return { h, id, canvas };
}

describe("S2 §9.3 TableFooter — the totals row", () => {
  it("is S2's footer row on the Canvas and in the DOM: gray-200, bold, the body's rows unchanged", async () => {
    const t = await openTotals();
    const { row, bodyRow, cells } = t.canvas();
    const root = t.h.workspace.root;
    // Canvas — what it paints (`paintedNodeDataAtRest`) and lays out (`styleOf`): the footer Row's
    // background, its cells' weight (S2 `isInFooter` — gray-200 · bold).
    const drawn = (record: typeof row) => ({
      ...record.visual,
      ...catalogDerivedRestVisual(root, record),
    });
    expect(row.derivedProps?.inFooter).toBe("true");
    expect(drawn(row).backgroundColor).toBe("var(--table-footer)");
    expect(cells(row).map((cell) => drawn(cell).fontWeight)).toEqual(
      cells(row).map(() => 700),
    );
    // (The Skia box's fill: S2 gray-200 — light `#e1e1e1`.)
    const fill = catalogCanvasNodeData(root, row.id).box?.fillColor;
    expect(
      fill && [...fill].map((channel) => Math.round(channel * 255)),
    ).toEqual([225, 225, 225, 255]);
    // (A body row keeps its own — transparent, the cell's regular weight.)
    expect(bodyRow.derivedProps?.inFooter).toBeUndefined();
    expect(drawn(bodyRow).backgroundColor).not.toBe("var(--table-footer)");
    expect(cells(bodyRow).some((cell) => drawn(cell).fontWeight === 700)).toBe(
      false,
    );
    // DOM: the same values, inline from the Row · Cell rule's derived block.
    const container = t.h.view.container;
    const footerRow =
      container.querySelector<HTMLElement>('tfoot [role="row"]')!;
    expect(footerRow.style.backgroundColor).toBe("var(--table-footer)");
    const footerCells = [
      ...footerRow.querySelectorAll<HTMLElement>(
        '[role="gridcell"], [role="rowheader"]',
      ),
    ];
    expect(footerCells.length).toBeGreaterThan(0);
    expect(footerCells.every((cell) => cell.style.fontWeight === "700")).toBe(
      true,
    );
    const domBodyRow =
      container.querySelector<HTMLElement>('tbody [role="row"]')!;
    expect(domBodyRow.style.backgroundColor).toBe("");
    expect(
      [...domBodyRow.querySelectorAll<HTMLElement>('[role="gridcell"]')].some(
        (cell) => cell.style.fontWeight === "700",
      ),
    ).toBe(false);
    t.h.view.unmount();
  }, 120_000);

  it("is out of the selection, not dimmed: a press · select all leave it unselected", async () => {
    const t = await openTotals();
    const container = t.h.view.container;
    const footerRow = () =>
      container.querySelector<HTMLElement>('tfoot [role="row"]')!;
    // (S2 `disabledBehavior: "selection"` — RAC's disabled-for-selection row has no `data-disabled`.)
    expect(footerRow().hasAttribute("data-disabled")).toBe(false);
    act(() => {
      fireEvent.pointerDown(footerRow(), { pointerType: "mouse", button: 0 });
      fireEvent.pointerUp(footerRow(), { pointerType: "mouse", button: 0 });
      fireEvent.click(footerRow());
    });
    await settle();
    expect(footerRow().getAttribute("aria-selected")).not.toBe("true");
    // Select all (the header's checkbox): every body row, never the footer's.
    const selectAll = container.querySelector<HTMLInputElement>(
      'thead input[type="checkbox"]',
    )!;
    act(() => {
      fireEvent.click(selectAll);
    });
    await settle();
    const bodyRows = [
      ...container.querySelectorAll<HTMLElement>('tbody [role="row"]'),
    ];
    expect(bodyRows.length).toBe(2);
    expect(
      bodyRows.every((row) => row.getAttribute("aria-selected") === "true"),
    ).toBe(true);
    expect(footerRow().getAttribute("aria-selected")).not.toBe("true");
    t.h.view.unmount();
  }, 120_000);
});

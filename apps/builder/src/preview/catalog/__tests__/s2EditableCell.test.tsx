import { act, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  NodeId,
  NodeParent,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import {
  catalogColumnEditableCommand,
  catalogColumnEditableOn,
} from "../../../builder/catalogRuntime/tableEditableCell";
import { catalogCanvasNodeData } from "../../../builder/catalogRuntime/canvasBinding";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * S2 체크리스트 §9.3 (6-6) — S2 `EditableCell` (`TableView.tsx`): a Column's 「Editable」 makes its
 * body cells S2's editable cell — the value with an `ActionButton[slot=edit]` (hidden at rest, the
 * row's hover · focus shows it), the button opening a popover with a Form (S2 `renderEditing`'s
 * field — named by the column key, starting at the value) and S2's cancel · save buttons. A save
 * updates the row (the session's `useListData.update` — 사용자 결정 「세션 update · 저장은
 * callEndpoint」) and runs the Form's When `onSubmit`; a cancel leaves it. The Canvas draws the
 * value and the button's box (not its glyph — S2 `visibility: hidden` at rest), never the Form.
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

async function openTable() {
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
  h.flush();
  await settle();
  const root = () => h.workspace.root;
  const typeOf = (record: { definitionId: string }) =>
    root().typeOf(record as never);
  /** A header Column's position (by its key). */
  const column = (key: string): NodeParent => {
    const header = [...root().canvasInputs.values()].find(
      (record) => typeOf(record) === "TableHeader",
    )!;
    const record = header.children
      .map((child) => root().canvasInputs.get(child)!)
      .find((each) => each.props.key === key)!;
    return h.workspace.positionOfRecord(record.id)!.target as NodeParent;
  };
  const editable = async (key: string, on: boolean) => {
    h.workspace.execute(
      catalogColumnEditableCommand(
        h.workspace.runtime.graph,
        column(key),
        on,
        h.workspace.newId,
        { edit: (label) => `Edit ${label}` },
      ),
    );
    h.flush();
    await settle();
  };
  const container = h.view.container;
  const bodyCellTexts = () =>
    [...container.querySelectorAll('tbody [role="row"]')].map((row) =>
      [...row.querySelectorAll('[role="rowheader"], [role="gridcell"]')].map(
        (cell) => (cell.textContent ?? "").trim(),
      ),
    );
  return { h, id, root, typeOf, column, editable, container, bodyCellTexts };
}

describe("S2 §9.3 EditableCell — a Column's 「Editable」", () => {
  it("makes the column's body cells S2's editable cell, and back", async () => {
    const t = await openTable();
    const graph = () => t.h.workspace.runtime.graph;
    expect(catalogColumnEditableOn(graph(), t.column("name"))).toBe(false);
    await t.editable("name", true);
    expect(catalogColumnEditableOn(graph(), t.column("name"))).toBe(true);
    expect(catalogColumnEditableOn(graph(), t.column("status"))).toBe(false);
    // Canvas: each row's cell draws its value and the edit button's box, not its glyph; the
    // Form is not drawn (S2's popover — closed).
    const records = [...t.root().canvasInputs.values()];
    const forms = records.filter((record) => t.typeOf(record) === "Form");
    expect(forms.length).toBeGreaterThan(0);
    for (const form of forms)
      expect(catalogCanvasNodeData(t.root(), form.id).visible).toBe(false);
    const buttons = records.filter(
      (record) =>
        t.typeOf(record) === "ActionButton" && record.props.slot === "edit",
    );
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.derivedProps?._editButtonHidden).toBe(true);
      expect(catalogCanvasNodeData(t.root(), button.id).visible).toBe(false);
      const box = t.root().getGeometry([button.id]).get(button.id)!;
      expect(box.width).toBeGreaterThan(0);
    }
    const texts = records
      .filter((record) => t.typeOf(record) === "Text")
      .map((record) => record.props.children);
    // (This harness's Canvas reads no rows: the Row template's value — the cell's text moved in.)
    expect(texts).toEqual(expect.arrayContaining(["{name}"]));
    // DOM: the value and the edit button, the Form not in the DOM until opened.
    expect(t.bodyCellTexts().map((row) => row.slice(0, 1))).toEqual([
      ["Bora"],
      ["Chan"],
    ]);
    expect(
      t.container.querySelectorAll('tbody button[aria-label="Edit Name"]'),
    ).toHaveLength(2);
    expect(t.container.querySelector("form")).toBeNull();
    await t.editable("name", false);
    expect(catalogColumnEditableOn(graph(), t.column("name"))).toBe(false);
    expect(
      [...t.root().canvasInputs.values()].filter(
        (record) => t.typeOf(record) === "Form",
      ),
    ).toHaveLength(0);
    expect(t.bodyCellTexts().map((row) => row.slice(0, 1))).toEqual([
      ["Bora"],
      ["Chan"],
    ]);
    t.h.view.unmount();
  }, 120_000);

  it("edits in a popover Form: save updates the row, cancel leaves it", async () => {
    const t = await openTable();
    await t.editable("name", true);
    const editButton = () =>
      t.container.querySelector<HTMLButtonElement>(
        'tbody button[aria-label="Edit Name"]',
      )!;
    const open = async () => {
      act(() => {
        fireEvent.click(editButton());
      });
      await waitFor(() =>
        expect(document.querySelector("form")).not.toBeNull(),
      );
      return document.querySelector("form")!;
    };
    // Save: the field is named by the column key and starts at the value.
    const form = await open();
    const input = form.querySelector<HTMLInputElement>('input[name="name"]')!;
    expect(input.value).toBe("Bora");
    act(() => {
      fireEvent.change(input, { target: { value: "Bori" } });
    });
    const save = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Save"]',
    )!;
    act(() => {
      fireEvent.click(save);
    });
    await settle();
    expect(document.querySelector("form")).toBeNull();
    expect(t.bodyCellTexts()[0]![0]).toBe("Bori");
    // Cancel: the row keeps its value.
    const again = await open();
    act(() => {
      fireEvent.change(again.querySelector('input[name="name"]')!, {
        target: { value: "Zed" },
      });
    });
    act(() => {
      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          'button[aria-label="Cancel"]',
        )!,
      );
    });
    await settle();
    expect(document.querySelector("form")).toBeNull();
    expect(t.bodyCellTexts()[0]![0]).toBe("Bori");
    t.h.view.unmount();
  }, 120_000);
});

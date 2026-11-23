import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogConsumerNode } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import {
  catalogGroupItems,
  catalogItemKey,
} from "../../../../../../packages/shared/src/catalog/runtime/groupSelection";
import { catalogItemKeyDisabled } from "../../../../../../packages/shared/src/catalog/runtime/presence";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { catalogGroupKeysFields } from "../../../builder/catalogRuntime/singleSelection";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * S2 체크리스트 부록 D.3 2단계 (2026-11-23) — S2 `disabledKeys` on ListBox · GridList · Table · Tree ·
 * CardView · Select · ComboBox · Tabs: the group stores its items' keys (ADR-308's shape) and both
 * renderers read it — the DOM's RAC disables the item (no press · selection, `data-disabled`), the
 * Canvas paints it disabled (`catalogItemKeyDisabled`). A bound one also takes a data field: the
 * binding's `fieldMap.disabled` (a boolean field) disables the rows it marks.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

type Harness = Awaited<ReturnType<typeof openAdr280Preview>>;
type Root = Harness["workspace"]["root"];

/** A group's records and its items, in a root (the Builder's Canvas or the Preview's). */
function groupOf(root: Root, type: string) {
  const get = (id: string) => root.canvasInputs.get(id);
  const typeOf = (record: CatalogConsumerNode) => root.typeOf(record);
  const group = [...root.canvasInputs.values()].find(
    (record) => typeOf(record) === type,
  )!;
  const items = catalogGroupItems(group, get, typeOf);
  return {
    group,
    items,
    key: (item: CatalogConsumerNode) => catalogItemKey(item, typeOf),
    disabled: (item: CatalogConsumerNode) =>
      catalogItemKeyDisabled(item, get, typeOf),
  };
}

/** Whether the Preview draws an item disabled (RAC's `data-disabled` · `aria-disabled`). */
function domDisabled(h: Harness, recordId: string): boolean {
  const element = h.view.container.querySelector(
    `[data-catalog-id="${CSS.escape(recordId)}"]`,
  );
  if (!element) throw new Error(`no element for ${recordId}`);
  const item =
    element.closest('[role="option"], [role="row"], [role="tab"]') ?? element;
  return (
    item.hasAttribute("data-disabled") ||
    item.getAttribute("aria-disabled") === "true"
  );
}

async function open(type: string) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview([type]);
  return { h, id: h.ids[0] as NodeId };
}

describe("S2 D.3 disabledKeys — the group's keys, both renderers", () => {
  it.each(["ListBox", "GridList", "Table", "Tree", "CardView", "Tabs"])(
    "%s: the item it names is disabled — Canvas and Preview — and the others are not",
    async (type) => {
      const { h, id } = await open(type);
      const canvas = groupOf(h.workspace.root, type);
      const first = canvas.items[0]!;
      expect(canvas.disabled(first)).toBe(false);
      h.declare(id, { disabledKeys: [canvas.key(first)] });
      const after = groupOf(h.workspace.root, type);
      expect(after.items.map(after.disabled)).toEqual(
        after.items.map((_, index) => index === 0),
      );
      // (The Preview's items it draws — a Tree's collapsed children are not in the DOM.)
      const preview = groupOf(h.session.root! as unknown as Root, type);
      const drawn = preview.items.filter((item) =>
        h.view.container.querySelector(
          `[data-catalog-id="${CSS.escape(item.id)}"]`,
        ),
      );
      expect(drawn[0]?.id).toBe(preview.items[0]!.id);
      expect(drawn.map((item) => domDisabled(h, item.id))).toEqual(
        drawn.map((_, index) => index === 0),
      );
      h.view.unmount();
    },
  );

  it.each(["Select", "ComboBox"])(
    "%s: the option it names is disabled in its open list and on the Canvas",
    async (type) => {
      const { h, id } = await open(type);
      const canvas = groupOf(h.workspace.root, type);
      expect(canvas.items.length).toBeGreaterThan(1);
      h.declare(id, { disabledKeys: [canvas.key(canvas.items[0]!)] });
      const after = groupOf(h.workspace.root, type);
      expect(after.disabled(after.items[0]!)).toBe(true);
      expect(after.disabled(after.items[1]!)).toBe(false);
      // (Open its list — RAC's Select · ComboBox give their ListBox the disabled keys.)
      const trigger = h.element(id)!.querySelector("button")!;
      act(() => {
        fireEvent.click(trigger);
      });
      const options = [
        ...document.body.querySelectorAll<HTMLElement>('[role="option"]'),
      ];
      expect(options.length).toBe(after.items.length);
      expect(options[0]!.getAttribute("aria-disabled")).toBe("true");
      expect(options[1]!.getAttribute("aria-disabled")).not.toBe("true");
      h.view.unmount();
    },
  );

  it("an item's own `isDisabled: false` does not beat the group's key (RAC's explicit false)", async () => {
    const { h, id } = await open("ListBox");
    const canvas = groupOf(h.workspace.root, "ListBox");
    const first = canvas.items[0]!;
    h.declare(first.sourceId as NodeId, { isDisabled: false });
    h.declare(id, { disabledKeys: [canvas.key(first)] });
    const preview = groupOf(h.session.root! as unknown as Root, "ListBox");
    expect(domDisabled(h, preview.items[0]!.id)).toBe(true);
    h.view.unmount();
  });
});

describe("S2 D.3 disabledKeys — the Design panel's field", () => {
  it.each(["ListBox", "Table", "Tree", "Select", "Tabs", "SideNav", "Menu"])(
    "%s: a check list of its items (key · text), the authored keys only",
    async (type) => {
      const { h } = await open(type);
      const root = h.workspace.root;
      const group = [...root.canvasInputs.values()].find(
        (record) => root.typeOf(record) === type,
      )!;
      const field = catalogGroupKeysFields(root, group.id).find(
        (item) => item.key === "disabledKeys",
      );
      expect(field?.choicesOnly).toBe(true);
      expect(field?.many).toBe(true);
      expect(field!.options.length).toBeGreaterThan(0);
      expect(field!.options.every((option) => option.label !== "")).toBe(true);
      h.view.unmount();
    },
  );
});

describe("S2 D.3 disabledKeys — by a data field (`fieldMap.disabled`)", () => {
  const ROWS = [
    { id: "u1", name: "Kim", off: false },
    { id: "u2", name: "Park", off: true },
    { id: "u3", name: "Lee" },
  ];

  it.each(["GridList", "ListBox"])(
    "%s bound: the rows the field marks are disabled, with the keys it names",
    async (type) => {
      const { h, id } = await open(type);
      act(() => {
        h.session.receive({
          type: "CATALOG_DATA",
          version: 1,
          collections: [
            {
              id: "users",
              name: "Users",
              schema: [
                { id: "f-id", key: "id", type: "string" },
                { id: "f-name", key: "name", type: "string" },
                { id: "f-off", key: "off", type: "boolean" },
              ],
              mockData: ROWS,
              runtimeData: [],
              useMockData: true,
            },
          ],
          variables: [],
          apiEndpoints: [],
        });
      });
      h.workspace.execute(
        catalogBindingCommand(
          [{ kind: "node", id }],
          catalogBindingRef({
            source: "dataTable",
            collectionId: "users",
            name: "Users",
            fieldMap: { disabled: "f-off" },
          })!,
        ),
      );
      h.flush();
      h.declare(id, { disabledKeys: ["u3"] });
      // (The Preview's records — the Builder harness carries no rows; the Canvas reads the same
      //  resolver · `catalogItemKeyDisabled`, the live run covers it.)
      const preview = groupOf(h.session.root! as unknown as Root, type);
      expect(preview.group.props.disabledKeys).toEqual(["u3", "u2"]);
      expect(
        Object.fromEntries(
          preview.items.map((item) => [
            preview.key(item),
            [preview.disabled(item), domDisabled(h, item.id)],
          ]),
        ),
      ).toEqual({ u1: [false, false], u2: [true, true], u3: [true, true] });
      // (The document keeps the authored keys only — the field's rows are the run's.)
      const entry = h.workspace.runtime.graph.getEntry(id);
      expect(entry?.kind === "node" && entry.props.disabledKeys).toEqual({
        kind: "set",
        value: ["u3"],
      });
      h.view.unmount();
    },
  );
});

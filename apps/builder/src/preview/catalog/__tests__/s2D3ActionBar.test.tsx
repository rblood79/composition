import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogActionBarSpace } from "../../../../../../packages/shared/src/catalog/runtime/actionBarContainer";
import { catalogBoxModel } from "../../../../../../packages/shared/src/catalog/runtime/boxModel";
import { catalogOwnerDecidedProps } from "../../../../../../packages/shared/src/catalog/runtime/ownerDecidedProps";
import {
  catalogGroupItems,
  catalogItemKey,
} from "../../../../../../packages/shared/src/catalog/runtime/groupSelection";
import {
  catalogSlotCommands,
  catalogSlotInsertOptions,
  catalogSlotTarget,
} from "../../../builder/catalogRuntime/slots";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * S2 체크리스트 부록 D.3 2단계 (2026-11-23) — S2 `renderActionBar` (CardView · TableView · TreeView):
 * an ActionBar placed as the collection's direct child is its action bar. Its count is the
 * collection's selection (hidden while nothing is selected), its clear button empties it, and it
 * floats over the collection's bottom (absolute, 8 in) while the collection keeps room for it under
 * its items (S2 `paddingBottom`). The DOM draws S2's wrapper around the collection and the bar.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

type Harness = Awaited<ReturnType<typeof openAdr280Preview>>;
type Root = Harness["workspace"]["root"];

const TYPES = ["CardView", "Table", "Tree"] as const;

async function withActionBar(type: string) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview([type]);
  const id = h.ids[0] as NodeId;
  const graph = h.workspace.runtime.graph;
  // (CardView · Tree fill their items slot; a Table takes it at its own position — no slot.)
  const slot = catalogSlotTarget(graph, { kind: "node", id });
  const target = slot ?? ({ kind: "node", id } as const);
  const option = catalogSlotInsertOptions(graph, target).find(
    (choice) => choice.label === "ActionBar",
  );
  expect(option, `${type} offers an ActionBar`).toBeDefined();
  const definitionId = option!.definitionId as DefinitionId;
  h.workspace.execute(
    slot
      ? catalogSlotCommands.fill(slot, definitionId, h.workspace.newId)
      : catalogSlotCommands.insert(target, definitionId, h.workspace.newId),
  );
  h.flush();
  return { h, id };
}

/** The collection's records in a root (the Builder's Canvas or the Preview's). */
function collectionOf(root: Root, type: string) {
  const get = (recordId: string) => root.canvasInputs.get(recordId);
  const typeOf = (record: Parameters<Root["typeOf"]>[0]) => root.typeOf(record);
  const collection = [...root.canvasInputs.values()].find(
    (record) => typeOf(record) === type,
  )!;
  const bar = collection.children
    .map(get)
    .find((child) => child && typeOf(child) === "ActionBar")!;
  const keys = catalogGroupItems(collection, get, typeOf).map((item) =>
    catalogItemKey(item, typeOf),
  );
  return { collection, bar, keys };
}

describe("S2 D.3 renderActionBar — the collection's ActionBar child", () => {
  it.each(TYPES)(
    "%s: the bar counts the selection — hidden with none, absolute 8 in over the bottom with some, the collection's room under its items",
    async (type) => {
      const { h, id } = await withActionBar(type);
      const root = h.workspace.root;
      const before = collectionOf(root, type);
      expect(
        before.bar,
        "the ActionBar is the collection's child",
      ).toBeDefined();
      expect(before.bar.hidden).toBe(true);
      expect(before.collection.derivedProps?._actionBarSpace).toBeUndefined();
      h.declare(id, { selectionMode: "multiple" });
      const heightBefore = root
        .getGeometry([before.collection.id])
        .get(before.collection.id)!.height;
      // (Every item selected — "all", not the ActionBar's own default count, 1.)
      h.declare(id, {
        selectionMode: "multiple",
        defaultSelectedKeys: "all",
      });
      const after = collectionOf(root, type);
      expect(after.bar.hidden).not.toBe(true);
      expect(after.bar.derivedProps?._actionBarInContainer).toBe(true);
      expect(after.collection.derivedProps?._actionBarSpace).toBe(
        catalogActionBarSpace(type, after.collection.props),
      );
      // (Its count text — the clear · count box's Text.)
      const texts = [...root.canvasInputs.values()].filter(
        (record) =>
          root.typeOf(record) === "Text" &&
          String(record.props.children ?? "").endsWith(" selected"),
      );
      expect(texts.map((record) => record.props.children)).toContain(
        "All selected",
      );
      // (The engine places it: 8 in from the collection's start · end · bottom.)
      const geometry = root.getGeometry([after.collection.id, after.bar.id]);
      const box = geometry.get(after.collection.id)!;
      const bar = geometry.get(after.bar.id)!;
      // (S2: as wide as 8 in from each side leaves, at most 960 and centred.)
      const room = box.width - 16;
      expect(bar.width).toBeCloseTo(Math.min(960, room), 0);
      expect(bar.x - box.x).toBeCloseTo(8 + (room - bar.width) / 2, 0);
      expect(box.y + box.height - (bar.y + bar.height)).toBeCloseTo(8, 0);
      // (Its bottom padding is the bar's room — S2's inline `paddingBottom`; an auto-height
      //  collection grows by it.)
      const space = catalogActionBarSpace(type, after.collection.props);
      expect(
        root.getDrawnLayoutStyle(after.collection.id)?.paddingBottom,
      ).toBe(`${space}px`);
      if (after.collection.visual.height === undefined) {
        const ownBottom = Number(
          catalogBoxModel(before.collection).padding?.bottom ?? 0,
        );
        expect(box.height - heightBefore).toBeCloseTo(space - ownBottom, 0);
      }
      h.view.unmount();
    },
  );

  it.each(TYPES)(
    "%s Preview: S2's wrapper holds the collection and its bar; the clear button empties the selection",
    async (type) => {
      const { h, id } = await withActionBar(type);
      const keys = collectionOf(h.workspace.root, type).keys;
      h.declare(id, {
        selectionMode: "multiple",
        defaultSelectedKeys: keys.slice(0, 1),
      });
      const element = () => h.element(id)!;
      const wrapper = element().parentElement!;
      expect(wrapper.classList.contains("react-aria-ActionBarContainer")).toBe(
        true,
      );
      const bar = () =>
        wrapper.querySelector<HTMLElement>(":scope > .react-aria-ActionBar");
      expect(bar(), "the bar is the wrapper's child").not.toBeNull();
      expect(bar()!.textContent).toContain("1 selected");
      expect(bar()!.style.position).toBe("absolute");
      expect(element().style.paddingBottom).toBe(
        `${catalogActionBarSpace(type, {})}px`,
      );
      const clear = bar()!.querySelector<HTMLElement>(
        '[aria-label="Clear selection"]',
      )!;
      act(() => {
        fireEvent.click(clear);
      });
      // (Its selection is empty: the bar leaves, the room goes.)
      expect(element().style.paddingBottom).not.toBe(
        `${catalogActionBarSpace(type, {})}px`,
      );
      expect(element().querySelectorAll('[aria-selected="true"]').length).toBe(
        0,
      );
      expect(bar(), "the bar leaves with the selection").toBeNull();
      h.view.unmount();
    },
  );
});

describe("S2 D.3 renderActionBar — a bar put into a collection that already selects", () => {
  it.each(TYPES)(
    "%s: the new bar shows the collection's count at once (its count text built with it)",
    async (type) => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
      const h = await openAdr280Preview([type]);
      const id = h.ids[0] as NodeId;
      h.declare(id, { selectionMode: "multiple", defaultSelectedKeys: "all" });
      const graph = h.workspace.runtime.graph;
      const slot = catalogSlotTarget(graph, { kind: "node", id });
      const target = slot ?? ({ kind: "node", id } as const);
      const option = catalogSlotInsertOptions(graph, target).find(
        (choice) => choice.label === "ActionBar",
      )!;
      const definitionId = option.definitionId as DefinitionId;
      h.workspace.execute(
        slot
          ? catalogSlotCommands.fill(slot, definitionId, h.workspace.newId)
          : catalogSlotCommands.insert(target, definitionId, h.workspace.newId),
      );
      h.flush();
      const root = h.workspace.root;
      const { bar } = collectionOf(root, type);
      expect(bar.hidden).not.toBe(true);
      const texts: string[] = [];
      const visit = (recordId: string) => {
        const record = root.canvasInputs.get(recordId);
        if (!record) return;
        if (root.typeOf(record) === "Text")
          texts.push(String(record.props.children ?? ""));
        record.children.forEach(visit);
      };
      visit(bar.id);
      expect(texts).toContain("All selected");
      h.view.unmount();
    },
  );
});

describe("S2 D.3 renderActionBar — its place among the items", () => {
  it("an item added after it goes before it (the bar stays the last child)", async () => {
    const { h, id } = await withActionBar("CardView");
    const graph = h.workspace.runtime.graph;
    const slot = catalogSlotTarget(graph, { kind: "node", id })!;
    const card = catalogSlotInsertOptions(graph, slot).find(
      (choice) => choice.label === "Card",
    )!;
    h.workspace.execute(
      catalogSlotCommands.fill(
        slot,
        card.definitionId as DefinitionId,
        h.workspace.newId,
      ),
    );
    h.flush();
    const root = h.workspace.root;
    const { collection } = collectionOf(root, "CardView");
    const types = collection.children.map((child) =>
      root.typeOf(root.canvasInputs.get(child)!),
    );
    expect(types.at(-1)).toBe("ActionBar");
    expect(types.filter((type) => type === "Card").length).toBeGreaterThan(1);
    h.view.unmount();
  });
});

describe("S2 D.3 renderActionBar — the Design panel", () => {
  it.each(TYPES)(
    "%s's ActionBar: its count is the collection's (not offered as its own field)",
    async (type) => {
      const { h } = await withActionBar(type);
      const root = h.workspace.root;
      const { bar } = collectionOf(root, type);
      expect(catalogOwnerDecidedProps(root, bar)).toEqual({
        owner: type,
        keys: new Set(["selectedItemCount"]),
      });
      h.view.unmount();
    },
  );
});

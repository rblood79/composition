import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { ListLayout, Rect, Size } from "react-stately/useVirtualizerState";
import { CatalogListLayout } from "../catalogVirtualizer.components";
import type { CatalogConsumerNode } from "../compositionRoot";
import {
  catalogChildKey,
  catalogRowStableElement,
} from "../domBinding.runtime";

/**
 * ADR-310 G8 ⑤ (사용자 결정 2026-11-15 — 같은 문서의 순수 RAC 가상 목록 대비 악화 없음): two causes of
 * the virtual list's scroll cost over RAC's own, measured live (4x: 79 % of frames dropped vs 48 %).
 * (1) The Preview estimates rows (40) — RAC re-lays the list out for every new 32 px row, and mounts
 * rows instead of reusing their views; the estimate learns the measured row. (2) Reused for another
 * row, a view's children were keyed by the row's record id and mounted again — their key is the
 * template position.
 */
function list(layout: ListLayout<unknown>, count: number) {
  const keys = Array.from({ length: count }, (_, index) => `k${index}`);
  const nodes = keys.map((key, index) => ({
    key,
    type: "item",
    index,
    level: 0,
    hasChildNodes: false,
    childNodes: [],
    rendered: null,
    textValue: key,
    parentKey: null,
    prevKey: keys[index - 1] ?? null,
    nextKey: keys[index + 1] ?? null,
  }));
  const size = new Size(300, 300);
  (layout as unknown as { virtualizer: unknown }).virtualizer = {
    size,
    collection: {
      size: count,
      getKeys: () => keys,
      getItem: (key: string) => nodes.find((node) => node.key === key) ?? null,
      getFirstKey: () => keys[0] ?? null,
      getLastKey: () => keys.at(-1) ?? null,
      getKeyBefore: (key: string) => keys[keys.indexOf(key) - 1] ?? null,
      getKeyAfter: (key: string) => keys[keys.indexOf(key) + 1] ?? null,
      getChildren: () => nodes,
      [Symbol.iterator]: () => nodes[Symbol.iterator](),
    },
    visibleRect: new Rect(0, 0, size.width, size.height),
    isPersistedKey: () => false,
    persistedKeys: new Set(),
  };
  const update = () =>
    layout.update({
      layoutOptions: { estimatedRowSize: 40, padding: 4 },
      sizeChanged: false,
      layoutOptionsChanged: false,
      itemSizeChanged: true,
    } as never);
  update();
  return {
    update,
    // (Scrolled to `y`: the rows RAC shows there — new ones are built from the estimate.)
    scrollTo: (y: number) =>
      layout
        .getVisibleLayoutInfos(new Rect(0, y, size.width, size.height))
        .map((info) => Number(String(info.key).slice(1))),
    // (RAC measures each row it shows: `true` = the list must be laid out again.)
    measure: (index: number) =>
      layout.updateItemSize(`k${index}`, new Size(292, 32)),
    height: () => layout.getContentSize().height,
  };
}

describe("ADR-310 G8 ⑤ — a virtual list's rows are reused, not remade", () => {
  it("the estimate learns the measured row: the next rows measure as they were placed", () => {
    const own = list(new CatalogListLayout(), 1000);
    // (The first rows were built at the given estimate 40 — RAC measures them as it shows them.)
    expect(own.scrollTo(0).map(own.measure).every(Boolean)).toBe(true);
    own.update();
    // (The rows a scroll brings in were estimated at the measured 32 — measuring them changes
    //  nothing, and the list's height is already right.)
    const shown = own.scrollTo(16_000);
    expect(shown.length).toBeGreaterThan(5);
    expect(shown.map(own.measure).every((changed) => !changed)).toBe(true);
    expect(own.height()).toBe(4 + 1000 * 32 + 4);
    // (RAC's own ListLayout keeps the first estimate: every new row re-lays the list out.)
    const rac = list(new ListLayout(), 1000);
    rac.measure(0);
    rac.update();
    expect(rac.scrollTo(16_000).map(rac.measure).every(Boolean)).toBe(true);
  });

  const record = (id: string) => ({ id }) as CatalogConsumerNode;
  it("a row's children key by template position — the same in every row, unique among siblings", () => {
    const first = record("body/list::item");
    const copy = record("body/list::item#row:p2");
    expect(catalogChildKey(first, "body/list/item::label")).toBe(
      "body/list/item::label",
    );
    expect(catalogChildKey(copy, "body/list/item::label#row:p2")).toBe(
      "body/list/item::label",
    );
    expect(catalogChildKey(copy, "body/list/item::icon#row:p2")).not.toBe(
      catalogChildKey(copy, "body/list/item::label#row:p2"),
    );
    // (A list's own rows are siblings that differ only by the row — they keep their ids.)
    const owner = record("body::list");
    expect(catalogChildKey(owner, "body/list::item#row:p2")).toBe(
      "body/list::item#row:p2",
    );
    // (A nested row inside a row keeps its own row.)
    expect(catalogChildKey(copy, "body/list/item::sub#row:p2%2Fq")).toBe(
      "body/list/item::sub#row:p2%2Fq",
    );
  });

  it("a row copy's drawn element keys by its template position", () => {
    const copy = record("body/list/item::label#row:p2");
    expect(
      catalogRowStableElement(copy, createElement("span", { key: copy.id }))
        ?.key,
    ).toBe("body/list/item::label");
    const plain = record("body/list/item::label");
    const element = createElement("span", { key: plain.id });
    expect(catalogRowStableElement(plain, element)).toBe(element);
  });
});

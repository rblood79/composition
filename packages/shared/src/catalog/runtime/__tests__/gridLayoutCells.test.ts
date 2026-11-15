import { describe, expect, it } from "vitest";
import { GridLayout, Size } from "react-stately/useVirtualizerState";
import { catalogGridLayoutCells } from "../gridLayoutCells";

/**
 * ADR-310 Phase 8 (사용자 결정 7) — the Canvas's grid cells equal the installed RAC `GridLayout`'s
 * (the oracle is react-stately's own `update`, given a scroll width and items): columns, item
 * size, spacing, margin and each rect.
 */
function racCells(
  width: number,
  count: number,
  options: Record<string, unknown>,
) {
  const keys = Array.from({ length: count }, (_, index) => `k${index}`);
  const collection = {
    size: count,
    getLastKey: () => keys.at(-1) ?? null,
    getKeyBefore: (key: string) => keys[keys.indexOf(key) - 1] ?? null,
    getItem: (key: string) => ({ key, type: "item" }),
    *[Symbol.iterator]() {
      for (const key of keys) yield { key, type: "item" };
    },
  };
  const layout = new GridLayout();
  (layout as unknown as { virtualizer: unknown }).virtualizer = {
    size: new Size(width, 600),
    collection,
    isPersistedKey: () => false,
  };
  layout.update({
    layoutOptions: options,
    sizeChanged: true,
    layoutOptionsChanged: true,
  } as never);
  return keys.map((key) => {
    const rect = layout.getLayoutInfo(key)!.rect;
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
}

describe("ADR-310 Phase 8 — grid cells = RAC GridLayout", () => {
  const cases: [string, number, number, Record<string, unknown>][] = [
    ["defaults", 900, 7, {}],
    [
      "card 160 · space 12 · max 4",
      1000,
      10,
      {
        minItemSize: new Size(160, 120),
        minSpace: new Size(12, 12),
        maxColumns: 4,
      },
    ],
    [
      "max item size · narrow",
      350,
      5,
      {
        minItemSize: new Size(100, 80),
        maxItemSize: new Size(150, 120),
        minSpace: new Size(8, 8),
      },
    ],
    ["one wide column", 120, 3, { minItemSize: new Size(200, 100) }],
  ];
  it.each(cases)("%s", (_, width, count, options) => {
    const ours = catalogGridLayoutCells(width, count, {
      ...(options.minItemSize ? { minItemSize: options.minItemSize as never } : {}),
      ...(options.maxItemSize ? { maxItemSize: options.maxItemSize as never } : {}),
      ...(options.minSpace ? { minSpace: options.minSpace as never } : {}),
      ...(options.maxColumns ? { maxColumns: options.maxColumns as number } : {}),
    });
    expect(ours.cells).toEqual(racCells(width, count, options));
  });
});

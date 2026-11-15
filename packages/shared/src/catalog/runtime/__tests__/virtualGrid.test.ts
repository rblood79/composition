import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { GridLayout, Size } from "react-stately/useVirtualizerState";
import {
  catalogVirtualGridOptions,
  catalogVirtualGridStyle,
} from "../virtualGrid";

/**
 * ADR-310 Phase 8 (사용자 결정 7) — a virtual grid's options: CardView = the installed S2 CardView's
 * table (density `regular`, the t-shirt size two columns fit), GridList = RAC's `GridLayout`
 * defaults; and the Canvas's tracks place the items where the installed RAC `GridLayout` does.
 */
const require = createRequire(
  join(process.cwd(), "../../apps/builder/package.json"),
);
const s2CardView = readFileSync(
  join(
    dirname(require.resolve("@react-spectrum/s2/package.json")),
    "dist/private/CardView.mjs",
  ),
  "utf8",
);

/** `layoutOptions[size].regular` read from the installed S2 source. */
function s2Regular(size: string) {
  const block = s2CardView.slice(s2CardView.indexOf(`    ${size}: {`));
  const regular = block.slice(block.indexOf("regular:"));
  const sizes = [...regular.matchAll(/Size\)\((\d+), (\d+)\)/g)]
    .slice(0, 3)
    .map(([, w, h]) => ({ width: Number(w), height: Number(h) }));
  return { minSpace: sizes[0], minItemSize: sizes[1], maxItemSize: sizes[2] };
}

function racRects(
  width: number,
  count: number,
  options: Record<string, unknown>,
) {
  const keys = Array.from({ length: count }, (_, index) => `k${index}`);
  const layout = new GridLayout();
  (layout as unknown as { virtualizer: unknown }).virtualizer = {
    size: new Size(width, 600),
    collection: {
      size: count,
      getLastKey: () => keys.at(-1) ?? null,
      getKeyBefore: (key: string) => keys[keys.indexOf(key) - 1] ?? null,
      getItem: (key: string) => ({ key, type: "item" }),
      *[Symbol.iterator]() {
        for (const key of keys) yield { key, type: "item" };
      },
    },
    isPersistedKey: () => false,
  };
  layout.update({
    layoutOptions: options,
    sizeChanged: true,
    layoutOptionsChanged: true,
  } as never);
  return keys.map((key) => layout.getLayoutInfo(key)!.rect);
}

const toSizes = (options: Record<string, { width: number; height: number }>) =>
  Object.fromEntries(
    Object.entries(options).map(([key, value]) => [
      key,
      new Size(value.width, value.height),
    ]),
  );

describe("ADR-310 Phase 8 — virtual grid options = S2 CardView · RAC GridLayout", () => {
  it("CardView takes the S2 table of its size, capped at the size two columns fit", () => {
    for (const size of ["XS", "S", "M", "L", "XL"])
      expect(catalogVirtualGridOptions("CardView", { size }, 2000)).toEqual(
        s2Regular(size),
      );
    // (M needs 200 × 2 + 16 × 3 = 448: at 447 S2 renders S.)
    expect(catalogVirtualGridOptions("CardView", { size: "M" }, 448)).toEqual(
      s2Regular("M"),
    );
    expect(catalogVirtualGridOptions("CardView", { size: "M" }, 447)).toEqual(
      s2Regular("S"),
    );
    expect(catalogVirtualGridOptions("CardView", {}, 100)).toEqual(
      s2Regular("XS"),
    );
  });

  it("GridList grid takes RAC's defaults; stack · waterfall are not a GridLayout", () => {
    expect(catalogVirtualGridOptions("GridList", {}, 500)).toEqual({});
    expect(
      catalogVirtualGridOptions("GridList", { layout: "grid" }, 500),
    ).toEqual({});
    expect(
      catalogVirtualGridOptions("GridList", { layout: "stack" }, 500),
    ).toBeUndefined();
    expect(
      catalogVirtualGridOptions("CardView", { layout: "waterfall" }, 500),
    ).toBeUndefined();
    expect(catalogVirtualGridStyle("ListBox", {}, 500)).toBeUndefined();
  });

  it("the Canvas's tracks put each item at RAC's x and the rows at its spacing", () => {
    const cases: [string, Record<string, unknown>, number][] = [
      ["CardView", { size: "M" }, 600],
      ["CardView", { size: "L" }, 1000],
      ["CardView", { size: "XL" }, 430],
      ["GridList", {}, 900],
      ["GridList", {}, 333],
    ];
    for (const [type, props, width] of cases) {
      const style = catalogVirtualGridStyle(type, props, width)!;
      const options = catalogVirtualGridOptions(type, props, width)!;
      const rac = racRects(width, 7, toSizes(options as never));
      const px = (value: unknown) => Number.parseFloat(String(value));
      const tracks = style.gridTemplateColumns as string[];
      const columns = tracks.length;
      const itemWidth = px(tracks[0]);
      expect(new Set(tracks).size).toBe(1);
      rac.forEach((rect, index) => {
        const column = index % columns;
        expect(rect.width).toBe(itemWidth);
        expect(rect.x).toBe(
          px(style.paddingLeft) + column * (itemWidth + px(style.columnGap)),
        );
      });
      // (The first row starts at the vertical space; rows are spaced by it — heights measured.)
      expect(rac[0].y).toBe(px(style.paddingTop));
      expect(style.rowGap).toBe(style.paddingTop);
      expect(rac[columns]?.y ?? Infinity).toBeGreaterThan(rac[0].y);
    }
  });
});

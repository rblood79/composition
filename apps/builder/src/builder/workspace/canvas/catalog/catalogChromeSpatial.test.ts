import { describe, expect, it, vi } from "vitest";
import type { Canvas, CanvasKit } from "canvaskit-wasm";
import {
  createCatalogPageChrome,
  createChromeSpatialIndex,
  chromeIntersects,
} from "./catalogChromeSpatial";
import {
  catalogOverlayNode,
  type CatalogOverlayInputs,
} from "./catalogOverlay";

describe("Canvas chrome spatial work", () => {
  it("비중첩 300 page의 warm overlay는 가림 clip을 만들지 않고 보이는 경계만 그린다", () => {
    const roots = Array.from({ length: 300 }, (_, i) => `p${i}`);
    const boxes = new Map(
      roots.map((id, i) => [
        id,
        { x: i * 2000, y: 0, width: 1920, height: 1080 },
      ]),
    );
    const read = vi.fn((id: string) => boxes.get(id));
    const pages = createCatalogPageChrome(roots, () => undefined, read);
    const viewport = { x: 0, y: 0, width: 1920, height: 1080 };
    const paint = {
      setAntiAlias() {},
      setStyle() {},
      setColor() {},
      setStrokeWidth() {},
      delete() {},
    };
    const ck = {
      Paint: class {
        constructor() {
          return paint;
        }
      },
      PaintStyle: { Stroke: 1 },
      ClipOp: { Difference: 0 },
      XYWHRect: (...r: number[]) => r,
    } as unknown as CanvasKit;
    const canvas = {
      drawRect: vi.fn(),
      clipRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
    } as unknown as Canvas;
    const node = catalogOverlayNode(ck, {
      session: () => ({
        selection: [],
        pageId: undefined,
        hover: undefined,
        editingContext: undefined,
        textEditing: undefined,
        breakpoint: "desktop",
      }),
      recordsOf: () => [],
      fontMgr: () => undefined,
      bounds: () => boxes,
      zoom: () => 1,
      pageBorders: () => ({
        roots: pages.rootsWithin(viewport),
        color: Float32Array.of(0, 0, 0, 1),
      }),
      occluders: (id, area) => pages.occludersOf(id, area ?? viewport),
    } as CatalogOverlayInputs);
    node.renderSkia(canvas, new DOMRect());
    vi.mocked(canvas.drawRect).mockClear();
    read.mockClear();
    node.renderSkia(canvas, new DOMRect());
    expect(canvas.clipRect).not.toHaveBeenCalled();
    expect(canvas.drawRect).toHaveBeenCalledTimes(1);
    expect(read).not.toHaveBeenCalled();
    viewport.width = 600000;
    vi.mocked(canvas.drawRect).mockClear();
    node.renderSkia(canvas, new DOMRect());
    expect(canvas.drawRect).toHaveBeenCalledTimes(300);
    expect(canvas.clipRect).not.toHaveBeenCalled();
    node.dispose();
  });

  it("가림은 실제 paint 영역과 page 순서를 따른다: page 밖 overflow와 active page도 보존", () => {
    const bounds = new Map([
      ["a", { x: 0, y: 0, width: 100, height: 100 }],
      ["b", { x: 50, y: 0, width: 100, height: 100 }],
      ["c", { x: 200, y: 0, width: 100, height: 100 }],
    ]);
    const parent = vi.fn((id: string) =>
      id === "leaf" ? "owner" : id === "owner" ? "a" : undefined,
    );
    const pages = createCatalogPageChrome(["a", "b", "c"], parent, (id) =>
      bounds.get(id),
    );
    expect(pages.occludersOf("a", bounds.get("a")!)).toEqual([bounds.get("b")]);
    expect(pages.occludersOf("leaf", bounds.get("c")!)).toEqual([
      bounds.get("c"),
    ]);
    parent.mockClear();
    pages.occludersOf("owner", bounds.get("a")!);
    expect(parent).not.toHaveBeenCalled();
    const active = createCatalogPageChrome(["b", "c", "a"], parent, (id) =>
      bounds.get(id),
    );
    expect(active.occludersOf("leaf", bounds.get("c")!)).toEqual([]);
    expect(pages.occludersOf("gone", bounds.get("a")!)).toEqual([]);
  });

  it("공간 분할 결과가 전체 순회 oracle과 같고 경계 접촉·0 높이를 보존한다", () => {
    const items = Array.from({ length: 300 }, (_, i) => ({
      x: ((i * 137) % 1600) - 400,
      y: ((i * 73) % 900) - 200,
      width: (i % 7) * 70,
      height: (i % 5) * 40,
    }));
    const query = createChromeSpatialIndex(items, (box) => box);
    for (let i = 0; i < 80; i++) {
      const area = {
        x: i * 17 - 300,
        y: i * 11 - 200,
        width: 200,
        height: 150,
      };
      expect(query(area)).toEqual(
        items.filter((box) => chromeIntersects(box, area)),
      );
    }
  });
});

/**
 * canvas-interaction §8.5 (2026-08-12): page chrome that marks content (slot hatch, row
 * remainders, binding badges, hover outlines) is cut where a page drawn later covers its own page —
 * the ancestor clip (`hitBoundsMap`) does not know about other pages.
 */
const parents = new Map<string, string>([
  ["home", "catalog:root"],
  ["second", "catalog:root"],
  ["third", "catalog:root"],
  ["list", "home"],
  ["row", "list"],
]);
const boxes = new Map([
  ["home", { x: 0, y: 0, width: 100, height: 100 }],
  ["second", { x: 50, y: 20, width: 100, height: 100 }],
  ["third", { x: 200, y: 0, width: 100, height: 100 }],
]);
const parentOf = (id: string) => parents.get(id);
const boundsOf = (id: string) => boxes.get(id);
const everywhere = { x: -1000, y: -1000, width: 3000, height: 3000 };
const occludersOf = (identity: string, roots: string[], lookup = parentOf) =>
  createCatalogPageChrome(roots, lookup, boundsOf).occludersOf(
    identity,
    everywhere,
  );

describe("page occluders (createCatalogPageChrome)", () => {
  it("이미 그려진 Page root이면 부모를 조회하지 않는다", () => {
    const lookup = vi.fn(parentOf);
    expect(occludersOf("home", ["home", "second", "third"], lookup)).toEqual([
      boxes.get("second"),
      boxes.get("third"),
    ]);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("gives the pages painted after a record's own page", () => {
    expect(occludersOf("row", ["home", "second", "third"])).toEqual([
      boxes.get("second"),
      boxes.get("third"),
    ]);
  });

  it("gives nothing for a record on the top page, a page body itself on top, or an undrawn page", () => {
    expect(occludersOf("row", ["second", "third", "home"])).toEqual([]);
    expect(occludersOf("home", ["second", "home"])).toEqual([]);
    expect(occludersOf("row", ["second", "third"])).toEqual([]);
  });
});

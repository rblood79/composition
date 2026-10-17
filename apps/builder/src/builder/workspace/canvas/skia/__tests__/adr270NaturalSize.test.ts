import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * ADR-270 Phase 2 (G1-c): the image's natural size (what object-fit and a fill's layout read) is
 * apart from the drawn bitmap (its pixels). They are equal in production today; here the decoded
 * bitmap is half the natural size (a test-only fixture — what a later downscaled decode would
 * give), and the content rect · fill mapping must still follow the natural size. The expected
 * values are worked by hand from CSS object-fit (the Q5 oracle), not read back from the code.
 */
type Bitmap = { width(): number; height(): number; isDeleted(): boolean };
const bitmaps = new Map<string, Bitmap>();
const bitmap = (w: number, h: number): Bitmap => ({
  width: () => w,
  height: () => h,
  isDeleted: () => false,
});
vi.mock("../imageCache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../imageCache")>()),
  getSkImage: (url: string) => bitmaps.get(url) ?? null,
  loadSkImage: vi.fn(),
}));
vi.mock("../initCanvasKit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../initCanvasKit")>()),
  isCanvasKitInitialized: () => true,
  getCanvasKit: () => ({
    TileMode: { Clamp: "clamp", Decal: "decal", Repeat: "repeat" },
    FilterMode: { Linear: "linear" },
  }),
}));

import { specShapesToSkia } from "../specShapeConverter";
import {
  cssBgImageToSkia,
  fillItemToFillStyle,
} from "../../../../panels/styles/utils/fillToSkia";
import { FillType } from "../../../../../types/builder/fill.types";
import type { ImageFill } from "../types";

/** The natural size the cache records at decode (`dimensionsCache` — window-global). */
const naturalSizes = (globalThis as Record<string, unknown>)
  .__composition_imageDimsCache as Map<
  string,
  { width: number; height: number }
>;
/** Load `url`: natural `w × h`, decoded bitmap half of it. */
const load = (url: string, w: number, h: number) => {
  naturalSizes.set(url, { width: w, height: h });
  bitmaps.set(url, bitmap(w / 2, h / 2));
};
afterEach(() => {
  bitmaps.clear();
  naturalSizes.clear();
});

const imageNode = (src: string, fit: "contain" | "cover" | "fill" | "none") =>
  specShapesToSkia(
    [{ type: "image", x: 0, y: 0, width: 100, height: 100, src, fit }],
    "light",
    100,
    100,
  ).children!.find((child) => child.type === "image")!;

describe("ADR-270 Phase 2 — 원본 치수 ↔ 표시 bitmap 분리", () => {
  // Box 100 × 100. Natural 400 × 200 (wider) · 50 × 300 (taller) · 40 × 20 (both smaller).
  const cases: Array<
    [string, number, number, "contain" | "cover" | "fill" | "none", number[]]
  > = [
    ["wide", 400, 200, "contain", [0, 25, 100, 50]],
    ["wide", 400, 200, "cover", [-50, 0, 200, 100]],
    ["wide", 400, 200, "fill", [0, 0, 100, 100]],
    ["wide", 400, 200, "none", [-150, -50, 400, 200]],
    ["tall", 50, 300, "contain", [125 / 3, 0, 50 / 3, 100]],
    ["tall", 50, 300, "cover", [0, -250, 100, 600]],
    ["tall", 50, 300, "fill", [0, 0, 100, 100]],
    ["tall", 50, 300, "none", [25, -100, 50, 300]],
    ["small", 40, 20, "contain", [0, 25, 100, 50]],
    ["small", 40, 20, "cover", [-50, 0, 200, 100]],
    ["small", 40, 20, "fill", [0, 0, 100, 100]],
    ["small", 40, 20, "none", [30, 40, 40, 20]],
  ];
  it.each(cases)(
    "object-fit — %s %d×%d · %s → 원본 치수 기준 content rect (bitmap 은 절반)",
    (name, w, h, fit, [x, y, cw, ch]) => {
      const url = `${name}.png`;
      load(url, w, h);
      const node = imageNode(url, fit);
      expect(node.image!.src).toBe(url);
      expect(node.image!.bitmap).toBe(bitmaps.get(url));
      expect([node.image!.naturalWidth, node.image!.naturalHeight]).toEqual([
        w,
        h,
      ]);
      expect(node.image!.contentX).toBeCloseTo(x!);
      expect(node.image!.contentY).toBeCloseTo(y!);
      expect(node.image!.contentWidth).toBeCloseTo(cw!);
      expect(node.image!.contentHeight).toBeCloseTo(ch!);
    },
  );

  it("로드 전 — bitmap 없음 · 원본 치수 = 상자 (placeholder), src 는 남는다", () => {
    const node = imageNode("pending.png", "none");
    expect(node.image!.bitmap).toBeNull();
    expect(node.image!.src).toBe("pending.png");
    expect([node.image!.naturalWidth, node.image!.naturalHeight]).toEqual([
      100, 100,
    ]);
    expect([node.image!.contentX, node.image!.contentWidth]).toEqual([0, 100]);
  });

  /** A point of the bitmap → the box, through the shader's matrix (row-major 3 × 3). */
  const map = (m: Float32Array, px: number, py: number) => [
    m[0]! * px + m[1]! * py + m[2]!,
    m[3]! * px + m[4]! * py + m[5]!,
  ];

  it("image fill (mode fill = cover) — bitmap 의 끝 모서리가 원본 치수로 계산한 자리에 놓인다", () => {
    load("fill.png", 400, 200);
    const style = fillItemToFillStyle(
      {
        id: "f",
        type: FillType.Image,
        enabled: true,
        opacity: 1,
        blendMode: "normal",
        url: "fill.png",
        mode: "fill",
      },
      100,
      100,
    ) as ImageFill;
    // Cover 400 × 200 in 100 × 100: scale 0.5 → 200 × 100 at (−50, 0); the far corner is (150, 100).
    expect(map(style.matrix!, 0, 0)).toEqual([-50, 0]);
    expect(map(style.matrix!, 200, 100)).toEqual([150, 100]);
  });

  it("background-image (size auto · position 0 0) — bitmap 이 원본 크기로 깔린다", () => {
    load("bg.png", 80, 40);
    const style = cssBgImageToSkia(
      "bg.png",
      200,
      100,
      "auto",
      "0 0",
      "no-repeat",
    ) as ImageFill;
    expect(map(style.matrix!, 0, 0)).toEqual([0, 0]);
    expect(map(style.matrix!, 40, 20)).toEqual([80, 40]);
  });

  it("bitmap 과 원본 치수가 같으면 행렬은 원본 경로 그대로 (지금의 production)", () => {
    naturalSizes.set("same.png", { width: 400, height: 200 });
    bitmaps.set("same.png", bitmap(400, 200));
    const style = fillItemToFillStyle(
      {
        id: "f",
        type: FillType.Image,
        enabled: true,
        opacity: 1,
        blendMode: "normal",
        url: "same.png",
        mode: "fill",
      },
      100,
      100,
    ) as ImageFill;
    expect([...style.matrix!]).toEqual([0.5, 0, -50, 0, 0.5, 0, 0, 0, 1]);
  });
});

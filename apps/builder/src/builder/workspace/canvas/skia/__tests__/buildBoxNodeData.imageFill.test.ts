import { describe, expect, it, vi } from "vitest";

/**
 * image fill 의 Skia 배선 (ADR-235 G0 발견, 2026-09-26).
 *
 * 확정 결함: `fillsToSkiaFillStyle` 은 image FillStyle 을 만들었지만 box/spec 두 node builder 가
 * gradient · mesh 만 `box.fill` 에 실어 Canvas 가 image fill 을 그리지 않았다. Preview DOM 은
 * `fillAdapter` 의 `url()` 층으로 그려 D3 대칭이 깨졌다. 기하도 맞춘다 — 이미지 밖은 투명
 * (Decal = DOM `no-repeat`), 배치는 중앙 (DOM `background-position: center`).
 */
const fakeImage = { width: () => 100, height: () => 50 };
const squareImage = { width: () => 50, height: () => 50 };
vi.mock("../imageCache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../imageCache")>()),
  getSkImage: (url: string) =>
    url === "loaded.png"
      ? fakeImage
      : url === "square.png"
        ? squareImage
        : null,
  loadSkImage: vi.fn(),
}));
vi.mock("../initCanvasKit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../initCanvasKit")>()),
  isCanvasKitInitialized: () => true,
  getCanvasKit: () => ({
    TileMode: { Clamp: "clamp", Decal: "decal" },
    FilterMode: { Linear: "linear" },
  }),
}));

import { buildBoxNodeData } from "../buildBoxNodeData";
import {
  FillType,
  type ColorFillItem,
  type ImageFillItem,
  type LinearGradientFillItem,
} from "../../../../../types/builder/fill.types";
import type { CanvasSceneNode } from "../../scene/canvasSceneNode";
import type { ComputedLayout } from "../../layout/engines/LayoutEngine";

const layout = { x: 0, y: 0, width: 200, height: 100 } as ComputedLayout;

const image = (
  url: string,
  mode: ImageFillItem["mode"] = "fill",
): ImageFillItem => ({
  id: `img-${url}`,
  type: FillType.Image,
  enabled: true,
  opacity: 1,
  blendMode: "normal",
  url,
  mode,
});
const RED: ColorFillItem = {
  id: "red",
  type: FillType.Color,
  enabled: true,
  opacity: 1,
  blendMode: "normal",
  color: "#FF0000FF",
};
const LINEAR: LinearGradientFillItem = {
  id: "lg",
  type: FillType.LinearGradient,
  enabled: true,
  opacity: 1,
  blendMode: "normal",
  rotation: 90,
  stops: [
    { color: "#FF0000FF", position: 0 },
    { color: "#0000FFFF", position: 1 },
  ],
};

function build(fills: unknown[]) {
  const element = {
    id: "n1",
    props: { style: {} },
    fills,
  } as unknown as CanvasSceneNode;
  return buildBoxNodeData({ element, layout });
}

describe("buildBoxNodeData — image fill 배선", () => {
  it("디코드된 image fill → box.fill 에 image shader, 이미지 밖 투명 (Decal)", () => {
    const fill = build([image("loaded.png")])?.box?.fill as
      { type: string; tileModeX: string; matrix: Float32Array } | undefined;
    expect(fill?.type).toBe("image");
    expect(fill?.tileModeX).toBe("decal");
  });

  it("fit 은 중앙 배치 (DOM background-position: center 대칭)", () => {
    const fill = build([image("loaded.png", "fit")])?.box?.fill as
      { matrix: Float32Array } | undefined;
    // 200×100 상자 · 100×50 이미지 → scale 2, 여백 0 (정확히 맞음)
    expect(Array.from(fill!.matrix)).toEqual([2, 0, 0, 0, 2, 0, 0, 0, 1]);
    // 200×100 상자 · 50×50 이미지 → scale 2, 가로 여백 100 을 양쪽 50 씩 (중앙)
    const square = build([image("square.png", "fit")])?.box?.fill as
      { matrix: Float32Array } | undefined;
    expect(Array.from(square!.matrix)).toEqual([2, 0, 50, 0, 2, 0, 0, 0, 1]);
  });

  it("image 아래 층은 underlay 로 칠한다 (DOM 층 쌓기 대칭)", () => {
    const node = build([RED, image("loaded.png")]);
    expect(node?.box?.fill?.type).toBe("image");
    expect(node?.box?.fillUnderlays).toHaveLength(1);
  });

  it("디코드 전에는 아래 gradient 가 box.fill 을 가로채지 않는다", () => {
    const node = build([LINEAR, image("pending.png")]);
    expect(node?.box?.fill).toBeUndefined();
    expect(node?.box?.fillUnderlays?.[0]?.type).toBe("linear-gradient");
  });

  it("맨 위가 image 가 아니면 기존 경로 그대로", () => {
    const node = build([image("loaded.png"), LINEAR]);
    expect(node?.box?.fill?.type).toBe("linear-gradient");
  });
});

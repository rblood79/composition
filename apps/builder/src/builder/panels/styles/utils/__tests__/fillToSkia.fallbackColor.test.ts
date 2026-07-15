import { describe, expect, it } from "vitest";
import { fillsToSkiaFallbackColor } from "../fillToSkia";
import type {
  FillItem,
  LinearGradientFillItem,
  MeshGradientFillItem,
  ColorFillItem,
  ImageFillItem,
} from "../../../../../types/builder/fill.types";
import { FillType } from "../../../../../types/builder/fill.types";

const LINEAR: LinearGradientFillItem = {
  id: "lg1",
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

const MESH: MeshGradientFillItem = {
  id: "mg1",
  type: FillType.MeshGradient,
  enabled: true,
  opacity: 1,
  blendMode: "normal",
  rows: 2,
  columns: 2,
  points: [
    { position: [0, 0], color: "#00FF00FF" },
    { position: [1, 0], color: "#0000FFFF" },
    { position: [0, 1], color: "#FF0000FF" },
    { position: [1, 1], color: "#FFFFFFFF" },
  ],
};

const COLOR: ColorFillItem = {
  id: "c1",
  type: FillType.Color,
  enabled: true,
  opacity: 1,
  blendMode: "normal",
  color: "#123456FF",
};

const IMAGE: ImageFillItem = {
  id: "img1",
  type: FillType.Image,
  enabled: true,
  opacity: 1,
  blendMode: "normal",
  url: "https://example.com/a.png",
  mode: "fill",
};

describe("fillsToSkiaFallbackColor", () => {
  it("linear gradient → 첫 stop 색 반환", () => {
    const c = fillsToSkiaFallbackColor([LINEAR]);
    expect(c).not.toBeNull();
    expect(Array.from(c!)).toEqual([1, 0, 0, 1]);
  });

  it("mesh gradient → 첫 point 색 반환", () => {
    const c = fillsToSkiaFallbackColor([MESH]);
    expect(Array.from(c!)).toEqual([0, 1, 0, 1]);
  });

  it("hex8 alpha × fill.opacity 합성", () => {
    const half: FillItem = {
      ...LINEAR,
      opacity: 0.5,
      stops: [
        { color: "#FF000080", position: 0 },
        { color: "#0000FFFF", position: 1 },
      ],
    };
    const c = fillsToSkiaFallbackColor([half]);
    // 0x80/255 ≈ 0.502 × 0.5 ≈ 0.25 (hex8ToFloat32 는 alpha 소수 2자리 정밀도)
    expect(c![3]).toBeCloseTo((0x80 / 255) * 0.5, 2);
  });

  it("image 는 건너뛰고 아래 gradient 사용", () => {
    const c = fillsToSkiaFallbackColor([LINEAR, IMAGE]);
    expect(Array.from(c!)).toEqual([1, 0, 0, 1]);
  });

  it("color-only fills → null (fillsToSkiaFillColor 담당 영역)", () => {
    expect(fillsToSkiaFallbackColor([COLOR])).toBeNull();
  });

  it("disabled fill 은 건너뛴다", () => {
    const disabled: FillItem = { ...LINEAR, enabled: false };
    expect(fillsToSkiaFallbackColor([disabled])).toBeNull();
  });
});

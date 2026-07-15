import { describe, expect, it } from "vitest";
import { fillItemToFillStyle } from "../fillToSkia";
import type {
  AngularGradientFillItem,
  RadialGradientFillItem,
} from "../../../../../types/builder/fill.types";
import { FillType } from "../../../../../types/builder/fill.types";
import type {
  AngularGradientFill,
  RadialGradientFill,
} from "../../../../workspace/canvas/skia/types";

const STOPS = [
  { color: "#000000FF", position: 0 },
  { color: "#FFFFFFFF", position: 1 },
];

function makeAngular(rotation: number): AngularGradientFillItem {
  return {
    id: "ag1",
    type: FillType.AngularGradient,
    enabled: true,
    opacity: 1,
    blendMode: "normal",
    center: { x: 0.5, y: 0.5 },
    rotation,
    stops: STOPS,
  };
}

function makeRadial(
  radius: RadialGradientFillItem["radius"],
): RadialGradientFillItem {
  return {
    id: "rg1",
    type: FillType.RadialGradient,
    enabled: true,
    opacity: 1,
    blendMode: "normal",
    center: { x: 0.5, y: 0.5 },
    radius,
    stops: STOPS,
  };
}

describe("angular gradient rotation matrix", () => {
  it("rotation=0 → -90° 보정 행렬 (CSS from 0deg = 12시 시작, 기존 동작 보존)", () => {
    const fill = fillItemToFillStyle(
      makeAngular(0),
      200,
      100,
    ) as AngularGradientFill;
    const m = Array.from(fill.rotationMatrix!);
    // θ=-90°: cos=0, sin=-1 → [0, 1, cx-cy, -1, 0, cy+cx]
    expect(m[0]).toBeCloseTo(0, 6);
    expect(m[1]).toBeCloseTo(1, 6);
    expect(m[2]).toBeCloseTo(100 - 50, 4); // cx - cy
    expect(m[3]).toBeCloseTo(-1, 6);
    expect(m[4]).toBeCloseTo(0, 6);
    expect(m[5]).toBeCloseTo(50 + 100, 4); // cy + cx
  });

  it("rotation=45 → θ=-45° 행렬 (과거 -90° 고정으로 rotation 무시되던 결함 회귀 가드)", () => {
    const fill = fillItemToFillStyle(
      makeAngular(45),
      200,
      100,
    ) as AngularGradientFill;
    const m = Array.from(fill.rotationMatrix!);
    const theta = ((45 - 90) * Math.PI) / 180;
    expect(m[0]).toBeCloseTo(Math.cos(theta), 6);
    expect(m[1]).toBeCloseTo(-Math.sin(theta), 6);
    expect(m[3]).toBeCloseTo(Math.sin(theta), 6);
    expect(m[4]).toBeCloseTo(Math.cos(theta), 6);
  });

  it("회전 행렬은 center 를 고정한다 (M·center = center)", () => {
    const fill = fillItemToFillStyle(
      makeAngular(73),
      200,
      100,
    ) as AngularGradientFill;
    const m = Array.from(fill.rotationMatrix!);
    const [cx, cy] = [fill.cx, fill.cy];
    expect(m[0] * cx + m[1] * cy + m[2]).toBeCloseTo(cx, 3);
    expect(m[3] * cx + m[4] * cy + m[5]).toBeCloseTo(cy, 3);
  });
});

describe("radial gradient ellipse (radius 반영)", () => {
  it("대칭 radius → matrix 없음, endRadius = rx", () => {
    const fill = fillItemToFillStyle(
      makeRadial({ width: 0.5, height: 0.5 }),
      200,
      200,
    ) as RadialGradientFill;
    expect(fill.endRadius).toBe(100);
    expect(fill.matrix).toBeUndefined();
  });

  it("비대칭 radius → endRadius=rx + y-scale(ry/rx) localMatrix", () => {
    // 390×844 박스, radius {0.6, 0.5} → rx=234, ry=422
    const fill = fillItemToFillStyle(
      makeRadial({ width: 0.6, height: 0.5 }),
      390,
      844,
    ) as RadialGradientFill;
    expect(fill.endRadius).toBeCloseTo(234, 4);
    const m = Array.from(fill.matrix!);
    const scaleY = 422 / 234;
    expect(m[4]).toBeCloseTo(scaleY, 5);
    // center 고정: cy·scaleY + ty = cy
    const cy = fill.center[1];
    expect(m[4] * cy + m[5]).toBeCloseTo(cy, 3);
  });

  it("radius 0 → legacy max 원형 유지 (0 반지름 shader 방지)", () => {
    const fill = fillItemToFillStyle(
      makeRadial({ width: 0, height: 0 }),
      200,
      100,
    ) as RadialGradientFill;
    expect(fill.endRadius).toBeGreaterThan(0);
    expect(fill.matrix).toBeUndefined();
  });
});

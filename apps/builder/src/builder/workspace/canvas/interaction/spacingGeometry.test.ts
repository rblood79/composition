import { describe, expect, it } from "vitest";
import {
  buildSpacingBands,
  hitTestSpacingBands,
  hitTestSpacingHandles,
  estimateSpacingHandleRate,
  measureSpacingHandleRate,
  resolveSpacingHandleRect,
  spacingDeltaForPointer,
} from "./spacingGeometry";

const owner = { x: 100, y: 200, width: 300, height: 160 };
const border = { top: 2, right: 2, bottom: 2, left: 2 };
const padding = { top: 10, right: 20, bottom: 30, left: 40 };

describe("buildSpacingBands (ADR-222 §3)", () => {
  it("derives padding bands inside the border with top/bottom owning corners", () => {
    const bands = buildSpacingBands({
      ownerBounds: owner,
      border,
      padding,
      gap: null,
    });
    const byId = Object.fromEntries(bands.map((b) => [b.id, b]));
    // padding-box: x 102, y 202, w 296, h 156
    expect(byId["padding:top"].rect).toEqual({
      x: 102,
      y: 202,
      width: 296,
      height: 10,
    });
    expect(byId["padding:bottom"].rect).toEqual({
      x: 102,
      y: 202 + 156 - 30,
      width: 296,
      height: 30,
    });
    // 좌·우 띠도 padding-box 높이 **전체** (Figma 와 같다 — 2026-09-20). 코너는 상·하와 겹치고
    // 히트 순서 (상·하 먼저) 가 코너 소유를 정한다 (아래 hit test 케이스).
    expect(byId["padding:left"].rect).toEqual({
      x: 102,
      y: 202,
      width: 40,
      height: 156,
    });
    expect(byId["padding:right"].rect).toEqual({
      x: 102 + 296 - 20,
      y: 202,
      width: 20,
      height: 156,
    });
    // 움직이는 띠 가장자리가 포인터를 따라간다 (2026-09-26) — 기본 (고정 폭 · hug 높이):
    //   top·left 는 안쪽 가장자리가 안쪽으로, bottom 은 바깥 가장자리가 아래로, right 는 안쪽으로
    expect(byId["padding:top"]).toMatchObject({
      axis: "y",
      sign: 1,
      property: "paddingTop",
      value: 10,
    });
    expect(byId["padding:bottom"]).toMatchObject({ axis: "y", sign: 1 });
    expect(byId["padding:left"]).toMatchObject({ axis: "x", sign: 1 });
    expect(byId["padding:right"]).toMatchObject({
      axis: "x",
      sign: -1,
      value: 20,
    });
  });

  it("flips bottom · right by whether the box grows on that axis (hug) or keeps its size (fixed)", () => {
    const signs = (grows: { x: boolean; y: boolean }) =>
      Object.fromEntries(
        buildSpacingBands({
          ownerBounds: owner,
          border,
          padding,
          paddingGrowth: grows,
          gap: null,
        }).map((b) => [b.id, b.sign]),
      );
    // hug 폭 · 고정 높이: right 는 바깥 가장자리가 오른쪽으로 (+x), bottom 은 안쪽 가장자리가 위로 (−y)
    expect(signs({ x: true, y: false })).toEqual({
      "padding:top": 1,
      "padding:bottom": -1,
      "padding:left": 1,
      "padding:right": 1,
    });
    // 양축 고정: 네 변 모두 안쪽으로 끌면 커진다
    expect(signs({ x: false, y: false })).toEqual({
      "padding:top": 1,
      "padding:bottom": -1,
      "padding:left": 1,
      "padding:right": -1,
    });
  });

  it("keeps zero padding as a zero-thickness band at the border inner edge (synthetic handle)", () => {
    const bands = buildSpacingBands({
      ownerBounds: owner,
      border,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      gap: null,
    });
    const top = bands.find((b) => b.id === "padding:top")!;
    expect(top.rect).toEqual({ x: 102, y: 202, width: 296, height: 0 });
    const handle = resolveSpacingHandleRect(top, 2);
    expect(handle).toEqual({ x: 250 - 3, y: 202 - 0.5, width: 6, height: 1 });
  });

  it("places vertical-flex gap bands between children sorted by position, using the configured gap only", () => {
    const bands = buildSpacingBands({
      ownerBounds: owner,
      border,
      padding,
      gap: {
        axis: "vertical",
        value: 12,
        reverse: false,
        childBounds: [
          { x: 142, y: 260, width: 50, height: 40 }, // second visually
          { x: 142, y: 212, width: 50, height: 40 }, // first
        ],
      },
    });
    const gaps = bands.filter((b) => b.kind === "gap");
    expect(gaps).toHaveLength(1);
    // content-box x: 102+40=142, width 296-40-20=236; band starts at 252, thickness min(12, 260-252=8)
    expect(gaps[0]).toMatchObject({
      id: "gap:0",
      property: "rowGap",
      axis: "y",
      sign: 1,
      value: 12,
      rect: { x: 142, y: 252, width: 236, height: 8 },
    });
  });

  it("uses columnGap with x axis for horizontal flex and reverses the sign for row-reverse", () => {
    const bands = buildSpacingBands({
      ownerBounds: owner,
      border,
      padding: null,
      gap: {
        axis: "horizontal",
        value: 16,
        reverse: true,
        childBounds: [
          { x: 102, y: 202, width: 50, height: 40 },
          { x: 168, y: 202, width: 50, height: 40 },
          { x: 234, y: 202, width: 50, height: 40 },
        ],
      },
    });
    const gaps = bands.filter((b) => b.kind === "gap");
    expect(gaps.map((g) => g.id)).toEqual(["gap:0", "gap:1"]);
    expect(gaps[0]).toMatchObject({
      property: "columnGap",
      axis: "x",
      sign: -1,
      rect: { x: 152, y: 202, width: 16, height: 156 },
    });
  });

  it("returns no gap bands with fewer than two children", () => {
    const bands = buildSpacingBands({
      ownerBounds: owner,
      border,
      padding: null,
      gap: { axis: "vertical", value: 8, reverse: false, childBounds: [owner] },
    });
    expect(bands).toEqual([]);
  });
});

describe("hitTestSpacingBands", () => {
  const bands = buildSpacingBands({
    ownerBounds: owner,
    border,
    padding,
    gap: null,
  });

  it("corners belong to top/bottom even though left/right bands span the full height", () => {
    // 좌상 코너 (padding-box 안, top 10 × left 40 겹침) → top
    expect(
      hitTestSpacingBands({ x: 102 + 5, y: 202 + 5 }, bands, 1),
    ).toMatchObject({
      band: { id: "padding:top" },
      onHandle: false,
    });
    // 우하 코너 (bottom 30 × right 20 겹침) → bottom
    expect(
      hitTestSpacingBands({ x: 102 + 296 - 5, y: 202 + 156 - 5 }, bands, 1),
    ).toMatchObject({ band: { id: "padding:bottom" }, onHandle: false });
    // 좌측 띠의 중간 (코너 밖) 은 left
    expect(
      hitTestSpacingBands({ x: 102 + 5, y: 202 + 78 }, bands, 1),
    ).toMatchObject({
      band: { id: "padding:left" },
    });
  });

  it("prefers the 12px handle square over the band area and scales with zoom", () => {
    const top = bands.find((b) => b.id === "padding:top")!;
    const cx = top.rect.x + top.rect.width / 2;
    const cy = top.rect.y + top.rect.height / 2;
    expect(hitTestSpacingBands({ x: cx + 5, y: cy + 5 }, bands, 1)).toEqual({
      band: top,
      onHandle: true,
    });
    // zoom 2 → 화면 12px = scene 6px, 반경 3
    expect(hitTestSpacingBands({ x: cx + 5, y: cy }, bands, 2)).toEqual({
      band: top,
      onHandle: false,
    });
    expect(hitTestSpacingBands({ x: cx + 2, y: cy }, bands, 2)).toEqual({
      band: top,
      onHandle: true,
    });
  });

  it("hits the band area away from the handle and misses the content area", () => {
    const left = bands.find((b) => b.id === "padding:left")!;
    expect(hitTestSpacingBands({ x: 110, y: 300 }, bands, 1)).toEqual({
      band: left,
      onHandle: false,
    });
    // content area (inside all paddings)
    expect(hitTestSpacingBands({ x: 250, y: 280 }, bands, 1)).toBeNull();
  });

  it("drag target = handle square only — band area away from the handle is not draggable (2026-09-26)", () => {
    const top = bands.find((b) => b.id === "padding:top")!;
    const cx = top.rect.x + top.rect.width / 2;
    const cy = top.rect.y + top.rect.height / 2;
    expect(hitTestSpacingHandles({ x: cx + 5, y: cy + 5 }, bands, 1)).toBe(top);
    // 띠 영역 (핸들 밖) · 코너 · content → 드래그 대상 아님
    expect(hitTestSpacingHandles({ x: 110, y: 300 }, bands, 1)).toBeNull();
    expect(hitTestSpacingHandles({ x: 102 + 5, y: 202 + 5 }, bands, 1)).toBeNull();
    expect(hitTestSpacingHandles({ x: 250, y: 280 }, bands, 1)).toBeNull();
    // zoom 2 → 화면 12px = scene 6px
    expect(hitTestSpacingHandles({ x: cx + 5, y: cy }, bands, 2)).toBeNull();
    expect(hitTestSpacingHandles({ x: cx + 2, y: cy }, bands, 2)).toBe(top);
  });

  it("gives a zero-thickness band a minimal 4px hit strip", () => {
    const zero = buildSpacingBands({
      ownerBounds: owner,
      border,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      gap: null,
    });
    const top = zero.find((b) => b.id === "padding:top")!;
    expect(hitTestSpacingBands({ x: 120, y: 203.5 }, zero, 1)).toEqual({
      band: top,
      onHandle: false,
    });
    expect(hitTestSpacingBands({ x: 120, y: 206 }, zero, 1)).toBeNull();
  });

  it("falls back to 1:1 along axis·sign when the handle does not move with the value (rate ≈ 0)", () => {
    const bottom = bands.find((b) => b.id === "padding:bottom")!;
    expect(spacingDeltaForPointer(bottom, 10, 0)).toBe(10);
    const right = bands.find((b) => b.id === "padding:right")!;
    expect(spacingDeltaForPointer(right, -4, 0.05)).toBe(4);
  });
});

describe("핸들 = 포인터 · 핸들은 값의 절반 위치 (2026-09-26 사용자 규칙)", () => {
  const bands = buildSpacingBands({ ownerBounds: owner, border, padding, gap: null });
  // 핸들은 띠 중앙 (값/2) 에 고정 — 핸들이 포인터와 같은 자리에 있도록 값 변화량을 정한다.
  //   rate = 값 +1 당 핸들 중심 이동 (조절 축 +방향). delta = 포인터 이동 / rate.
  const center = (b: { rect: { x: number; y: number; width: number; height: number }; axis: "x" | "y" }) =>
    b.axis === "y" ? b.rect.y + b.rect.height / 2 : b.rect.x + b.rect.width / 2;

  it("한 변: 핸들은 값의 절반만 움직인다 → rate ±0.5 → 포인터 10 = 값 20", () => {
    const top = bands.find((b) => b.id === "padding:top")!;
    expect(estimateSpacingHandleRate(top, { sides: ["top"] })).toBe(0.5);
    expect(spacingDeltaForPointer(top, 10, 0.5)).toBe(20);
    const right = bands.find((b) => b.id === "padding:right")!; // 기본 고정 폭 → sign −1
    expect(estimateSpacingHandleRate(right, { sides: ["right"] })).toBe(-0.5);
    expect(spacingDeltaForPointer(right, -10, -0.5)).toBe(20);
  });

  it("Alt 양쪽 · hug 축의 뒤쪽 변: 앞쪽 변 증가가 띠를 민다 → rate 1.5", () => {
    const grown = buildSpacingBands({
      ownerBounds: owner,
      border,
      padding,
      paddingGrowth: { x: true, y: true },
      gap: null,
    });
    const bottom = grown.find((b) => b.id === "padding:bottom")!;
    const right = grown.find((b) => b.id === "padding:right")!;
    expect(estimateSpacingHandleRate(bottom, { sides: ["top", "bottom"] })).toBe(1.5);
    expect(estimateSpacingHandleRate(right, { sides: ["left", "right"] })).toBe(1.5);
    expect(estimateSpacingHandleRate(bottom, { sides: ["bottom"] })).toBe(0.5);
  });

  it("gap k 번째: 앞의 gap 들이 같이 늘어 띠를 민다 → rate k + 0.5 (reverse 는 뒤에서부터 · 음수)", () => {
    const gapBand = (gapIndex: number, sign: 1 | -1) =>
      ({ kind: "gap", gapIndex, sign, axis: "y", side: null }) as never;
    expect(estimateSpacingHandleRate(gapBand(0, 1), { gapCount: 3 })).toBe(0.5);
    expect(estimateSpacingHandleRate(gapBand(2, 1), { gapCount: 3 })).toBe(2.5);
    expect(estimateSpacingHandleRate(gapBand(2, -1), { gapCount: 3 })).toBe(-0.5);
    expect(estimateSpacingHandleRate(gapBand(0, -1), { gapCount: 3 })).toBe(-2.5);
  });

  it("실측 rate: 시작 · 현재 띠의 핸들 중심 이동 / 값 변화 (|Δ값| < 2 는 미측정)", () => {
    const start = bands.find((b) => b.id === "padding:top")!;
    const at = (top: number) =>
      buildSpacingBands({ ownerBounds: { ...owner, y: owner.y - 10 }, border, padding: { ...padding, top }, gap: null })
        .find((b) => b.id === "padding:top")!;
    // 부모 가운데 정렬처럼 박스가 위로 −10 밀린 채 값 +20: 중심 이동 = −10 + 10 = 0 → rate 0
    expect(measureSpacingHandleRate(start, at(padding.top + 20))).toBe(0);
    expect(measureSpacingHandleRate(start, at(padding.top + 1))).toBeNull();
    const plain = buildSpacingBands({ ownerBounds: owner, border, padding: { ...padding, top: padding.top + 20 }, gap: null })
      .find((b) => b.id === "padding:top")!;
    expect(measureSpacingHandleRate(start, plain)).toBe(0.5);
    expect(center(plain) - center(start)).toBe(10);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildSpacingBands,
  hitTestSpacingBands,
  hitTestSpacingHandles,
  resolveSpacingHandleRect,
  shiftDraggedHandles,
  spacingDeltaFromPointer,
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

  it("maps pointer movement through axis and sign", () => {
    const bottom = bands.find((b) => b.id === "padding:bottom")!;
    expect(spacingDeltaFromPointer(bottom, 7, 10)).toBe(10);
    const top = bands.find((b) => b.id === "padding:top")!;
    expect(spacingDeltaFromPointer(top, 7, 10)).toBe(10);
    const right = bands.find((b) => b.id === "padding:right")!;
    expect(spacingDeltaFromPointer(right, -4, 99)).toBe(4);
    const left = bands.find((b) => b.id === "padding:left")!;
    expect(spacingDeltaFromPointer(left, 4, 99)).toBe(4);
  });
});

describe("shiftDraggedHandles — 드래그 중 핸들이 포인터와 1:1 (2026-09-26 사용자 신고: 핸들이 절반 속도)", () => {
  // 값이 d 늘면 띠 중앙은 d/2 만 움직인다 — 핸들을 sign·(현재 − 시작)/2 만큼 더 옮겨 움직이는 가장자리에 붙인다
  const at = (value: number) =>
    buildSpacingBands({
      ownerBounds: owner,
      border,
      padding: { ...padding, top: value, right: value },
      gap: null,
    });
  const handleCenter = (band: ReturnType<typeof at>[number]) => {
    const r = resolveSpacingHandleRect(band, 1);
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  };

  it("top (+y): 값 10 → 30 이면 핸들이 20 이동 (띠 중앙 이동 10 + 보정 10)", () => {
    const start = at(10).find((b) => b.id === "padding:top")!;
    const shifted = shiftDraggedHandles(at(30), ["padding:top"], {
      "padding:top": 10,
    }).find((b) => b.id === "padding:top")!;
    expect(handleCenter(shifted).y - handleCenter(start).y).toBe(20);
    expect(handleCenter(shifted).x).toBe(handleCenter(start).x);
  });

  it("right 고정 폭 (sign −1): 값 20 → 30 이면 핸들이 −10 이동", () => {
    const start = at(20).find((b) => b.id === "padding:right")!;
    const shifted = shiftDraggedHandles(at(30), ["padding:right"], {
      "padding:right": 20,
    }).find((b) => b.id === "padding:right")!;
    expect(handleCenter(shifted).x - handleCenter(start).x).toBe(-10);
  });

  it("움직이지 않는 띠 · 시작값 없는 띠는 그대로 · 히트도 옮긴 핸들을 따른다", () => {
    const bands = shiftDraggedHandles(at(30), ["padding:top"], {
      "padding:top": 10,
    });
    const left = bands.find((b) => b.id === "padding:left")!;
    expect(left.handleShift ?? 0).toBe(0);
    const top = bands.find((b) => b.id === "padding:top")!;
    const c = handleCenter(top);
    expect(hitTestSpacingHandles(c, bands, 1)).toBe(top);
  });
});

describe("shiftDraggedHandles — 잡은 핸들은 시작 위치 + 값 변화량 (Alt 양쪽: 반대 변 증가가 띠를 민다)", () => {
  it("bottom 을 잡고 top·bottom 이 같이 +40 이면 (hug 높이) 박스가 80 커져도 잡은 핸들은 +40", () => {
    const start = buildSpacingBands({ ownerBounds: owner, border, padding, gap: null });
    const startBottom = start.find((b) => b.id === "padding:bottom")!;
    const startCenter = startBottom.rect.y + startBottom.rect.height / 2;
    const grown = buildSpacingBands({
      ownerBounds: { ...owner, height: owner.height + 80 },
      border,
      padding: { ...padding, top: padding.top + 40, bottom: padding.bottom + 40 },
      gap: null,
    });
    const bands = shiftDraggedHandles(
      grown,
      ["padding:top", "padding:bottom"],
      { "padding:top": padding.top, "padding:bottom": padding.bottom },
      { bandId: "padding:bottom", center: startCenter },
    );
    const bottom = bands.find((b) => b.id === "padding:bottom")!;
    const r = resolveSpacingHandleRect(bottom, 1);
    expect(r.y + r.height / 2 - startCenter).toBe(40);
    // 잡지 않은 top 은 자기 움직이는 가장자리에 붙는다 (시작 중앙 + 40)
    const top = bands.find((b) => b.id === "padding:top")!;
    const rt = resolveSpacingHandleRect(top, 1);
    const startTop = start.find((b) => b.id === "padding:top")!;
    expect(rt.y + rt.height / 2 - (startTop.rect.y + startTop.rect.height / 2)).toBe(40);
  });
});

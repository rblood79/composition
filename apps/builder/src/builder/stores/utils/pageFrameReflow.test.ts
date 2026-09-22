import { describe, expect, it } from "vitest";
import { computePageFrameReflow } from "./pageFrameReflow";

const positions = {
  a: { x: 0, y: 0 },
  b: { x: 0, y: 1160 },
  c: { x: 0, y: 2320 },
};

describe("computePageFrameReflow — 바뀐 페이지 뒤의 페이지만 Δ 만큼 민다", () => {
  it("vertical: 첫 페이지 1080 → 1600 이면 아래 두 페이지가 +520 · 위/자기 자신은 그대로", () => {
    const shifts = computePageFrameReflow({
      positions,
      direction: "vertical",
      changedPageId: "a",
      prev: { width: 1920, height: 1080 },
      next: { width: 1920, height: 1600 },
    });
    expect(shifts).toEqual([
      { pageId: "b", x: 0, y: 1680 },
      { pageId: "c", x: 0, y: 2840 },
    ]);
  });

  it("vertical: 가운데 페이지가 줄면 아래만 −Δ · 위는 무변화", () => {
    expect(
      computePageFrameReflow({
        positions,
        direction: "vertical",
        changedPageId: "b",
        prev: { width: 1920, height: 1080 },
        next: { width: 1920, height: 800 },
      }),
    ).toEqual([{ pageId: "c", x: 0, y: 2040 }]);
  });

  it("horizontal: 폭 변화는 오른쪽 페이지만 · 높이 변화는 무시", () => {
    const row = { a: { x: 0, y: 0 }, b: { x: 2000, y: 0 }, c: { x: 4000, y: 0 } };
    expect(
      computePageFrameReflow({
        positions: row,
        direction: "horizontal",
        changedPageId: "a",
        prev: { width: 1920, height: 1080 },
        next: { width: 1200, height: 1600 },
      }),
    ).toEqual([
      { pageId: "b", x: 1280, y: 0 },
      { pageId: "c", x: 3280, y: 0 },
    ]);
  });

  it("auto 격자: 아래 행은 Δheight · 같은 행 오른쪽은 Δwidth", () => {
    const grid = {
      a: { x: 0, y: 0 },
      b: { x: 2000, y: 0 },
      c: { x: 0, y: 1160 },
      d: { x: 2000, y: 1160 },
    };
    expect(
      computePageFrameReflow({
        positions: grid,
        direction: "auto",
        changedPageId: "a",
        prev: { width: 1920, height: 1080 },
        next: { width: 2020, height: 1280 },
      }),
    ).toEqual([
      { pageId: "b", x: 2100, y: 0 },
      { pageId: "c", x: 0, y: 1360 },
      { pageId: "d", x: 2000, y: 1360 },
    ]);
  });

  it("크기 무변화 · 위치 없는 페이지 → 빈 배열", () => {
    expect(
      computePageFrameReflow({
        positions,
        direction: "vertical",
        changedPageId: "a",
        prev: { width: 1920, height: 1080 },
        next: { width: 1920, height: 1080 },
      }),
    ).toEqual([]);
    expect(
      computePageFrameReflow({
        positions,
        direction: "vertical",
        changedPageId: "zzz",
        prev: { width: 1920, height: 1080 },
        next: { width: 1920, height: 2000 },
      }),
    ).toEqual([]);
  });
});

describe("ADR-231 — reflow 는 열/격자 경계를 넘지 않는다 (리뷰 round 2 h1 실행 반증)", () => {
  const withSystem = {
    "page-components": { x: -2000, y: 0 },
    home: { x: 0, y: 0 },
    p2: { x: 0, y: 1160 },
  };
  const systemPageIds = new Set(["page-components"]);

  it("Components (−2000,0) 1080→3000: 사용자 페이지 shift 없음 — vertical · auto · horizontal", () => {
    for (const direction of ["vertical", "auto", "horizontal"] as const) {
      expect(
        computePageFrameReflow({
          positions: withSystem,
          direction,
          changedPageId: "page-components",
          prev: { width: 1920, height: 1080 },
          next: { width: 1920, height: 3000 },
          systemPageIds,
        }),
      ).toEqual([]);
    }
  });

  it("시스템 페이지 2개: 첫 시스템 페이지가 커지면 아래 시스템 페이지만 세로로 (전역 방향 horizontal 이어도)", () => {
    const positions = { ...withSystem, "page-layouts": { x: -2000, y: 1160 } };
    const shifts = computePageFrameReflow({
      positions,
      direction: "horizontal",
      changedPageId: "page-components",
      prev: { width: 1920, height: 1080 },
      next: { width: 1920, height: 3000 },
      systemPageIds: new Set(["page-components", "page-layouts"]),
    });
    expect(shifts).toEqual([{ pageId: "page-layouts", x: -2000, y: 3080 }]);
  });

  it("사용자 페이지 Home 1080→2000 (vertical): P2 만 이동 · 시스템 페이지 0", () => {
    const shifts = computePageFrameReflow({
      positions: withSystem,
      direction: "vertical",
      changedPageId: "home",
      prev: { width: 1920, height: 1080 },
      next: { width: 1920, height: 2000 },
      systemPageIds,
    });
    expect(shifts).toEqual([{ pageId: "p2", x: 0, y: 2080 }]);
  });

  it("systemPageIds 없이 호출하면 종전 규칙 (호환)", () => {
    const shifts = computePageFrameReflow({
      positions: withSystem,
      direction: "vertical",
      changedPageId: "page-components",
      prev: { width: 1920, height: 1080 },
      next: { width: 1920, height: 3000 },
    });
    expect(shifts).toEqual([{ pageId: "p2", x: 0, y: 3080 }]);
  });
});

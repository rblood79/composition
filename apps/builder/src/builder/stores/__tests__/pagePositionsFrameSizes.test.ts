import { describe, expect, it } from "vitest";
import {
  calculateNextPagePosition,
  calculatePagePositions,
} from "../elements";

const pages = [{ id: "a" }, { id: "b" }, { id: "c" }];
const sizes = { a: { width: 1920, height: 1600 }, b: { width: 1200, height: 1080 } };

describe("페이지 쌓기 — 페이지별 frame 크기 (body 저작 크기) 를 따른다", () => {
  it("vertical: 누적 높이 · horizontal: 누적 폭 · 크기 없는 페이지는 breakpoint", () => {
    expect(calculatePagePositions(pages, 1920, 1080, 80, "vertical", 0, 0, sizes)).toEqual({
      a: { x: 0, y: 0 },
      b: { x: 0, y: 1680 },
      c: { x: 0, y: 2840 },
    });
    expect(calculatePagePositions(pages, 1920, 1080, 80, "horizontal", 0, 0, sizes)).toEqual({
      a: { x: 0, y: 0 },
      b: { x: 2000, y: 0 },
      c: { x: 3280, y: 0 },
    });
  });

  it("auto: 행 높이는 그 행의 최대 frame 높이", () => {
    // availableWidth 4100 → 열 2 (1920 + 80 + 1920)
    const grid = calculatePagePositions(
      [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
      1920,
      1080,
      80,
      "auto",
      4100,
      0,
      { a: { width: 1920, height: 1600 } },
    );
    expect(grid.c).toEqual({ x: 0, y: 1680 });
    expect(grid.d).toEqual({ x: 2000, y: 1680 });
  });

  it("다음 페이지 위치: vertical 은 가장 낮은 바닥 (frame 높이) + gap · horizontal 은 가장 먼 오른쪽 (frame 폭) + gap", () => {
    const positions = { a: { x: 0, y: 0 }, b: { x: 0, y: 1680 } };
    expect(
      calculateNextPagePosition(pages.slice(0, 2), positions, 1920, 1080, 80, "vertical", 0, 0, sizes),
    ).toEqual({ x: 0, y: 2840 });
    const row = { a: { x: 0, y: 0 }, b: { x: 2000, y: 0 } };
    expect(
      calculateNextPagePosition(pages.slice(0, 2), row, 1920, 1080, 80, "horizontal", 0, 0, sizes),
    ).toEqual({ x: 3280, y: 0 });
  });
});

describe("ADR-231 — 시스템 페이지 (Components) 는 사용자 격자 밖 왼쪽 세로 열", () => {
  const withComponents = [{ id: "page-components" }, { id: "home" }, { id: "p2" }, { id: "p3" }];
  const system = new Set(["page-components"]);
  const compSizes = { "page-components": { width: 1920, height: 3000 } };

  it("리뷰 h2 산술 (mobile 390 · gap 80 · availableWidth 1000 → auto 2열): Home 이 원점 · Components 는 왼쪽 · 겹침 0", () => {
    const grid = calculatePagePositions(withComponents, 390, 844, 80, "auto", 1000, 0, compSizes, system);
    expect(grid.home).toEqual({ x: 0, y: 0 });
    expect(grid.p2).toEqual({ x: 470, y: 0 });
    expect(grid.p3).toEqual({ x: 0, y: 924 });
    expect(grid["page-components"]).toEqual({ x: -2000, y: 0 });
    // 사용자 페이지 위치 = 시스템 페이지가 없을 때와 동일
    const without = calculatePagePositions(withComponents.slice(1), 390, 844, 80, "auto", 1000, 0, compSizes, system);
    expect([grid.home, grid.p2, grid.p3]).toEqual([without.home, without.p2, without.p3]);
  });

  it("세 방향 모두 사용자 페이지는 종전 · Components 는 (homeX − 2000, homeY) · auto 의 leftInset 도 따른다", () => {
    for (const direction of ["vertical", "horizontal"] as const) {
      const pos = calculatePagePositions(withComponents, 1920, 1080, 80, direction, 0, 0, compSizes, system);
      const without = calculatePagePositions(withComponents.slice(1), 1920, 1080, 80, direction, 0, 0, compSizes, system);
      expect([pos.home, pos.p2, pos.p3]).toEqual([without.home, without.p2, without.p3]);
      expect(pos["page-components"]).toEqual({ x: -2000, y: 0 });
    }
    const inset = calculatePagePositions(withComponents, 1920, 1080, 80, "auto", 6000, 120, compSizes, system);
    expect(inset.home).toEqual({ x: 120, y: 0 });
    expect(inset["page-components"]).toEqual({ x: 120 - 2000, y: 0 });
  });

  it("시스템 페이지 2개: 같은 열에 세로로 누적 (Layouts 탭 분리 · Customize 페이지가 생겨도 새 정책 0)", () => {
    const pages = [{ id: "page-components" }, { id: "page-layouts" }, { id: "home" }];
    const systemTwo = new Set(["page-components", "page-layouts"]);
    const pos = calculatePagePositions(pages, 1920, 1080, 80, "horizontal", 0, 0, { ...compSizes, "page-layouts": { width: 1920, height: 1080 } }, systemTwo);
    expect(pos.home).toEqual({ x: 0, y: 0 });
    expect(pos["page-components"]).toEqual({ x: -2000, y: 0 });
    expect(pos["page-layouts"]).toEqual({ x: -2000, y: 3080 });
  });

  it("사용자 페이지가 없으면 시스템 열은 (pageStartX − 폭 − gap, 0) 기준", () => {
    const pos = calculatePagePositions([{ id: "page-components" }], 1920, 1080, 80, "auto", 6000, 120, compSizes, system);
    expect(pos["page-components"]).toEqual({ x: 120 - 2000, y: 0 });
  });

  it("calculateNextPagePosition 은 시스템 페이지를 무시한다 (Components 가 (−2000,0) 에 있어도 새 페이지는 사용자 격자 다음 칸)", () => {
    const positions = { "page-components": { x: -2000, y: 0 }, home: { x: 0, y: 0 }, p2: { x: 0, y: 1160 } };
    const pages = [{ id: "page-components" }, { id: "home" }, { id: "p2" }];
    expect(calculateNextPagePosition(pages, positions, 1920, 1080, 80, "vertical", 0, 0, compSizes, system)).toEqual({ x: 0, y: 2320 });
    const row = { "page-components": { x: -2000, y: 0 }, home: { x: 0, y: 0 }, p2: { x: 2000, y: 0 } };
    expect(calculateNextPagePosition(pages, row, 1920, 1080, 80, "horizontal", 0, 0, compSizes, system)).toEqual({ x: 4000, y: 0 });
    // auto: 격자 원점은 사용자 페이지 (minX 0) — Components 의 −2000 이 원점이 되면 안 된다
    const grid = { "page-components": { x: -2000, y: 0 }, home: { x: 0, y: 0 }, p2: { x: 2000, y: 0 } };
    expect(calculateNextPagePosition(pages, grid, 1920, 1080, 80, "auto", 4100, 0, compSizes, system)).toEqual({ x: 0, y: 1160 });
  });
});

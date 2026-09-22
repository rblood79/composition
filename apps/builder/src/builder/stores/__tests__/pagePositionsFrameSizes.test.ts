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

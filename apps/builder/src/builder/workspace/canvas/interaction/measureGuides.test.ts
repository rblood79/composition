/**
 * Alt 거리 측정 순수 함수 유닛 — 분리 축 / 포함 4방 inset / 겹침 생략
 */

import { describe, it, expect } from "vitest";
import { resolveMeasureGuides, type MeasureRect } from "./measureGuides";

function rect(x: number, y: number, width = 100, height = 200): MeasureRect {
  return { x, y, width, height };
}

describe("resolveMeasureGuides", () => {
  it("x 분리 — 마주 보는 edge 사이 1세그먼트, 직교 겹침 중앙", () => {
    // sel x[0,100] y[0,200], target x[150,250] y[50,250] → 간격 50
    const guides = resolveMeasureGuides(rect(0, 0), rect(150, 50));
    expect(guides).toHaveLength(1);
    expect(guides[0]).toEqual({
      axis: "x",
      start: 100,
      end: 150,
      cross: 125, // y 겹침 [50,200] 중앙
      value: 50,
    });
  });

  it("x 분리 — target 이 왼쪽이면 구간 방향 유지 (start < end)", () => {
    const guides = resolveMeasureGuides(rect(300, 0), rect(0, 0));
    expect(guides).toHaveLength(1);
    expect(guides[0].start).toBe(100); // target.right
    expect(guides[0].end).toBe(300); // sel.left
    expect(guides[0].value).toBe(200);
  });

  it("양축 분리 — x·y 세그먼트 동시", () => {
    // sel [0,0,100,200], target [200,300,100,200] → x 간격 100, y 간격 100
    const guides = resolveMeasureGuides(rect(0, 0), rect(200, 300));
    expect(guides).toHaveLength(2);
    const x = guides.find((g) => g.axis === "x")!;
    const y = guides.find((g) => g.axis === "y")!;
    expect([x.start, x.end, x.value]).toEqual([100, 200, 100]);
    expect([y.start, y.end, y.value]).toEqual([200, 300, 100]);
    // 직교 겹침이 없으므로 선택 bbox 중앙에 배치
    expect(x.cross).toBe(100); // sel centerY
    expect(y.cross).toBe(50); // sel centerX
  });

  it("포함 — 선택이 대상 안: 4방 inset", () => {
    // sel [50,40,100,200] ⊂ target [0,0,390,844]
    const guides = resolveMeasureGuides(rect(50, 40), rect(0, 0, 390, 844));
    expect(guides).toHaveLength(4);
    const xs = guides.filter((g) => g.axis === "x");
    const ys = guides.filter((g) => g.axis === "y");
    expect(xs.map((g) => g.value)).toEqual([50, 240]); // left, right inset
    expect(ys.map((g) => g.value)).toEqual([40, 604]); // top, bottom inset
    // inset 세그먼트는 안쪽 박스 중앙 라인에 배치
    expect(xs[0].cross).toBe(140); // inner centerY
    expect(ys[0].cross).toBe(100); // inner centerX
  });

  it("포함 — 대상이 선택 안이어도 같은 4방 inset", () => {
    const guides = resolveMeasureGuides(rect(0, 0, 390, 844), rect(50, 40));
    expect(guides).toHaveLength(4);
    expect(guides.map((g) => g.value)).toEqual([50, 240, 40, 604]);
  });

  it("포함 — 변이 맞닿은 쪽 inset 은 생략 (0 간격)", () => {
    // sel left == target left → 왼쪽 inset 0 → 3세그먼트만
    const guides = resolveMeasureGuides(rect(0, 40), rect(0, 0, 390, 844));
    expect(guides).toHaveLength(3);
    expect(guides.map((g) => g.value)).toEqual([290, 40, 604]);
  });

  it("부분 겹침 축은 측정 없음", () => {
    // x 겹침 (sel x[0,100], target x[50,150]) + y 분리 → y 만
    const guides = resolveMeasureGuides(rect(0, 0), rect(50, 300));
    expect(guides).toHaveLength(1);
    expect(guides[0].axis).toBe("y");
  });

  it("접촉(0 간격)은 생략", () => {
    // sel right == target left
    const guides = resolveMeasureGuides(rect(0, 0), rect(100, 0));
    expect(guides).toHaveLength(0);
  });
});

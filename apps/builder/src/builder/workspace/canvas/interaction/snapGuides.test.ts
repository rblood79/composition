/**
 * ADR-179 G4 — 스냅 순수 함수 유닛 (축별 / 임계 / 최근접 / guides 구간)
 *
 * 우선순위(객체 > 그리드)와 Cmd 억제는 usePageDrag 배선 소관 — 여기서는
 * resolveSnappedPosition 의 축별 독립 판정 계약만 검증한다.
 */

import { describe, it, expect } from "vitest";
import {
  resolveSnappedPosition,
  type SnapCandidateRect,
  type SnapGuide,
  type SnapLineGuide,
  type SnapSpacingGuide,
} from "./snapGuides";

const SIZE = { width: 100, height: 200 };

function asLine(guide: SnapGuide | undefined): SnapLineGuide {
  if (guide?.kind !== "line") {
    throw new Error(`line guide 기대 — 실제: ${guide?.kind}`);
  }
  return guide;
}

function asSpacing(guide: SnapGuide | undefined): SnapSpacingGuide {
  if (guide?.kind !== "spacing") {
    throw new Error(`spacing guide 기대 — 실제: ${guide?.kind}`);
  }
  return guide;
}

function candidate(
  id: string,
  x: number,
  y: number,
  width = 100,
  height = 200,
): SnapCandidateRect {
  return { id, x, y, width, height };
}

describe("resolveSnappedPosition", () => {
  it("임계 내 left-left 흡착 — x 만 보정되고 y 는 raw 유지", () => {
    const result = resolveSnappedPosition(
      { x: 104, y: 500 },
      SIZE,
      [candidate("a", 100, 100)],
      8,
    );
    expect(result.position).toEqual({ x: 100, y: 500 });
    expect(result.snappedX).toBe(true);
    expect(result.snappedY).toBe(false);
  });

  it("임계 밖이면 raw 유지 + guides 없음", () => {
    const result = resolveSnappedPosition(
      { x: 120, y: 500 },
      SIZE,
      [candidate("a", 100, 100)],
      8,
    );
    expect(result.position).toEqual({ x: 120, y: 500 });
    expect(result.snappedX).toBe(false);
    expect(result.guides).toHaveLength(0);
  });

  it("임계 경계값(== threshold)은 흡착된다", () => {
    const result = resolveSnappedPosition(
      { x: 108, y: 500 },
      SIZE,
      [candidate("a", 100, 100)],
      8,
    );
    expect(result.position.x).toBe(100);
  });

  it("right-left 인접 배치 흡착 — 이동 박스 right 가 후보 left 에", () => {
    // 이동 박스 right = 95 + 100 = 195, 후보 left = 200 → delta 5
    const result = resolveSnappedPosition(
      { x: 95, y: 500 },
      SIZE,
      [candidate("a", 200, 500)],
      8,
    );
    expect(result.position.x).toBe(100); // right(200) - width(100)
    expect(result.snappedX).toBe(true);
  });

  it("centerX-centerX 흡착", () => {
    // 후보 center = 150, 이동 raw center = 153 → x = 153-3-50 = 100
    const result = resolveSnappedPosition(
      { x: 103, y: 500 },
      SIZE,
      [candidate("a", 100, 100)],
      8,
    );
    expect(result.position.x).toBe(100);
  });

  it("y 축 top-bottom 흡착 — 축별 독립", () => {
    // 후보 bottom = 100 + 200 = 300, 이동 top raw = 305 → y = 300
    const result = resolveSnappedPosition(
      { x: 500, y: 305 },
      SIZE,
      [candidate("a", 100, 100)],
      8,
    );
    expect(result.position).toEqual({ x: 500, y: 300 });
    expect(result.snappedY).toBe(true);
    expect(result.snappedX).toBe(false);
  });

  it("최근접 후보 채택 — 더 가까운 라인이 이긴다", () => {
    const result = resolveSnappedPosition(
      { x: 104, y: 500 },
      SIZE,
      [candidate("far", 110, 100), candidate("near", 102, 100)],
      8,
    );
    expect(result.position.x).toBe(102);
  });

  it("양축 동시 흡착 — 성립 라인 전부 방출 (같은 폭 = x 3선)", () => {
    const result = resolveSnappedPosition(
      { x: 104, y: 305 },
      SIZE,
      [candidate("a", 100, 100)],
      8,
    );
    expect(result.position).toEqual({ x: 100, y: 300 });
    expect(result.snappedX).toBe(true);
    expect(result.snappedY).toBe(true);
    // x: 같은 폭 정렬이라 left/center/right 3선, y: bottom-top 인접 1선
    const xLines = result.guides.filter(
      (g) => g.kind === "line" && g.axis === "x",
    );
    const yLines = result.guides.filter(
      (g) => g.kind === "line" && g.axis === "y",
    );
    expect(xLines.map((g) => asLine(g).position)).toEqual([100, 150, 200]);
    expect(yLines.map((g) => asLine(g).position)).toEqual([300]);
  });

  it("guide 구간 — 이동 박스(스냅 반영)와 매칭 후보의 직교 구간 합집합", () => {
    // 수직 정렬선 x=100: 후보 y [100, 300], 이동 박스 y [500, 700]
    const result = resolveSnappedPosition(
      { x: 104, y: 500 },
      SIZE,
      [candidate("a", 100, 100)],
      8,
    );
    const guide = asLine(result.guides[0]);
    expect(guide.axis).toBe("x");
    expect(guide.position).toBe(100);
    expect(guide.start).toBe(100);
    expect(guide.end).toBe(700);
  });

  it("같은 라인을 공유하는 다중 후보로 guide 구간 확장", () => {
    const result = resolveSnappedPosition(
      { x: 104, y: 500 },
      SIZE,
      [candidate("a", 100, 100), candidate("b", 100, 900)],
      8,
    );
    const guide = asLine(result.guides[0]);
    // a top=100 ~ 이동 700 ~ b bottom=1100
    expect(guide.start).toBe(100);
    expect(guide.end).toBe(1100);
  });

  it("후보 없음 — raw 그대로", () => {
    const result = resolveSnappedPosition({ x: 104, y: 500 }, SIZE, [], 8);
    expect(result.position).toEqual({ x: 104, y: 500 });
    expect(result.guides).toHaveLength(0);
  });

  it("정렬점 마커 — edge 매칭은 양쪽 코너, 이동+후보 전부 수집", () => {
    // left-left 정렬선 x=100: 이동 y[500,700] 코너 2점 + 후보 y[100,300] 코너 2점
    const result = resolveSnappedPosition(
      { x: 104, y: 500 },
      SIZE,
      [candidate("a", 100, 100)],
      8,
    );
    const guide = asLine(result.guides[0]);
    expect(guide.markers).toEqual([100, 300, 500, 700]);
  });

  it("정렬점 마커 — center 매칭은 중심 1점", () => {
    // 후보 x[300,400] center=350, 이동 폭 200 raw x=252 → center-center 만 매칭
    const result = resolveSnappedPosition(
      { x: 252, y: 500 },
      { width: 200, height: 200 },
      [candidate("a", 300, 100, 100, 200)],
      8,
    );
    expect(result.position.x).toBe(250);
    const guide = asLine(result.guides[0]);
    expect(guide.position).toBe(350);
    // 후보 중심 y=200, 이동 중심 y=600
    expect(guide.markers).toEqual([200, 600]);
  });

  it("정렬점 마커 — 근접 중복 제거 (이동 top == 후보 bottom)", () => {
    // right-left 인접: 이동 x=100 (right=200) 이 후보 left=200 에 정렬,
    // 후보 y[300,500] bottom=500 == 이동 top=500 → 마커 500 은 1개
    const result = resolveSnappedPosition(
      { x: 95, y: 500 },
      SIZE,
      [candidate("a", 200, 300)],
      8,
    );
    const guide = asLine(result.guides[0]);
    expect(guide.position).toBe(200);
    expect(guide.markers).toEqual([300, 500, 700]);
  });

  it("scene 임계 환산 — 낮은 zoom(넓은 scene 임계)에서만 흡착되는 거리", () => {
    const candidates = [candidate("a", 100, 100)];
    // 거리 12: zoom 1 (임계 8) → 미흡착, zoom 0.5 (임계 16) → 흡착
    const atZoom1 = resolveSnappedPosition(
      { x: 112, y: 500 },
      SIZE,
      candidates,
      8 / 1,
    );
    const atZoomHalf = resolveSnappedPosition(
      { x: 112, y: 500 },
      SIZE,
      candidates,
      8 / 0.5,
    );
    expect(atZoom1.snappedX).toBe(false);
    expect(atZoomHalf.snappedX).toBe(true);
    expect(atZoomHalf.position.x).toBe(100);
  });
});

describe("등간격 스냅 (Phase 4)", () => {
  it("sequence — 인접 쌍의 간격 리듬 연장 (A|B|moving)", () => {
    // A x[0,100], B x[150,250] — gap 50. target = 250 + 50 = 300
    // y=520 은 라인 스냅 밖 (거리 20), 직교 겹침은 성립 (180)
    const result = resolveSnappedPosition(
      { x: 305, y: 520 },
      SIZE,
      [candidate("a", 0, 500), candidate("b", 150, 500)],
      8,
    );
    expect(result.position).toEqual({ x: 300, y: 520 });
    expect(result.snappedX).toBe(true);
    expect(result.snappedY).toBe(false);
    expect(result.guides).toHaveLength(1);
    const guide = asSpacing(result.guides[0]);
    expect(guide.axis).toBe("x");
    expect(guide.value).toBe(50);
    expect(guide.segments).toEqual([
      { start: 100, end: 150 },
      { start: 250, end: 300 },
    ]);
    // cross = 직교 겹침 [520,700] 중앙
    expect(guide.cross).toBe(610);
  });

  it("sequence — 앞쪽 배치 (moving|A|B)", () => {
    // A x[0,100], B x[150,250] — gap 50. target = 0 - 50 - 100 = -150
    const result = resolveSnappedPosition(
      { x: -145, y: 520 },
      SIZE,
      [candidate("a", 0, 500), candidate("b", 150, 500)],
      8,
    );
    expect(result.position.x).toBe(-150);
    const guide = asSpacing(result.guides[0]);
    expect(guide.value).toBe(50);
    expect(guide.segments).toEqual([
      { start: -50, end: 0 },
      { start: 100, end: 150 },
    ]);
  });

  it("between — 두 이웃 사이 등간격 중앙", () => {
    // L x[0,100], R x[300,400] — span 200, gap (200-100)/2 = 50, target 150
    const result = resolveSnappedPosition(
      { x: 154, y: 560 },
      SIZE,
      [candidate("l", 0, 500), candidate("r", 300, 520)],
      8,
    );
    expect(result.position).toEqual({ x: 150, y: 560 });
    const guide = asSpacing(result.guides[0]);
    expect(guide.value).toBe(50);
    expect(guide.segments).toEqual([
      { start: 100, end: 150 },
      { start: 250, end: 300 },
    ]);
    // cross = [560,760] ∩ [500,700] ∩ [520,720] = [560,700] 중앙
    expect(guide.cross).toBe(630);
  });

  it("임계 밖 등간격 지점은 무시", () => {
    const result = resolveSnappedPosition(
      { x: 310, y: 520 },
      SIZE,
      [candidate("a", 0, 500), candidate("b", 150, 500)],
      8,
    );
    expect(result.snappedX).toBe(false);
    expect(result.guides).toHaveLength(0);
  });

  it("동일 축 경합 — 더 가까운 정렬선이 등간격을 이긴다", () => {
    // spacing target 300 (delta -3) vs D left=405 라인 (이동 right 403, delta +2)
    const result = resolveSnappedPosition(
      { x: 303, y: 520 },
      SIZE,
      [
        candidate("a", 0, 500),
        candidate("b", 150, 500),
        candidate("d", 405, 500),
      ],
      8,
    );
    expect(result.position.x).toBe(305);
    const guide = asLine(result.guides[0]);
    expect(guide.position).toBe(405);
  });

  it("직교 겹침 없는 후보는 등간격 문맥에서 제외", () => {
    // moving y[800,1000] vs 후보 y[500,700] — 겹침 없음
    const result = resolveSnappedPosition(
      { x: 305, y: 800 },
      SIZE,
      [candidate("a", 0, 500), candidate("b", 150, 500)],
      8,
    );
    expect(result.snappedX).toBe(false);
    expect(result.guides).toHaveLength(0);
  });

  it("쌍 사이 간격에 포함된 이웃이 있으면 인접이 아니다", () => {
    // A x[0,100], B x[300,400] gap 200 → after target 600.
    // C x[120,180] 가 간격 (100,300) 에 포함 → (A,B) 쌍 차단
    const blocked = resolveSnappedPosition(
      { x: 595, y: 520 },
      SIZE,
      [
        candidate("a", 0, 500),
        candidate("b", 300, 500),
        candidate("c", 120, 500, 60),
      ],
      8,
    );
    expect(blocked.snappedX).toBe(false);
    // 대조군: C 없으면 600 으로 흡착
    const control = resolveSnappedPosition(
      { x: 595, y: 520 },
      SIZE,
      [candidate("a", 0, 500), candidate("b", 300, 500)],
      8,
    );
    expect(control.position.x).toBe(600);
  });

  it("y 축 등간격 — x 라인 스냅과 동시 성립 (축별 독립)", () => {
    // 세로 스택: A y[0,100], B y[150,250] gap 50 → target y 300.
    // x=500 은 후보 left 와 정확히 정렬 (delta 0 라인 스냅)
    const result = resolveSnappedPosition(
      { x: 500, y: 305 },
      SIZE,
      [candidate("a", 500, 0, 100, 100), candidate("b", 500, 150, 100, 100)],
      8,
    );
    expect(result.position).toEqual({ x: 500, y: 300 });
    expect(result.snappedX).toBe(true);
    expect(result.snappedY).toBe(true);
    // x: 같은 폭 정렬 3선 + y: 등간격 1건
    expect(result.guides).toHaveLength(4);
    const lineGuide = asLine(result.guides[0]);
    expect(lineGuide.axis).toBe("x");
    const spacingGuide = asSpacing(result.guides[3]);
    expect(spacingGuide.axis).toBe("y");
    expect(spacingGuide.value).toBe(50);
    expect(spacingGuide.segments).toEqual([
      { start: 100, end: 150 },
      { start: 250, end: 300 },
    ]);
    // cross = x 겹침 [500,600] 중앙
    expect(spacingGuide.cross).toBe(550);
  });
});

/**
 * ADR-181 Phase 6 — 수동 가이드 라인 흡착.
 *
 * 가이드는 rect 가 아니라 **크기 없는 선**이라 정렬선 판정에만 들어간다.
 * 그래서 여기서 특히 보는 것은 두 가지다: (a) rect 없이도 흡착하는가,
 * (b) 등간격(spacing) 판정에 새어 들어가지 않는가.
 */
describe("resolveSnappedPosition — 수동 가이드 라인 (ADR-181)", () => {
  it("후보 rect 가 하나도 없어도 가이드에 흡착한다", () => {
    const result = resolveSnappedPosition({ x: 304, y: 500 }, SIZE, [], 8, {
      x: [300],
      y: [],
    });
    expect(result.position).toEqual({ x: 300, y: 500 });
    expect(result.snappedX).toBe(true);
    expect(result.snappedY).toBe(false);
  });

  it("이동 박스의 3축(min/center/max) 이 모두 가이드에 걸린다", () => {
    // center 흡착: center = x + 50 → x = 250 이면 center 300
    expect(
      resolveSnappedPosition({ x: 253, y: 0 }, SIZE, [], 8, { x: [300], y: [] })
        .position.x,
    ).toBe(250);
    // max 흡착: max = x + 100
    expect(
      resolveSnappedPosition({ x: 203, y: 0 }, SIZE, [], 8, { x: [300], y: [] })
        .position.x,
    ).toBe(200);
  });

  it("축이 독립이다 — y 가이드는 y 만 보정", () => {
    const result = resolveSnappedPosition({ x: 500, y: 402 }, SIZE, [], 8, {
      x: [],
      y: [400],
    });
    expect(result.position).toEqual({ x: 500, y: 400 });
    expect(result.snappedY).toBe(true);
    expect(result.snappedX).toBe(false);
  });

  it("임계 밖 가이드는 무시한다", () => {
    const result = resolveSnappedPosition({ x: 320, y: 0 }, SIZE, [], 8, {
      x: [300],
      y: [],
    });
    expect(result.position.x).toBe(320);
    expect(result.snappedX).toBe(false);
  });

  it("흡착하면 정렬선을 방출한다 — 가이드는 상시 표시라 위치만으론 흡착 여부를 모른다", () => {
    const result = resolveSnappedPosition({ x: 304, y: 500 }, SIZE, [], 8, {
      x: [300],
      y: [],
    });
    const line = asLine(result.guides[0]);
    expect(line.axis).toBe("x");
    expect(line.position).toBe(300);
  });

  it("더 가까운 rect 가 있으면 rect 가 이긴다 (거리 우선, 종류 무관)", () => {
    const result = resolveSnappedPosition(
      { x: 304, y: 500 },
      SIZE,
      [candidate("a", 305, 500)],
      8,
      { x: [300], y: [] },
    );
    expect(result.position.x).toBe(305);
  });

  it("거리가 같으면 가이드가 남는다 (사용자가 놓은 선)", () => {
    // raw.x=300: 가이드 296 과 rect 304 가 각각 거리 4
    const result = resolveSnappedPosition(
      { x: 300, y: 500 },
      SIZE,
      [candidate("a", 304, 500)],
      8,
      { x: [296], y: [] },
    );
    expect(result.position.x).toBe(296);
  });

  it("등간격 판정에는 참여하지 않는다 (rect 아님 — spacing 후보 미오염)", () => {
    // 두 이웃 사이 등간격 지점이 성립하는 배치에 가이드를 얹어도 spacing
    // 제안이 가이드 좌표로 바뀌지 않는다
    const withoutGuides = resolveSnappedPosition(
      { x: 252, y: 0 },
      SIZE,
      [candidate("a", 0, 0), candidate("b", 500, 0)],
      8,
    );
    const withGuides = resolveSnappedPosition(
      { x: 252, y: 0 },
      SIZE,
      [candidate("a", 0, 0), candidate("b", 500, 0)],
      8,
      { x: [], y: [9999] },
    );
    expect(withGuides.position).toEqual(withoutGuides.position);
    expect(withGuides.guides.map((g) => g.kind)).toEqual(
      withoutGuides.guides.map((g) => g.kind),
    );
  });

  it("가이드 인자를 생략하면 기존 동작과 동일 (BC)", () => {
    const rects = [candidate("a", 100, 100)];
    expect(resolveSnappedPosition({ x: 104, y: 500 }, SIZE, rects, 8)).toEqual(
      resolveSnappedPosition({ x: 104, y: 500 }, SIZE, rects, 8, {
        x: [],
        y: [],
      }),
    );
  });
});

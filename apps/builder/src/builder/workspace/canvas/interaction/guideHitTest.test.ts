/**
 * 가이드 히트 판정 — ADR-181 Phase 5.
 *
 * 이 함수가 기존 pointer 체인에 끼어드는 유일한 지점이라, "미스" 가 정확히
 * 미스여야 한다 (HC5 회귀 0). 그래서 임계 밖·rect 밖 케이스를 히트 케이스만큼
 * 촘촘히 본다.
 */

import { describe, expect, it } from "vitest";

import {
  GUIDE_HIT_THRESHOLD_SCREEN_PX,
  buildGuideHitTargets,
  resolveGuideHit,
  type GuideHitTarget,
} from "./guideHitTest";

const PAGE_RECT = { x: 100, y: 200, width: 390, height: 844 };

const vertical: GuideHitTarget = {
  pageId: "page-1",
  guideId: "gx",
  axis: "x",
  scenePosition: 240,
  pageRect: PAGE_RECT,
};
const horizontal: GuideHitTarget = {
  pageId: "page-1",
  guideId: "gy",
  axis: "y",
  scenePosition: 500,
  pageRect: PAGE_RECT,
};

describe("resolveGuideHit", () => {
  it("임계 안이면 잡고 밖이면 놓는다 (두께 방향)", () => {
    expect(resolveGuideHit({ x: 243, y: 400 }, [vertical], 4)).toBe(vertical);
    expect(resolveGuideHit({ x: 236, y: 400 }, [vertical], 4)).toBe(vertical);
    expect(resolveGuideHit({ x: 245, y: 400 }, [vertical], 4)).toBeNull();
  });

  it("선의 길이 방향이 페이지 밖이면 미스", () => {
    // 세로선은 페이지 y 구간 안에서만 존재한다
    expect(resolveGuideHit({ x: 240, y: 199 }, [vertical], 4)).toBeNull();
    expect(resolveGuideHit({ x: 240, y: 1045 }, [vertical], 4)).toBeNull();
    // 가로선은 x 구간
    expect(resolveGuideHit({ x: 99, y: 500 }, [horizontal], 4)).toBeNull();
    expect(resolveGuideHit({ x: 491, y: 500 }, [horizontal], 4)).toBeNull();
  });

  it("두께 방향은 rect 로 자르지 않는다 (가장자리 가이드를 잡을 수 있어야)", () => {
    const edge: GuideHitTarget = { ...vertical, scenePosition: 100 };
    // 페이지 왼쪽 경계의 가이드 — 포인트가 페이지 밖(x=98)이어도 임계 안
    expect(resolveGuideHit({ x: 98, y: 400 }, [edge], 4)).toBe(edge);
  });

  it("교차점 근처에서는 더 가까운 축을 고른다", () => {
    const targets = [vertical, horizontal];
    // 세로선까지 1, 가로선까지 3
    expect(resolveGuideHit({ x: 241, y: 497 }, targets, 4)).toBe(vertical);
    // 세로선까지 3, 가로선까지 1
    expect(resolveGuideHit({ x: 243, y: 499 }, targets, 4)).toBe(horizontal);
  });

  it("거리가 같으면 뒤에 온 것 — 목록이 그리기 순서다", () => {
    const targets = [vertical, horizontal];
    expect(resolveGuideHit({ x: 242, y: 498 }, targets, 4)).toBe(horizontal);
  });

  it("빈 목록·임계 0 은 미스", () => {
    expect(resolveGuideHit({ x: 240, y: 400 }, [], 4)).toBeNull();
    expect(resolveGuideHit({ x: 241, y: 400 }, [vertical], 0)).toBeNull();
    // 임계 0 이어도 정확히 위면 히트 (거리 0 ≤ 0)
    expect(resolveGuideHit({ x: 240, y: 400 }, [vertical], 0)).toBe(vertical);
  });

  it("임계 상수는 screen px — zoom 환산은 호출부 책임", () => {
    expect(GUIDE_HIT_THRESHOLD_SCREEN_PX).toBe(4);
  });
});

describe("buildGuideHitTargets — 렌더와 같은 좌표 변환", () => {
  it("축마다 더하는 원점이 다르다 (buildPageGuideTargets 와 동형)", () => {
    const targets = buildGuideHitTargets(
      "page-1",
      [
        { id: "a", axis: "x", position: 140 },
        { id: "b", axis: "y", position: 300 },
      ],
      { x: 100, y: 200 },
      { width: 390, height: 844 },
    );

    expect(targets.map((t) => t.scenePosition)).toEqual([240, 500]);
    expect(targets[0].pageRect).toEqual(PAGE_RECT);
    expect(targets.map((t) => t.guideId)).toEqual(["a", "b"]);
  });

  it("빈 목록은 빈 타깃", () => {
    expect(
      buildGuideHitTargets("page-1", [], { x: 0, y: 0 }, { width: 1, height: 1 }),
    ).toEqual([]);
  });
});

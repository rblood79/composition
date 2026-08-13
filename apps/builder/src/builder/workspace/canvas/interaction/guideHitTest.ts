/**
 * 수동 가이드 히트 판정 — ADR-181 Phase 5 (R1 격리)
 *
 * 캔버스 pointer 체인에 끼어드는 유일한 지점이라 **순수 함수 하나**로 가둔다.
 * 미스면 호출부는 기존 체인을 그대로 통과시킨다 (HC5 — 회귀 0).
 *
 * **판정 대상은 "포인트가 올라간 페이지" 의 가이드뿐**이다. 겹친 페이지에서
 * 아래 페이지의 가이드는 위 페이지에 가려 **보이지 않으므로**(Phase 4
 * `withPageOcclusionClip`) 히트도 되면 안 된다 — canvas-rendering.md §8.5 의
 * paint↔hit 대칭. 페이지 판정은 호출부가 `resolveTopPageIdAtPoint` 로 하고
 * 이 함수는 그 결과만 받는다. 그래서 여기에는 페이지 간 우선순위 규칙이
 * 없고, 있어서도 안 된다 (두 곳에 순서 규칙이 생기면 갈린다).
 */

import type { BoundingBox } from "../selection/types";

/** 히트 반경 (screen px — zoom 환산은 호출부, snapGuides 의 임계 어법 동형) */
export const GUIDE_HIT_THRESHOLD_SCREEN_PX = 4;

export interface GuideHitTarget {
  pageId: string;
  guideId: string;
  axis: "x" | "y";
  /** scene 좌표 (페이지 원점 + 페이지-로컬 position) */
  scenePosition: number;
  /** 소속 페이지 rect (scene) — 선이 존재하는 구간 */
  pageRect: BoundingBox;
}

/**
 * 한 페이지의 가이드 목록 → 히트 타깃 (페이지-로컬 px → scene).
 *
 * `buildPageGuideTargets`(렌더) 와 **같은 변환**이다. 그리는 좌표와 잡는
 * 좌표가 갈리면 "보이는데 안 잡히는" 비대칭이 생긴다 (§8.5). 두 곳이 같은
 * 식을 쓰는지가 이 파일의 계약이고, 렌더 쪽은 페이지 드래그 delta 까지 얹지만
 * 히트 판정은 드래그 중에 돌지 않으므로 여기서는 canonical 위치면 충분하다.
 */
export function buildGuideHitTargets(
  pageId: string,
  guides: readonly { id: string; axis: "x" | "y"; position: number }[],
  pageOrigin: { x: number; y: number },
  pageSize: { width: number; height: number },
): GuideHitTarget[] {
  const pageRect: BoundingBox = {
    x: pageOrigin.x,
    y: pageOrigin.y,
    width: pageSize.width,
    height: pageSize.height,
  };
  return guides.map((guide) => ({
    pageId,
    guideId: guide.id,
    axis: guide.axis,
    scenePosition:
      guide.axis === "x"
        ? pageOrigin.x + guide.position
        : pageOrigin.y + guide.position,
    pageRect,
  }));
}

/**
 * 포인트에 가장 가까운 가이드. 임계 밖이거나 페이지 rect 밖이면 null.
 *
 * 교차점 근처에서 세로·가로가 둘 다 걸리면 **더 가까운 쪽**을 준다. 같으면
 * 뒤에 온 것 — 목록이 그리기 순서라 나중이 위에 그려진다.
 */
export function resolveGuideHit(
  point: { x: number; y: number },
  targets: readonly GuideHitTarget[],
  thresholdScenePx: number,
): GuideHitTarget | null {
  let best: GuideHitTarget | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const target of targets) {
    const { pageRect } = target;
    // 선의 **길이 방향**은 페이지 안이어야 한다. 두께 방향은 임계가 맡으므로
    // rect 로 자르지 않는다 — 그러면 페이지 가장자리 가이드를 잡을 수 없다.
    if (target.axis === "x") {
      if (point.y < pageRect.y || point.y > pageRect.y + pageRect.height) {
        continue;
      }
    } else if (point.x < pageRect.x || point.x > pageRect.x + pageRect.width) {
      continue;
    }

    const distance = Math.abs(
      (target.axis === "x" ? point.x : point.y) - target.scenePosition,
    );
    if (distance > thresholdScenePx) continue;
    if (distance <= bestDistance) {
      bestDistance = distance;
      best = target;
    }
  }

  return best;
}

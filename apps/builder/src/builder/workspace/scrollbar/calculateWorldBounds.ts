/**
 * World Bounds 계산
 *
 * 스크롤바의 thumb 크기/위치 결정을 위한 전체 월드 범위 계산.
 * 아트보드(페이지/프레임) rect 합집합 + Visible Viewport의 합집합 + 패딩.
 *
 * @since 2026-01-30
 */

// ============================================
// Types
// ============================================

export interface WorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/** world 좌표계의 콘텐츠 사각형 (페이지/프레임 아트보드) */
export interface ContentRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================
// Main Function
// ============================================

/**
 * 전체 월드 범위 계산.
 *
 * Content(아트보드 합집합)를 기반으로 scroll 범위를 결정합니다.
 * Viewport는 content 범위를 넘을 때만 world를 확장합니다.
 *
 * **Why (2026-08-15)**: 구 구현은 content 기준을 `canvasSize` 하나로 잡았는데 그 값은
 * **페이지 1장 크기**다(`panToPage`/fit·fill/page layout 이 전부 그 의미로 쓴다). 문서
 * 전체를 덮으라고 있던 "모든 요소 bounds 합집합" 단계는 `elementRegistry` 가 비어 있어
 * no-op 이었다. 그래서 25페이지(x 0→11670) 문서에서 world 가
 * 2903 까지만 잡혀 **가로 스크롤바를 끝까지 끌어도 7페이지 너머로 못 갔다** (thumb 은 이미
 * 오른쪽 끝에 붙은 채 트랙의 66%를 차지 — 실측 2026-08-15).
 *
 * 요소 단위 합집합을 되살리지 않고 아트보드 rect 합집합으로 대체한 이유: 요소는 페이지
 * 안에 있어 커버리지 이득이 없고, 스크롤바 metric 은 자주 계산되는데 요소 전수 순회는
 * 그만큼 비싸다. 페이지/프레임 위치는 스토어에 이미 있어 O(아트보드) 다.
 *
 * @param contentRects - 아트보드 rect 목록 (world 좌표)
 * @param viewportBounds - 현재 Visible Viewport (world 좌표)
 * @param padding - 사방 패딩 (기본값: 200)
 */
export function calculateWorldBounds(
  contentRects: readonly ContentRect[],
  viewportBounds: { x: number; y: number; width: number; height: number },
  padding = 200,
): WorldBounds {
  // 1) 아트보드 rect 합집합 — content 의 기본 범위
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const rect of contentRects) {
    if (rect.width <= 0 || rect.height <= 0) continue;
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }

  // 아트보드가 하나도 없으면 원점을 content 로 본다 (부트스트랩·빈 문서)
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }

  // 2) content 기반 패딩 추가
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  // 3) viewport 가 content 를 벗어나면 world 확장 — 단 **한 화면 분량까지만**.
  //
  //    무제한 확장이면 content 밖에서 pan 할 때 world 가 같은 양만큼 커져
  //    `viewportStart / scrollableWorld` 가 1 에 고정된다 — thumb 은 트랙 끝에 붙어
  //    움직이지 않고 크기만 계속 줄어든다 (실측: 뷰포트 x 12,000→20,000 에서 thumb
  //    190→120, 위치 1514→1584). 한 화면으로 제한하면 문서 경계 직후까지는 계속
  //    추종하고, 그보다 멀리 나가면 크기가 고정된 채 끝에 머문다.
  //
  //    범위를 넘어선 위치는 소비자가 [0,1] 로 clamp 한다 (`getScrollbarAxisMetrics`).
  const overscrollX = viewportBounds.width;
  const overscrollY = viewportBounds.height;
  minX = Math.min(minX, Math.max(viewportBounds.x, minX - overscrollX));
  minY = Math.min(minY, Math.max(viewportBounds.y, minY - overscrollY));
  maxX = Math.max(
    maxX,
    Math.min(viewportBounds.x + viewportBounds.width, maxX + overscrollX),
  );
  maxY = Math.max(
    maxY,
    Math.min(viewportBounds.y + viewportBounds.height, maxY + overscrollY),
  );

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

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
 * 전체를 덮으라고 있던 "모든 요소 bounds 합집합" 단계는 `elementRegistry` 가 ADR-900
 * PixiJS 제거 이후 비어 있어 no-op 이었다. 그래서 25페이지(x 0→11670) 문서에서 world 가
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

  // 3) viewport가 content+padding을 넘으면 world 확장
  minX = Math.min(minX, viewportBounds.x);
  minY = Math.min(minY, viewportBounds.y);
  maxX = Math.max(maxX, viewportBounds.x + viewportBounds.width);
  maxY = Math.max(maxY, viewportBounds.y + viewportBounds.height);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

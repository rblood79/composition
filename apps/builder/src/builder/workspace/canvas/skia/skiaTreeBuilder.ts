/**
 * Page-position stale frame 카운터 (구 Skia Tree Builder 잔존 현역부)
 *
 * pagePositionsVersion 변경 직후 몇 프레임 동안 command stream 캐시를
 * 우회시켜 stale 좌표가 캐시에 고정되는 것을 방지한다.
 *
 * 구 tree 구축 코드(buildSkiaTreeHierarchical / getCachedTreeBoundsMap)는
 * 도달 불가로 남았다가 2026-08-14 simplify에서 제거됨. 이 카운터만이 이 파일의
 * 현역 코드다 (SkiaCanvas 렌더 루프가 매 프레임 tick).
 */

import { invalidateCommandStreamCache } from "./renderCommands";

// pagePositionsVersion 변경 후 worldTransform/레이아웃이 실제 갱신될 때까지
// 캐시를 우회하여 stale 좌표가 캐시에 고정되는 것을 방지한다.
// React 리렌더 → 컨테이너 props 갱신 → 렌더 반영까지 1~2프레임이 필요하므로
// 3프레임간 캐시를 스킵한다.
export let _pagePosStaleFrames = 0;

/**
 * pagePositionsVersion 변경 시 stale 프레임 카운터를 설정한다.
 */
export function setPagePosStaleFrames(frames: number): void {
  _pagePosStaleFrames = frames;
}

/**
 * pagePositionsVersion stale 프레임 감소 + 캐시 무효화.
 * renderFrame 루프에서 매 프레임 호출.
 * @returns true면 캐시 무효화 수행됨
 */
export function tickPagePosStaleFrames(): boolean {
  if (_pagePosStaleFrames > 0) {
    invalidateCommandStreamCache();
    _pagePosStaleFrames--;
    return true;
  }
  return false;
}

/**
 * 캔버스 프레임 뷰포트 — breakpoint 별 실제 렌더 크기 (SSOT).
 *
 * `useWorkspaceCanvasSizing` 이 `max_width`/`max_height` 를 캔버스 폭·높이로 그대로 쓴다
 * (`useWorkspaceCanvasSizing.ts:113`). 프리셋 썸네일(ADR-168 P-1)도 같은 값을 기준으로
 * px 트랙을 % 로 환산해야 썸네일 비율과 실제 렌더 비율이 일치한다 (R4 / G3).
 *
 * `BREAKPOINTS[x].minWidth` (1280 / 768 / 0) 와 혼동하지 말 것 — 그건 미디어 쿼리 경계이고
 * 이건 캔버스가 실제로 그리는 프레임 크기다. **desktop 은 1280 이 아니라 1920** 이다.
 */

import type { BreakpointName } from "@composition/shared";
import type { Breakpoint } from "./types";

export const CANVAS_BREAKPOINTS: readonly Breakpoint[] = [
  { id: "desktop", label: "Desktop", max_width: 1920, max_height: 1080 },
  { id: "tablet", label: "Tablet", max_width: 768, max_height: 1024 },
  { id: "mobile", label: "Mobile", max_width: 390, max_height: 844 },
];

export interface CanvasViewportSize {
  width: number;
  height: number;
}

/**
 * breakpoint 이름 → 캔버스 프레임 픽셀 크기.
 *
 * 위 배열에서 **파생**한다 — 같은 숫자를 두 곳에 적어두면 한쪽만 고쳐지는 자리가 생긴다.
 * `Breakpoint.id` 는 `string` 이지만 실제 값은 `BreakpointName` 3종이다.
 */
export const CANVAS_VIEWPORT: Record<BreakpointName, CanvasViewportSize> =
  Object.fromEntries(
    CANVAS_BREAKPOINTS.map((bp) => [
      bp.id,
      { width: Number(bp.max_width), height: Number(bp.max_height) },
    ]),
  ) as Record<BreakpointName, CanvasViewportSize>;

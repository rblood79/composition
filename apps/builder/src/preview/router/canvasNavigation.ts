/**
 * Canvas Navigation Utilities
 *
 * Fast Refresh 호환성을 위해 CanvasRouter.tsx에서 분리.
 * EventEngine 등 비컴포넌트 컨텍스트에서 네비게이션 트리거에 사용.
 */

import type { NavigateFunction } from "react-router";

let globalNavigate: NavigateFunction | null = null;

export function setGlobalNavigate(navigate: NavigateFunction) {
  globalNavigate = navigate;
}

export function getGlobalNavigate(): NavigateFunction | null {
  return globalNavigate;
}

/**
 * Canvas 내부에서 네비게이션 수행
 * EventEngine에서 호출됩니다.
 */
export function navigateInCanvas(
  path: string,
  options?: { replace?: boolean },
) {
  if (globalNavigate) {
    globalNavigate(path, options);
    return true;
  }

  console.warn("[CanvasRouter] Navigate function not available yet");
  return false;
}

// Legacy alias
export const navigateInPreview = navigateInCanvas;

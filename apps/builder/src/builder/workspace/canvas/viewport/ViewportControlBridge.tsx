/**
 * ViewportControlBridge
 *
 * 캔버스 컨테이너에 pan/zoom 입력을 바인딩하는 브릿지. null 을 렌더링하며
 * 순수하게 이벤트 핸들링만 담당합니다.
 *
 * 구 `app` / `cameraLabel` prop (PixiJS Application 전달)은 삭제됐다
 * (2026-08-15) — 유일한 호출부가 `app={null}` 하드코딩이었다.
 *
 * @since 2025-12-12 Phase 12 B3.2
 */

import { useViewportControl } from "./useViewportControl";
import type { CanvasGestureSession } from "../interaction/canvasGestureSession";

export interface ViewportControlBridgeProps {
  /** HTML 컨테이너 요소 (이벤트 바인딩용) */
  containerEl: HTMLElement | null;
  /** 최소 줌 */
  minZoom?: number;
  /** 최대 줌 */
  maxZoom?: number;
  // 🚀 Phase 6.1: 인터랙션 콜백 (동적 해상도 연동용)
  /** 팬/줌 인터랙션 시작 시 호출 */
  onInteractionStart?: () => void;
  /** 팬/줌 인터랙션 종료 시 호출 */
  onInteractionEnd?: () => void;
  /** 초기 Pan Offset X (비교 모드 등에서 사용) */
  initialPanOffsetX?: number;
  /** Canvas pointer session 제스처 소유권 */
  gestureSession: CanvasGestureSession;
}

/**
 * Application 내부에서 ViewportController를 연결하는 브릿지 컴포넌트
 *
 * 렌더링 출력이 없으며, 순수하게 뷰포트 컨트롤 로직만 처리합니다.
 */
export function ViewportControlBridge({
  containerEl,
  minZoom = 0.1,
  maxZoom = 5,
  // 🚀 Phase 6.1: 인터랙션 콜백
  onInteractionStart,
  onInteractionEnd,
  initialPanOffsetX,
  gestureSession,
}: ViewportControlBridgeProps): null {
  // ViewportController 연결 및 이벤트 핸들링
  useViewportControl({
    containerEl,
    minZoom,
    maxZoom,
    // 🚀 Phase 6.1: 인터랙션 콜백 전달
    onInteractionStart,
    onInteractionEnd,
    initialPanOffsetX,
    gestureSession,
  });

  // 렌더링 출력 없음
  return null;
}

export default ViewportControlBridge;

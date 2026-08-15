import { useEffect } from "react";

interface UseCanvasSurfaceLifecycleParams {
  setCanvasReady: (ready: boolean) => void;
}

/**
 * 캔버스 표면의 마운트 수명주기를 store 에 반영한다.
 *
 * **WebGL 컨텍스트 손실 감시는 여기 없다** — `SkiaCanvas` 가 자기 canvas element 에
 * 직접 걸고 store 까지 발행한다 (`watchContextLoss`). 구 구현은 여기서
 * `containerRef.current?.querySelector("canvas")` 로 찾아 걸었는데, `SkiaCanvas` 가
 * `React.lazy` + `Suspense` 라 이 effect 가 도는 시점엔 canvas 가 아직 DOM 에 없었다.
 * 재실행 신호는 구 application 초기화 콜백에만 연결되어 **상시 false** 였다 —
 * 그래서 리스너가 영영 안 붙어 `isContextLost` 가
 * 늘 false 였고 "⚠️ GPU 리소스 복구 중" 표시가 한 번도 뜨지 않았다 (2026-08-15).
 *
 * 구 `renderVersion` 동기화 파라미터도 같은 날 삭제됐다 — store 렌더 버전을
 * 별도 렌더러가 확인 응답하던 프로토콜인데 양쪽 다 0에 고정돼 있었다.
 */
export function useCanvasSurfaceLifecycle({
  setCanvasReady,
}: UseCanvasSurfaceLifecycleParams): void {
  useEffect(() => {
    setCanvasReady(true);
    return () => setCanvasReady(false);
  }, [setCanvasReady]);
}

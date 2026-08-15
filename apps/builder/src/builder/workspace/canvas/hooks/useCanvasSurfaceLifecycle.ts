import { useEffect } from "react";

interface UseCanvasSurfaceLifecycleParams {
  renderVersion: number;
  setCanvasReady: (ready: boolean) => void;
  syncPixiVersion: (version: number) => void;
}

/**
 * 캔버스 표면의 마운트 수명주기를 store 에 반영한다.
 *
 * **WebGL 컨텍스트 손실 감시는 여기 없다** — `SkiaCanvas` 가 자기 canvas element 에
 * 직접 걸고 store 까지 발행한다 (`watchContextLoss`). 구 구현은 여기서
 * `containerRef.current?.querySelector("canvas")` 로 찾아 걸었는데, `SkiaCanvas` 가
 * `React.lazy` + `Suspense` 라 이 effect 가 도는 시점엔 canvas 가 아직 DOM 에 없었다.
 * 재실행 신호는 `appReady` 하나였고 그건 PixiJS Application 초기화 콜백에서만 켜져
 * ADR-900 이후 **상시 false** — 그래서 리스너가 영영 안 붙어 `isContextLost` 가
 * 늘 false 였고 "⚠️ GPU 리소스 복구 중" 표시가 한 번도 뜨지 않았다 (2026-08-15).
 */
export function useCanvasSurfaceLifecycle({
  renderVersion,
  setCanvasReady,
  syncPixiVersion,
}: UseCanvasSurfaceLifecycleParams): void {
  useEffect(() => {
    syncPixiVersion(renderVersion);
  }, [renderVersion, syncPixiVersion]);

  useEffect(() => {
    setCanvasReady(true);
    return () => setCanvasReady(false);
  }, [setCanvasReady]);
}

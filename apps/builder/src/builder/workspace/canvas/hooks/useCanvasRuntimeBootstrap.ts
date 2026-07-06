import { useCallback, useEffect, useState } from "react";
import { useStore } from "../../../stores";
import {
  initCompositionEngineWasm,
  isCompositionEngineReady,
} from "../wasm-bindings/compositionEngineWasm";
import { isUnifiedFlag } from "../wasm-bindings/featureFlags";

/** PixiJS Application에서 필요한 최소 인터페이스 */
interface PixiApplicationLike {
  ticker: { stop(): void };
  renderer: { background: { alpha: number } };
}

interface CanvasRuntimeBootstrapResult {
  appReady: boolean;
  handlePixiAppInit: (app: PixiApplicationLike) => void;
  pixiApp: PixiApplicationLike | null;
  wasmLayoutFailed: boolean;
  wasmLayoutReady: boolean;
}

export function useCanvasRuntimeBootstrap(): CanvasRuntimeBootstrapResult {
  const [appReady, setAppReady] = useState(false);
  const [pixiApp, setPixiApp] = useState<PixiApplicationLike | null>(null);
  const [wasmLayoutReady, setWasmLayoutReady] = useState(() =>
    isCompositionEngineReady(),
  );
  const [wasmLayoutFailed, setWasmLayoutFailed] = useState(false);

  useEffect(() => {
    const handleFontsReady = () => {
      useStore.getState().invalidateLayout();
    };

    window.addEventListener("composition:fonts-ready", handleFontsReady);
    return () =>
      window.removeEventListener("composition:fonts-ready", handleFontsReady);
  }, []);

  // ADR-100: UNIFIED_ENGINE=true → PixiJS Application 없으므로 직접 WASM 초기화
  useEffect(() => {
    if (!isUnifiedFlag("UNIFIED_ENGINE")) return;
    if (wasmLayoutReady) return;

    void initCompositionEngineWasm().then(() => {
      if (isCompositionEngineReady()) {
        setWasmLayoutReady(true);
        // WASM 준비 후 layoutVersion 증가 → useLayoutPublisher 재실행 트리거
        useStore.getState().invalidateLayout();
      }
    });
  }, [wasmLayoutReady]);

  useEffect(() => {
    if (wasmLayoutReady) {
      return;
    }

    let delay = 200;
    const maxTotalWait = 15_000;
    let totalWait = 0;
    let retried = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = () => {
      if (isCompositionEngineReady()) {
        setWasmLayoutReady(true);
        return;
      }

      totalWait += delay;

      if (!retried && totalWait >= 5_000) {
        retried = true;
        if (import.meta.env.DEV) {
          console.warn("[BuilderCanvas] WASM 5초 미로드 — 재초기화 시도");
        }
        void initCompositionEngineWasm();
      }

      if (totalWait >= maxTotalWait) {
        setWasmLayoutFailed(true);
        console.error(
          `[BuilderCanvas] WASM 로드 실패 (${maxTotalWait}ms 초과)`,
        );
        return;
      }

      delay = Math.min(delay * 2, 3200);
      timeoutId = setTimeout(poll, delay);
    };

    timeoutId = setTimeout(poll, delay);
    return () => clearTimeout(timeoutId);
  }, [wasmLayoutReady]);

  const handlePixiAppInit = useCallback((app: PixiApplicationLike) => {
    setPixiApp(app);
    setAppReady(true);

    // ADR-100: REMOVE_PIXI=true → PixiJS 렌더 루프 중지 (CPU 절감)
    // React 컴포넌트 트리(ElementSprite 데이터 등록)는 유지, 렌더링만 중지
    if (isUnifiedFlag("REMOVE_PIXI")) {
      app.ticker.stop();
      app.renderer.background.alpha = 0;
    }
  }, []);

  return {
    appReady,
    handlePixiAppInit,
    pixiApp,
    wasmLayoutFailed,
    wasmLayoutReady,
  };
}

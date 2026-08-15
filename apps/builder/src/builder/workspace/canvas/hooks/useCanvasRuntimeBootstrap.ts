import { useEffect, useState } from "react";
import { useStore } from "../../../stores";
import {
  initCompositionEngineWasm,
  isCompositionEngineReady,
} from "../wasm-bindings/compositionEngineWasm";
import { isUnifiedFlag } from "../wasm-bindings/featureFlags";

interface CanvasRuntimeBootstrapResult {
  wasmLayoutFailed: boolean;
  wasmLayoutReady: boolean;
}

/**
 * 캔버스 런타임(WASM 레이아웃 엔진) 준비 상태.
 *
 * 구 반환값 `appReady` / `pixiApp` / `handlePixiAppInit` 은 삭제됐다 (2026-08-15).
 * `setAppReady(true)` 가 PixiJS Application 초기화 콜백 안에만 있었는데 ADR-900 으로
 * 그 콜백의 호출부가 사라져 `appReady` 가 **상시 false** 였고, 그 값을 유일한 재실행
 * 신호로 쓰던 WebGL 컨텍스트 손실 리스너가 영영 등록되지 않았다.
 */
export function useCanvasRuntimeBootstrap(): CanvasRuntimeBootstrapResult {
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

  return {
    wasmLayoutFailed,
    wasmLayoutReady,
  };
}

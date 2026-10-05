/**
 * ADR-244 A — dashboard 의 미리 받기 시점: 그려진 뒤 idle, 그리고 프로젝트 카드 의도 (hover · focus ·
 * press 시작). 받기 자체는 lazy chunk (`canvasWarmup.ts`) 가 하고 여기는 조건만 본다. 실패는 조용히
 * 무시한다 — builder 로더는 언제나 자기 경로로 받는다.
 */

import * as fontCache from "../builder/workspace/canvas/skia/fontCache";
import {
  builtinSkiaFonts,
  CANVASKIT_WASM_URL,
  ENGINE_WASM_URL,
} from "../canvasWarmup/canvasAssetUrls";
import { registerWarmup } from "../canvasWarmup/warmupRegistry";

/** 측정 대조군 · 수동 끄기 — localStorage 에 `off` 면 받지 않는다 (같은 빌드의 A/B). */
export const CANVAS_WARMUP_SWITCH_KEY = "composition:canvas-warmup";

let requested = false;

function allowed(): boolean {
  if (document.visibilityState !== "visible") return false;
  const connection = (navigator as { connection?: { saveData?: boolean } })
    .connection;
  if (connection?.saveData) return false;
  try {
    return localStorage.getItem(CANVAS_WARMUP_SWITCH_KEY) !== "off";
  } catch {
    return true;
  }
}

/** 미리 받기를 한 번 시작한다 (조건이 안 맞으면 다음 계기에 다시 본다). */
export function requestCanvasWarmup(): void {
  if (requested || !allowed()) return;
  requested = true;
  // chunk 가 실패하면 (재배포로 404 등) 다시 시도하지 않는다 — module map 에 실패가 남아 같은 결과다.
  void import("./canvasWarmup")
    .then((module) =>
      module.startCanvasWarmup({
        wasmUrls: [CANVASKIT_WASM_URL, ENGINE_WASM_URL].filter(
          (url): url is string => !!url,
        ),
        fonts: builtinSkiaFonts(),
        register: registerWarmup,
        fontCache,
      }),
    )
    .catch(() => {});
}

/** dashboard 가 그려진 뒤 idle 에 시작한다. 반환값은 예약 취소. */
export function scheduleIdleCanvasWarmup(): () => void {
  if (typeof requestIdleCallback === "function") {
    const handle = requestIdleCallback(requestCanvasWarmup, { timeout: 5_000 });
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(requestCanvasWarmup, 1_000);
  return () => clearTimeout(handle);
}

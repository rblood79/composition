/**
 * Feature Flags
 *
 * 환경변수 기반 Feature Flag 관리 — 타입 안전한 getter + 기본값 지원.
 *
 * @since 2025-12-11 Phase 10 B0.2
 */

/**
 * 환경변수를 boolean으로 파싱
 *
 * @param value - 환경변수 값
 * @param defaultValue - 기본값
 * @returns boolean
 */
function parseBoolean(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined || value === "") {
    return defaultValue;
  }
  return value.toLowerCase() === "true" || value === "1";
}

/**
 * WebGL Canvas 사용 여부
 *
 * @returns true if WebGL Canvas should be used
 *
 * @example
 * ```typescript
 * if (isWebGLCanvas()) {
 *   return <WebGLCanvas />;
 * } else {
 *   return <IframeCanvas />;
 * }
 * ```
 */
export function isWebGLCanvas(): boolean {
  return parseBoolean(import.meta.env.VITE_USE_WEBGL_CANVAS, true);
}

/**
 * 디버그 로그 활성화 여부
 *
 * @returns true if debug logs should be enabled
 */
export function enableDebugLogs(): boolean {
  return parseBoolean(import.meta.env.VITE_ENABLE_DEBUG_LOGS, false);
}

/**
 * 캔버스 비교 모드 활성화 여부
 *
 * iframe DOM 과 Skia 캔버스를 동시에 표시하여 교차검증
 *
 * @returns true if compare mode should be enabled
 *
 * @example
 * ```typescript
 * if (isCanvasCompareMode()) {
 *   return <SplitView left={<IframeCanvas />} right={<SkiaCanvas />} />;
 * }
 * ```
 */
export function isCanvasCompareMode(): boolean {
  return parseBoolean(import.meta.env.VITE_CANVAS_COMPARE_MODE, false);
}

/**
 * ADR-235 — `asset:` writer (이미지 업로드 · 폰트 업로드 · 인라인 dataURL 이관 · v1 가져오기
 * 자산화) 활성 여부. reader (dual-read) 는 항상 켜져 있다. G2 실패 시 이 기본값 하나로
 * writer 만 끈다 — 이미 쓴 `asset:` 은 계속 읽힌다.
 *
 * Phase 2 (G1 통과 뒤) 부터 켜짐. 끄려면 `VITE_ASSET_WRITER=false`.
 */
export function isAssetWriterEnabled(): boolean {
  return parseBoolean(import.meta.env.VITE_ASSET_WRITER, true);
}

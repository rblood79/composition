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
 * React Query Devtools 활성화 여부
 *
 * @returns true if React Query Devtools should be displayed
 *
 * @example
 * ```typescript
 * if (isReactQueryDevtoolsEnabled()) {
 *   return <ReactQueryDevtools />;
 * }
 * ```
 */
export function isReactQueryDevtoolsEnabled(): boolean {
  return parseBoolean(import.meta.env.VITE_ENABLE_REACT_QUERY_DEVTOOLS, false);
}

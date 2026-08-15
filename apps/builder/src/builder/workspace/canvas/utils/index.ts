/**
 * Canvas Utils
 *
 * Skia Canvas와 layout pipeline을 위한 유틸리티 모음
 *
 * @since 2025-12-15
 * @updated 2026-02-17 Phase 0: colorMath, boxCalculation, textMeasure 추가
 */

// Border-box 유틸리티
export * from "./borderUtils";

// CSS 변수 읽기
export * from "./cssVariableReader";

// GPU 프로파일링
export * from "./gpuProfilerCore";

// 색상 계산과 box model 순수 로직
// mixWithBlack/mixWithWhite는 cssVariableCore에서 export — 중복 제외
export {
  extractRGB,
  composeRGB,
  adjustColor,
  lerpColor,
  deriveHoverPressedColors,
} from "./colorMath";
export * from "./boxCalculation";
export {
  type TextMeasurer,
  type TextMeasureResult,
  type TextMeasureStyle,
  Canvas2DTextMeasurer,
  getTextMeasurer,
  setTextMeasurer,
} from "./textMeasure";

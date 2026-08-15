/**
 * Color Utilities
 *
 * colord 기반 색상 처리 유틸리티
 *
 * @since 2025-12-20 Phase 1 - Quick Wins
 */

export {
  // Core
  parseColor,
  isValidColor,
  formatColor,

  // Manipulation
  adjustBrightness,
  adjustSaturation,
  setAlpha,
  getComplementary,
  mixColors,

  // Contrast & Accessibility
  getContrastColor,
  getContrastRatio,
  meetsWCAG_AA,

  // Extraction
  extractRGB,
  extractHSL,

  // Canvas 색상 변환 (0xRRGGBB 숫자)
  cssColorToRgbNumber,

  // Re-exports from colord
  colord,

  // Types
  type ParsedColor,
  type ColorFormat,
  type Colord,
  type RgbaColor,
  type HslaColor,
} from "./colorUtils";

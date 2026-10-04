/**
 * Button-family height primitives
 *
 * Input / Select / SelectTrigger 가 Button 과 동일한 높이 metric 을 사용한다.
 * SSOT: ButtonSpec.sizes 에서 파생. (ADR-105-a, ADR-091 Class C 패턴)
 *
 * height = lineHeight + paddingY×2 + borderWidth×2
 * xs: 16 + 1×2 + 1×2 = 20
 * sm: 16 + 2×2 + 1×2 = 22
 * md: 20 + 4×2 + 1×2 = 30
 * lg: 24 + 8×2 + 1×2 = 42
 * xl: 28 + 12×2 + 1×2 = 54
 */
export const BUTTON_FAMILY_HEIGHTS: Record<string, number> = {
  xs: 20,
  sm: 22,
  md: 30,
  lg: 42,
  xl: 54,
} as const;

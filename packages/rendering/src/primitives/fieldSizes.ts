/**
 * Field-family size primitives
 *
 * ComboBox / Select / NumberField 가 동일한 크기 metric 을 사용한다.
 * SelectIcon.iconSize 도 이 값에서 파생된다.
 * SSOT: 세 컴포넌트의 합의된 시각 크기. (ADR-105-b)
 *
 * height = lineHeight + paddingY×2 + borderWidth×2
 * xs: 16 + 1×2 + 1×2 = 20
 * sm: 16 + 2×2 + 1×2 = 22
 * md: 20 + 4×2 + 1×2 = 30
 * lg: 24 + 8×2 + 1×2 = 42
 * xl: 28 + 12×2 + 1×2 = 54
 */
export const FIELD_FAMILY_SIZES: Record<
  string,
  { height: number; paddingX: number; paddingY: number; iconSize: number }
> = {
  xs: { height: 20, paddingX: 4, paddingY: 1, iconSize: 10 },
  sm: { height: 22, paddingX: 8, paddingY: 2, iconSize: 14 },
  md: { height: 30, paddingX: 12, paddingY: 4, iconSize: 18 },
  lg: { height: 42, paddingX: 16, paddingY: 8, iconSize: 22 },
  xl: { height: 54, paddingX: 24, paddingY: 12, iconSize: 28 },
} as const;

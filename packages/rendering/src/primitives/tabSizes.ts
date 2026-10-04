/**
 * Tab-family size primitives
 *
 * Tab.spec.ts 와 Tabs.spec.ts 가 동일한 크기 metric 을 사용한다.
 * SSOT: 두 컴포넌트의 합의된 시각 크기. (ADR-105-b)
 *
 * height 공식 (Button 과 다름 — 단면 하단 border):
 *   height = paddingY×2 + lineHeight + borderWidth×1
 *   sm: 2×2 + 16 + 1 = 21
 *   md: 4×2 + 20 + 1 = 29
 *   lg: 8×2 + 24 + 1 = 41
 *
 * xs/xl 없음 (Tab 컴포넌트는 sm/md/lg 3단계)
 */
export const TABS_SIZE_CONFIG: Record<
  string,
  { height: number; paddingX: number; paddingY: number }
> = {
  sm: { height: 21, paddingX: 8, paddingY: 2 },
  md: { height: 29, paddingX: 12, paddingY: 4 },
  lg: { height: 41, paddingX: 16, paddingY: 8 },
} as const;

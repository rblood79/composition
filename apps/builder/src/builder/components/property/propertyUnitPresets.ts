/**
 * PropertyUnitInput preset contract and shared preset scales.
 *
 * Settings와 Styles 패널이 서로의 도메인 상수를 참조하지 않고 같은 입력
 * 계약을 사용하도록 property component 계층에서 소유한다.
 */

export interface PropertyUnitPreset {
  readonly id: string;
  readonly label: string;
  readonly value: string;
}

const RESET_PRESET: PropertyUnitPreset = {
  id: "reset",
  label: "Reset",
  value: "",
};

export const PAGE_GAP_PRESETS: readonly PropertyUnitPreset[] = [
  { id: "sm", label: "S", value: "40" },
  { id: "md", label: "M", value: "80" },
  { id: "lg", label: "L", value: "120" },
];

export const SPACING_PRESET_OPTIONS: readonly PropertyUnitPreset[] = [
  RESET_PRESET,
  { id: "xs", label: "XS", value: "var(--spacing-xs)" },
  { id: "sm", label: "S", value: "var(--spacing-sm)" },
  { id: "md", label: "M", value: "var(--spacing-md)" },
  { id: "lg", label: "L", value: "var(--spacing-lg)" },
  { id: "xl", label: "XL", value: "var(--spacing-xl)" },
];

/** Border Width에는 전용 토큰이 없어 시각적 단계만 preset으로 제공한다. */
export const BORDER_WIDTH_PRESET_OPTIONS: readonly PropertyUnitPreset[] = [
  RESET_PRESET,
  { id: "xs", label: "XS", value: "1px" },
  { id: "sm", label: "S", value: "2px" },
  { id: "md", label: "M", value: "4px" },
  { id: "lg", label: "L", value: "8px" },
  { id: "xl", label: "XL", value: "12px" },
];

export const BORDER_RADIUS_PRESET_OPTIONS: readonly PropertyUnitPreset[] = [
  RESET_PRESET,
  { id: "xs", label: "XS", value: "var(--radius-xs)" },
  { id: "sm", label: "S", value: "var(--radius-sm)" },
  { id: "md", label: "M", value: "var(--radius-md)" },
  { id: "lg", label: "L", value: "var(--radius-lg)" },
  { id: "xl", label: "XL", value: "var(--radius-xl)" },
];

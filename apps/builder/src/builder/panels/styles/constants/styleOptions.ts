/**
 * styleOptions - 스타일 편집에 사용되는 옵션 목록
 */

export const FONT_FAMILIES: { value: string; label: string }[] = [
  { value: "auto", label: "auto" },
  { value: "Arial", label: "Arial" },
  { value: "Helvetica", label: "Helvetica" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Georgia", label: "Georgia" },
  { value: "Courier New", label: "Courier New" },
  { value: "Verdana", label: "Verdana" },
];

export const FONT_WEIGHTS: { value: string; label: string }[] = [
  { value: "auto", label: "auto" },
  { value: "100", label: "100 - Thin" },
  { value: "200", label: "200 - Extra Light" },
  { value: "300", label: "300 - Light" },
  { value: "400", label: "400 - Normal" },
  { value: "500", label: "500 - Medium" },
  { value: "600", label: "600 - Semi Bold" },
  { value: "700", label: "700 - Bold" },
  { value: "800", label: "800 - Extra Bold" },
  { value: "900", label: "900 - Black" },
  { value: "normal", label: "Normal" },
  { value: "bold", label: "Bold" },
];

export const BORDER_STYLES: { value: string; label: string }[] = [
  { value: "auto", label: "auto" },
  { value: "none", label: "none" },
  { value: "solid", label: "solid" },
  { value: "dashed", label: "dashed" },
  { value: "dotted", label: "dotted" },
  { value: "double", label: "double" },
  { value: "groove", label: "groove" },
  { value: "ridge", label: "ridge" },
  { value: "inset", label: "inset" },
  { value: "outset", label: "outset" },
];

export type StylePresetOption = {
  id: string;
  label: string;
  value: string;
};

export const SPACING_PRESET_OPTIONS: readonly StylePresetOption[] = [
  { id: "reset", label: "Reset", value: "" },
  { id: "xs", label: "XS", value: "var(--spacing-xs)" },
  { id: "sm", label: "S", value: "var(--spacing-sm)" },
  { id: "md", label: "M", value: "var(--spacing-md)" },
  { id: "lg", label: "L", value: "var(--spacing-lg)" },
  { id: "xl", label: "XL", value: "var(--spacing-xl)" },
];

/** Border Width에는 전용 토큰이 없어 시각적 단계만 preset으로 제공한다. */
export const BORDER_WIDTH_PRESET_OPTIONS: readonly StylePresetOption[] = [
  { id: "reset", label: "Reset", value: "" },
  { id: "xs", label: "XS", value: "1px" },
  { id: "sm", label: "S", value: "2px" },
  { id: "md", label: "M", value: "4px" },
  { id: "lg", label: "L", value: "8px" },
  { id: "xl", label: "XL", value: "12px" },
];

export const BORDER_RADIUS_PRESET_OPTIONS: readonly StylePresetOption[] = [
  { id: "reset", label: "Reset", value: "" },
  { id: "xs", label: "XS", value: "var(--radius-xs)" },
  { id: "sm", label: "S", value: "var(--radius-sm)" },
  { id: "md", label: "M", value: "var(--radius-md)" },
  { id: "lg", label: "L", value: "var(--radius-lg)" },
  { id: "xl", label: "XL", value: "var(--radius-xl)" },
];

export const BLEND_MODE_OPTIONS: { value: string; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
  { value: "darken", label: "Darken" },
  { value: "lighten", label: "Lighten" },
  { value: "color-dodge", label: "Color Dodge" },
  { value: "color-burn", label: "Color Burn" },
  { value: "hard-light", label: "Hard Light" },
  { value: "soft-light", label: "Soft Light" },
  { value: "difference", label: "Difference" },
  { value: "exclusion", label: "Exclusion" },
];

export const UNIT_OPTIONS = {
  size: ["px", "%", "vh", "vw", "auto"],
  spacing: ["auto", "px"],
  border: ["auto", "px"],
  font: ["auto", "px", "pt"],
  lineHeight: ["auto", "px", ""],
} as const;

// Layout options for ModifiedStylesSection
export const DISPLAY_OPTIONS: { value: string; label: string }[] = [
  { value: "block", label: "block" },
  { value: "flex", label: "flex" },
  { value: "inline", label: "inline" },
  { value: "inline-block", label: "inline-block" },
  { value: "inline-flex", label: "inline-flex" },
  { value: "grid", label: "grid" },
  { value: "none", label: "none" },
];

export const FLEX_DIRECTION_OPTIONS: { value: string; label: string }[] = [
  { value: "row", label: "row" },
  { value: "column", label: "column" },
  { value: "row-reverse", label: "row-reverse" },
  { value: "column-reverse", label: "column-reverse" },
];

export const ALIGN_ITEMS_OPTIONS: { value: string; label: string }[] = [
  { value: "flex-start", label: "flex-start" },
  { value: "center", label: "center" },
  { value: "flex-end", label: "flex-end" },
  { value: "stretch", label: "stretch" },
  { value: "baseline", label: "baseline" },
];

export const JUSTIFY_CONTENT_OPTIONS: { value: string; label: string }[] = [
  { value: "flex-start", label: "flex-start" },
  { value: "center", label: "center" },
  { value: "flex-end", label: "flex-end" },
  { value: "space-between", label: "space-between" },
  { value: "space-around", label: "space-around" },
  { value: "space-evenly", label: "space-evenly" },
];

export const FLEX_WRAP_OPTIONS: { value: string; label: string }[] = [
  { value: "nowrap", label: "nowrap" },
  { value: "wrap", label: "wrap" },
  { value: "wrap-reverse", label: "wrap-reverse" },
];

export const OVERFLOW_OPTIONS: { value: string; label: string }[] = [
  // "reset" 은 PropertySelect 가 onChange("") 로 변환 → inline overflow 키 삭제.
  //   "auto" 는 실제 CSS overflow 값(필요 시 스크롤)이라 reset 센티널로 겸용 불가 → 별도 항목.
  { value: "reset", label: "Reset" },
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
  { value: "scroll", label: "Scroll" },
  { value: "auto", label: "Auto" },
  { value: "clip", label: "Clip" },
];

// TODO: rem, em 단위는 차후 지원 예정

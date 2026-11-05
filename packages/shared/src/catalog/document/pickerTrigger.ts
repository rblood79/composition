import { resolveToken, type TokenRef } from "@composition/rendering";

/** S2 Picker의 상태 색상. 값은 rendering color tokens의 light/dark가 소유한다. */
export const PICKER_BACKGROUND = {
  default: "{color.picker-background}",
  isHovered: "{color.picker-background-hover}",
  isFocusVisible: "{color.picker-background-hover}",
  isPressed: "{color.picker-background-hover}",
  isExpanded: "{color.picker-background-hover}",
  isDisabled: "{color.picker-background}",
  isQuiet: "{color.transparent}",
} as const;
export const PICKER_CONTENT = {
  default: "{color.picker-content}",
  isHovered: "{color.picker-content-hover}",
  isFocusVisible: "{color.picker-content-hover}",
  isPressed: "{color.picker-content-hover}",
  isDisabled: "{color.picker-content-disabled}",
} as const;
export const PICKER_INVALID_WIDTH = 2;
export const PICKER_INVALID_ICON = "triangle-alert";
export function pickerInvalidGlyph(size: unknown) {
  const key = ["XS", "S", "M", "L", "XL"].includes(String(size))
    ? String(size)
    : "M";
  const sizeToken = `{size.icon.${key}}` as TokenRef;
  const px = Number(resolveToken(sizeToken));
  const gap = Number(resolveToken("{spacing.xs}"));
  return { size: px, inset: px + gap, sizeToken };
}

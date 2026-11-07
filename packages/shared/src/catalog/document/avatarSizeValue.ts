/** S2 1.8.2 Avatar sizes, with the existing named sizes retained for saved documents. */
export const AVATAR_SIZE_PRESETS = [
  16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 80, 96, 112,
] as const;
export const AVATAR_GROUP_SIZES = [16, 20, 24, 28, 32, 36, 40] as const;
export const LEGACY_AVATAR_SIZES = {
  XS: 24,
  S: 28,
  M: 32,
  L: 40,
  XL: 48,
} as const;
export type AvatarSize =
  number | `${number}lh` | keyof typeof LEGACY_AVATAR_SIZES;
export type AvatarGroupSize =
  (typeof AVATAR_GROUP_SIZES)[number] | keyof typeof LEGACY_AVATAR_SIZES;

export function catalogAvatarSizeFits(value: unknown): value is AvatarSize {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0;
  if (typeof value !== "string") return false;
  if (Object.hasOwn(LEGACY_AVATAR_SIZES, value)) return true;
  return (
    /^(?:\d+(?:\.\d+)?|\.\d+)lh$/.test(value) &&
    Number.isFinite(Number.parseFloat(value)) &&
    Number.parseFloat(value) >= 0
  );
}

export function catalogAvatarGroupSizeFits(
  value: unknown,
): value is AvatarGroupSize {
  return typeof value === "number"
    ? (AVATAR_GROUP_SIZES as readonly number[]).includes(value)
    : typeof value === "string" && Object.hasOwn(LEGACY_AVATAR_SIZES, value);
}

export function catalogAvatarCssSize(value: unknown): string {
  if (typeof value === "string" && Object.hasOwn(LEGACY_AVATAR_SIZES, value))
    return `${LEGACY_AVATAR_SIZES[value as keyof typeof LEGACY_AVATAR_SIZES]}px`;
  if (typeof value === "string" && catalogAvatarSizeFits(value)) return value;
  return `${(typeof value === "number" && catalogAvatarSizeFits(value) ? value : 24) / 16}rem`;
}

/** CSS attribute keys are strings, while numeric size props retain their scalar type. */
export function catalogSizeRuleValue(
  type: string,
  prop: string,
  value: string,
): string | number {
  return (type === "Avatar" || type === "AvatarGroup") &&
    prop === "size" &&
    /^\d+$/.test(value)
    ? Number(value)
    : value;
}

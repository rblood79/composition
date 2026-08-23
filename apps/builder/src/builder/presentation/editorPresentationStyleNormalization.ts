const GAP_LONGHANDS = ["rowGap", "columnGap"] as const;
const PADDING_LONGHANDS = [
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
] as const;

type StyleRecord = Readonly<Record<string, unknown>>;

function expandShorthand(
  value: unknown,
  count: 2 | 4,
): readonly unknown[] | null {
  if (typeof value === "number")
    return Array.from({ length: count }, () => value);
  if (typeof value !== "string") return null;
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > count) return null;
  if (count === 2) {
    if (tokens.length === 1) return [tokens[0], tokens[0]];
    if (tokens.length === 2) return tokens;
    return null;
  }
  if (tokens.length === 1) return Array.from({ length: 4 }, () => tokens[0]);
  if (tokens.length === 2) return [tokens[0], tokens[1], tokens[0], tokens[1]];
  if (tokens.length === 3) return [tokens[0], tokens[1], tokens[2], tokens[1]];
  return tokens;
}

function normalizeSpacingGroup(
  input: StyleRecord,
  output: Record<string, unknown>,
  shorthand: string,
  longhands: readonly string[],
  count: 2 | 4,
): void {
  if (!Object.prototype.hasOwnProperty.call(input, shorthand)) return;
  const shorthandValue = input[shorthand];
  const expanded = expandShorthand(shorthandValue, count);
  if (expanded) {
    longhands.forEach((key, index) => {
      if (output[key] === undefined) output[key] = expanded[index];
    });
    delete output[shorthand];
    return;
  }

  // A malformed/unsupported shorthand must never coexist with explicit
  // longhands. Preserve the explicit canonical values and leave a shorthand
  // alone only when it is the sole representation.
  if (longhands.some((key) => output[key] !== undefined)) {
    delete output[shorthand];
  }
}

/**
 * Normalize a complete style record to the Builder spacing SSOT.
 *
 * `gap` becomes `rowGap`/`columnGap`, and `padding` becomes the four
 * longhands. Existing explicit longhands win over shorthand expansion. The
 * input object is never mutated.
 */
export function normalizePresentationSpacingStyle(
  style: StyleRecord,
): Record<string, unknown> {
  const output = { ...style };
  normalizeSpacingGroup(output, output, "gap", GAP_LONGHANDS, 2);
  normalizeSpacingGroup(output, output, "padding", PADDING_LONGHANDS, 4);
  return output;
}

/**
 * Normalize a presentation patch without applying it to a base style.
 *
 * A patch containing both shorthand and longhand uses explicit longhand
 * precedence and emits longhands only, so every consumer sees one shape.
 */
export function normalizePresentationSpacingPatch(
  patch: StyleRecord,
): Record<string, unknown> {
  return normalizePresentationSpacingStyle(patch);
}

export function hasPresentationSpacingPatch(patch: StyleRecord): boolean {
  return ["gap", ...GAP_LONGHANDS, "padding", ...PADDING_LONGHANDS].some(
    (key) => Object.prototype.hasOwnProperty.call(patch, key),
  );
}

export const presentationGapLonghands = GAP_LONGHANDS;
export const presentationPaddingLonghands = PADDING_LONGHANDS;

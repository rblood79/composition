/**
 * ADR-187 Phase 5: the only text metric currently eligible for a continuous
 * presentation overlay.
 *
 * The parser deliberately accepts only a finite positive pixel value. Relative
 * units and intrinsic values need a fresh paragraph/layout measurement and
 * therefore remain on the canonical commit lane.
 */
export function parsePresentationFontSize(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value !== "string") return null;
  const match = /^\s*(\d+(?:\.\d+)?)px\s*$/.exec(value);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parsePresentationFontWeight(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\s*\d{3}\s*$/.test(value)
        ? Number(value)
        : null;
  return parsed !== null &&
    Number.isInteger(parsed) &&
    parsed >= 100 &&
    parsed <= 900
    ? parsed
    : null;
}

export function isFixedTextMetricStyle(
  style: Readonly<Record<string, unknown>>,
): boolean {
  return (
    style.position === "absolute" &&
    parseFixedPixelValue(style.width) !== null &&
    parseFixedPixelValue(style.height) !== null &&
    parsePresentationFontSize(style.fontSize) !== null
  );
}

function parseFixedPixelValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value !== "string") return null;
  const match = /^\s*(\d+(?:\.\d+)?)px\s*$/.exec(value);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

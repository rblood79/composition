import { RATING_STAR_COUNT } from "../rule/rating";

/**
 * ADR-321 Decision 8 — a Rating's effective value (the one number the stars · the form value · the
 * named state · the announced value use). Input mode: clamped to 0 ~ the star count and rounded to a
 * whole star (as RAC Slider snaps to its step — 2.5 → 3 · 6 → 5 · −1 → 0). Display only
 * (`isReadOnly`): clamped and rounded to a half star (2.3 → 2.5). Anything not a number is 0.
 */
export function catalogRatingValue(raw: unknown, readOnly: boolean): number {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim() !== ""
        ? Number(raw)
        : Number.NaN;
  if (!Number.isFinite(n)) return 0;
  const clamped = Math.min(RATING_STAR_COUNT, Math.max(0, n));
  return readOnly ? Math.round(clamped * 2) / 2 : Math.round(clamped);
}

/** The start value the Canvas draws (Decision 10): `value`, else `defaultValue`. */
export const catalogRatingStart = (props: Readonly<Record<string, unknown>>) =>
  catalogRatingValue(
    props.value ?? props.defaultValue,
    props.isReadOnly === true,
  );

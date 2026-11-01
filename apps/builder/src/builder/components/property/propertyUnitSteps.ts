/**
 * ADR-298 D6 — the step ladder a token field's pointer edits walk: the Canvas spacing handle snaps
 * to its nearest step, the input's scrub moves one step per stride. One ladder per field — the
 * field's token presets (the menu's steps) by their **active** px (`getPresetDisplayValue` — the
 * theme snapshot, ADR-295 Decision 5), plus `0` when no token is 0. Steps past the ladder (2xs ·
 * 2xl …) are reached by typing (the number escape) or the free modifier, never by the ladder.
 */
import type { PropertyUnitPreset } from "./propertyUnitPresets";
import {
  getPresetDisplayValue,
  isTokenValue,
} from "./PropertyUnitInput.runtime";

export interface PropertyUnitStep {
  /** What the field commits: the token's variable, or `0px`. */
  readonly value: string;
  readonly px: number;
  /** The preset the step is (its chip label) — absent for the `0` step. */
  readonly preset?: PropertyUnitPreset;
}

export function propertyUnitSteps(
  presets: readonly PropertyUnitPreset[] | undefined,
): readonly PropertyUnitStep[] {
  const steps: PropertyUnitStep[] = [];
  for (const preset of presets ?? []) {
    const value = preset.value.trim();
    if (!isTokenValue(value)) continue;
    const px = Number(getPresetDisplayValue(value));
    if (!Number.isFinite(px) || steps.some((step) => step.px === px)) continue;
    steps.push({ value, px, preset });
  }
  if (!steps.length) return steps;
  if (!steps.some((step) => step.px === 0)) steps.push({ value: "0px", px: 0 });
  return steps.sort((a, b) => a.px - b.px);
}

/** The step nearest `px` (a tie takes the smaller; past either end, that end). */
export function nearestPropertyUnitStep(
  steps: readonly PropertyUnitStep[],
  px: number,
): PropertyUnitStep | undefined {
  let best: PropertyUnitStep | undefined;
  for (const step of steps)
    if (!best || Math.abs(step.px - px) < Math.abs(best.px - px)) best = step;
  return best;
}

/**
 * The step `count` steps from `from` (a negative count goes down). `from` off the ladder (an old
 * literal — 10) counts from the steps around it: up from 10 is 12, down from 10 is 8. Clamped to
 * the ladder's ends.
 */
export function propertyUnitStepFrom(
  steps: readonly PropertyUnitStep[],
  from: number,
  count: number,
): PropertyUnitStep | undefined {
  if (!steps.length) return undefined;
  if (count === 0) return nearestPropertyUnitStep(steps, from);
  const exact = steps.findIndex((step) => step.px === from);
  let index: number;
  if (exact >= 0) index = exact + count;
  else if (count > 0) {
    const above = steps.findIndex((step) => step.px > from);
    index = (above < 0 ? steps.length : above) + count - 1;
  } else {
    let below = -1;
    steps.forEach((step, i) => {
      if (step.px < from) below = i;
    });
    index = below + count + 1;
  }
  return steps[Math.max(0, Math.min(steps.length - 1, index))];
}

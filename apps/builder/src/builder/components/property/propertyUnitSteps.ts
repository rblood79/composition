/**
 * ADR-298 D6 — Canvas 간격 핸들과 입력 필드가 공유하는 단계표.
 * 메뉴의 토큰을 활성 테마의 px 값으로 정렬하고 0이 없으면 추가한다.
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

/** 아이콘 드래그 3px마다 값 1. 프리셋에 닿으면 한 칸 더 머물고 다음 정수로 진행한다. */
export function scrubWithPresetSnap(
  steps: readonly PropertyUnitStep[],
  start: number,
  original: string,
  travel: number,
  min: number,
  max: number,
): string {
  const ticks = Math.trunc(travel / 3);
  if (ticks === 0) return original;
  const direction = Math.sign(ticks);
  let target = (direction > 0 ? Math.floor(start) : Math.ceil(start)) + ticks;

  // 시작점에서 진행 방향으로 만난 프리셋만 훑는다. 포인터 이벤트 빈도와 무관하다.
  for (
    let i = direction > 0 ? 0 : steps.length - 1;
    i >= 0 && i < steps.length;
    i += direction
  ) {
    const step = steps[i]!;
    if ((step.px - start) * direction <= 0) continue;
    const past = (target - step.px) * direction;
    if (past < 0) break;
    if (step.px < min || step.px > max) continue;
    if (past < 2 || step.px === (direction > 0 ? max : min)) return step.value;
    // 정수 프리셋은 기존 정수 한 칸을 대체한다. 소수 프리셋은 두 칸 모두 추가한다.
    target -= direction * (Number.isInteger(step.px) ? 1 : 2);
  }
  const value = Math.max(min, Math.min(max, target));
  return value === start ? original : `${value}px`;
}

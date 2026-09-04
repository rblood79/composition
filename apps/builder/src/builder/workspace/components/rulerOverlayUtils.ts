/** 눈금자 DOM 식별자 — pointer 가드가 소속을 판정할 때 사용한다. */
export const RULER_OVERLAY_ATTR = "data-ruler-overlay";

export function isRulerEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(`[${RULER_OVERLAY_ATTR}]`) !== null;
}

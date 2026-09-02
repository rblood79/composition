/**
 * ADR-923 Phase 4 — `resolveDefaultDisplay(type)`: 요소의 **기본 display** 를 catalog 에서 파생한다.
 *
 * 원천 순서 (production 과 같은 단일 precedence 소유자 `resolveContainerStylesFallback` 을 그대로
 * 쓴다 — top-level `rule.containerStyles` 는 대체, 없으면 catalog 4층 merge, 잔존 spec 3종
 * Frame/Group/Slot 은 spec `containerStyles`):
 *   1. catalog / spec 파생 `display`
 *   2. 파생 원천이 없는 항목의 손 목록 (`INLINE_BLOCK_TAG_CLASSIFICATION` 의 `hand.handDisplay`) —
 *      **현재 동작 값** (전부 `inline-block`). DOM 정합 후보 (`domDisplay`) 는 여기서 읽지 않는다 —
 *      Phase 5 배선이 hand 항목의 동작을 바꾸지 않도록 (round 29 r29m2). 후보 전환은 Phase 5 Q4 분류.
 *   3. `block` (CSS 초기값과 같은 canvas 기본)
 *
 * **Phase 4 에서는 어디에도 배선되지 않는다.** `getElementDisplay` (taffyDisplayAdapter) 는 Phase 5
 * cutover 까지 `INLINE_BLOCK_TAGS → inline-block` 을 유지한다 — 지금 배선하면 catalog `flex` 가 부모
 * 판정으로 새어 `classifyChildDisplay` 가 block 으로 분류 → IFC 시뮬레이션 해제 → Button 세로 적층
 * (reviews/923 r2 m2). 별도 모듈인 이유: `utils.ts` ← `implicitStyles.ts` 의존 방향 때문에 utils 안에
 * 두면 순환 import 가 된다 (breakdown §4 파일표의 "utils.ts" 는 이 모듈로 대체).
 */
import { resolveContainerStylesFallback } from "./implicitStyles";
import { INLINE_BLOCK_TAG_CLASSIFICATION } from "./utils";

export const CANVAS_DEFAULT_DISPLAY = "block";

export function resolveDefaultDisplay(type: string | undefined): string {
  const lower = (type ?? "").toLowerCase();
  if (lower.length === 0) return CANVAS_DEFAULT_DISPLAY;
  const derived = resolveContainerStylesFallback(lower, {}).display;
  if (typeof derived === "string" && derived.trim().length > 0) {
    return derived.trim().toLowerCase();
  }
  const hand = INLINE_BLOCK_TAG_CLASSIFICATION[lower];
  if (hand?.display === "hand" && hand.handDisplay) return hand.handDisplay;
  return CANVAS_DEFAULT_DISPLAY;
}

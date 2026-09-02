/**
 * ADR-923 Phase 4 — `resolveDefaultDisplay(type)`: 요소의 **기본 display** 를 catalog 에서 파생한다.
 *
 * 원천 순서 (production 과 같은 단일 precedence 소유자 `resolveContainerStylesFallback` 을 그대로
 * 쓴다 — top-level `rule.containerStyles` 는 대체, 없으면 catalog 4층 merge, 잔존 spec 3종
 * Frame/Group/Slot 은 spec `containerStyles`):
 *   1. catalog / spec 파생 `display`
 *   2. 파생 원천이 없는 항목의 손 목록 (`INLINE_BLOCK_TAG_CLASSIFICATION` 의 `hand.handDisplay`) —
 *      submitbutton · fancybutton · type · chip · linkbutton · dateinput 은 `inline-block`,
 *      calendargrid 는 `block` (Phase 5 — CalendarGrid Q4 근거, Codex round 30 판정). DOM 정합 후보
 *      (`domDisplay`) 는 읽지 않는다 — 후보는 근거가 붙은 뒤 `handDisplay` 로 옮긴다.
 *   3. `block` (CSS 초기값과 같은 canvas 기본)
 *
 * **Phase 5 (2026-09-02) 부터 `getElementDisplay` (displayAdapter) 가 이 함수를 쓴다** —
 * 종전 `INLINE_BLOCK_TAGS → inline-block` 목록은 삭제됐다. 배선과 함께 TS IFC 시뮬레이션이 제거돼
 * catalog `inline-flex` 가 부모 판정으로 흘러도 IFC 를 켜거나 끄는 분기가 없다 (엔진 display.rs 가
 * outer 를 해석). 별도 모듈인 이유: `utils.ts` ← `implicitStyles.ts` 의존 방향 때문에 utils 안에 두면
 * 순환 import 가 된다.
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

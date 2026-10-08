/**
 * `selectionStyle`(RSP) ↔ `selectionBehavior`(RAC) 변환 단일 소스 (2026-08-21).
 *
 * 같은 축을 두 이름이 부른다:
 * - **RSP** `selectionStyle`: `"checkbox"`(행에 선택 체크박스) | `"highlight"`(배경 강조만)
 * - **RAC** `selectionBehavior`: `"toggle"` | `"replace"`
 *
 * D2 표면(패널·binding accepts)은 RSP 이름을 쓰고, D1 구현(RAC)에 넘길 때만 변환한다.
 * 변환을 컴포넌트와 렌더러가 각자 하면 기본값이 갈린다 — 실제로 그랬다: Tree 렌더러는
 * `selectionBehavior` 기본을 `"replace"` 로, GridList 렌더러는 `"toggle"` 로 넘기고 있어서
 * 같은 `selectionStyle="checkbox"` 가 한쪽에서만 체크박스를 냈다. 그래서 fallback 을
 * **인자로 받는** 단일 함수로 모은다.
 *
 * 우선순위: `selectionStyle` 명시 > 호출자가 준 `selectionBehavior` > 컴포넌트별 fallback.
 * (`selectionBehavior` 는 accepts 에 없지만 기존 문서의 props 에 남아 있을 수 있어 존중한다.)
 */

export type SelectionStyle = "checkbox" | "highlight";
export type SelectionBehavior = "toggle" | "replace";

export function resolveSelectionBehavior(input: {
  selectionStyle?: unknown;
  selectionBehavior?: unknown;
  /** 해당 컴포넌트가 selectionStyle 도입 전에 쓰던 값 — 무지정 시 동작 보존용. */
  fallback: SelectionBehavior;
}): SelectionBehavior {
  if (input.selectionStyle === "highlight") return "replace";
  if (input.selectionStyle === "checkbox") return "toggle";
  if (
    input.selectionBehavior === "toggle" ||
    input.selectionBehavior === "replace"
  ) {
    return input.selectionBehavior;
  }
  return input.fallback;
}

/** 역변환 — 패널 표시/디버깅용. */
export function toSelectionStyle(behavior: SelectionBehavior): SelectionStyle {
  return behavior === "replace" ? "highlight" : "checkbox";
}

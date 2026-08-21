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

/**
 * 컬렉션 항목에 선택 체크박스가 서는가 — Skia 가 `_showSelectionCheckbox` 로 주입하는 신호의
 * 판정식 (2026-08-22).
 *
 * 판정은 두 축의 AND 다: `selectionBehavior === "toggle"` (highlight 면 체크박스가 없다) 이고,
 * `selectionMode` 가 그 컬렉션이 체크박스를 그리는 모드일 것.
 *
 * **모드 조건은 컬렉션마다 다르다** — 그리고 이건 통일할 대상이 아니라 D1(RAC) 이 정한 것을
 * 따라야 하는 값이다. 각 컴포넌트가 RAC starter 원본의 게이트를 그대로 쓰고 있다:
 * - `Tree.tsx`: `selectionBehavior === "toggle" && selectionMode !== "none"` → single 포함
 * - `GridList.tsx`: `selectionMode === "multiple" && selectionBehavior === "toggle"` → single 제외
 *
 * 그래서 `checkboxModes` 를 인자로 받는다. 한쪽 규칙을 양쪽에 쓰면 그 차이만큼 Skia 가 DOM 에
 * 없는 체크박스를 그린다 — GridList 카드에서는 그게 **카드 높이 +22** 로 번진다 (2026-08-22
 * 라이브에서 `selectionMode: "single"` 로 실제 발생, 같은 날 수정).
 *
 * `defaultSelectionMode` 도 컬렉션마다 다르다 (renderTree "single" / renderGridList "none").
 */
export function resolveSelectionCheckboxVisible(input: {
  selectionMode?: unknown;
  selectionStyle?: unknown;
  selectionBehavior?: unknown;
  /** 해당 컬렉션 렌더러가 `selectionMode` 미지정 시 넘기는 값. */
  defaultSelectionMode: "none" | "single" | "multiple";
  /** 체크박스를 그리는 selectionMode — 그 컴포넌트의 DOM 게이트와 같은 집합이어야 한다. */
  checkboxModes: ReadonlyArray<"single" | "multiple">;
  fallback: SelectionBehavior;
}): boolean {
  const mode =
    typeof input.selectionMode === "string"
      ? input.selectionMode
      : input.defaultSelectionMode;
  if (mode !== "single" && mode !== "multiple") return false;
  if (!input.checkboxModes.includes(mode)) return false;
  return (
    resolveSelectionBehavior({
      selectionStyle: input.selectionStyle,
      selectionBehavior: input.selectionBehavior,
      fallback: input.fallback,
    }) === "toggle"
  );
}

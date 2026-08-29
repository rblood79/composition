/**
 * 스토어 mutation 반영 확인 (2026-08-29).
 *
 * `updateElementProps` / `removeElement` 는 **반환값이 없고** 조용히 `return` 하는 경로가
 * 여럿이다 — render projection id · 대상 요소 없음 · 빈 patch · 변경 없음 · origin 편집
 * 영향 confirm 거부. 도구가 이를 구분하지 않으면 아무것도 바뀌지 않은 요청이 "수정함" 으로
 * 보고되고, 모델은 반영됐다는 전제로 다음 단계를 쌓는다. 사용자에게는 "AI 는 했다는데
 * 화면은 그대로" 로 보인다.
 *
 * `bind_collection` 은 이미 `applyCanonicalExtensionPatch` 의 반환값을 확인한다 —
 * 같은 계약을 반환값 없는 액션에도 세운다: **쓰고 나서 다시 읽어 대조**.
 */

/** props 값 비교 — 원시값은 동일성, 객체/배열은 직렬화 대조. */
export function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (
    a === null ||
    b === null ||
    typeof a !== "object" ||
    typeof b !== "object"
  ) {
    return false;
  }
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * 요청한 props 중 반영되지 않은 키.
 *
 * `style` 은 제외한다 — 스토어가 fill 파생 키를 `sanitizeFillDerivedStylePatch` 로
 * 걸러내므로, 정상 반영된 style patch 도 보낸 값과 달라진다. 그대로 대조하면 성공을
 * 실패로 보고한다. style-only patch 는 그래서 확인 범위 밖이다 (거짓 실패보다 미검출이 낫다).
 */
export function findUnappliedProps(
  applied: Record<string, unknown> | undefined,
  requested: Record<string, unknown>,
): string[] {
  return Object.keys(requested).filter(
    (key) => key !== "style" && !valuesEqual(applied?.[key], requested[key]),
  );
}

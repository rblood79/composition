/**
 * 편집기 도메인 술어 (ADR-236 Phase 1) — "이 노드가 무엇인가" 를 한 곳에서 판정한다.
 *
 * 같은 판정을 파일마다 다시 쓰면 대소문자 · AND/OR 처리가 갈린다 (Phase 0 인벤토리: body 비교
 * 92행 · 로컬 헬퍼 12). 새 판정은 여기에 두고 호출처는 이 함수를 부른다 —
 * `domainPredicateRatchet.static.test.ts` 가 직접 비교의 재도입을 막는다.
 */

/**
 * page body 판정. canonical body 는 소문자 `"body"` 지만 export 런타임 모델의 기본 body 노드는
 * `"Body"` 로 만들어진다 (`utils/export.utils.ts` `makeDefaultPageBodyNode`) — 대소문자를 무시한다.
 */
export function isBodyType(type: string | null | undefined): boolean {
  if (type === "body") return true;
  return (
    typeof type === "string" &&
    type.length === 4 &&
    type.toLowerCase() === "body"
  );
}

/**
 * 중첩 fail-closed 백스톱이 거부한 element 를 legacy store 에서 빼고 알린다.
 *
 * `mergeElementsCanonicalPrimary` 는 배치의 **일부만** 규칙을 어기면 나머지를
 * 통과시키고 (`changed: true`) 거부된 id 를 `rejectedElementIds` 로 돌려준다.
 * 호출자가 그 id 를 빼지 않고 legacy store 에 쓰면 canonical 에도 `elementsMap`
 * 에도 없고 저장도 되지 않는 유령이 `elements` 배열에만 남는다 — 새로고침 전까지
 * 사라지지 않고, 그 사이 어떤 신호도 없다 (2026-09-09 재현).
 *
 * 소비처 (drop · paste · AI) 는 이 경계에 오기 전에 preflight 로 가까운 유효 부모를
 * 찾아 옮기고 사용자에게 알린다. 여기 걸리는 것은 preflight 를 거치지 않은 경로뿐이라
 * 정상 편집에서는 비용이 0 이다 (거부가 없으면 즉시 반환).
 */
import type { CanonicalMutationResult } from "@/adapters/canonical/canonicalMutations";

const EMPTY_REJECTION: ReadonlySet<string> = new Set();

/**
 * 거부 결과를 콘솔과 사용자 토스트로 남기고 거부된 id 집합을 돌려준다.
 *
 * 토스트 모듈은 지연 import 한다 — `nestingNotice` 가 store index 를 import 하고
 * store index 가 이 모듈을 쓰는 슬라이스를 묶으므로 정적 import 는 순환이 된다.
 */
export function reportCanonicalNestingRejection(
  result: Pick<
    CanonicalMutationResult,
    "nestingViolation" | "rejectedElementIds"
  >,
  context: string,
): ReadonlySet<string> {
  const rejectedIds = result.rejectedElementIds ?? [];
  if (rejectedIds.length === 0) return EMPTY_REJECTION;

  console.warn(
    `[${context}] 중첩 규칙이 element 를 거부해 store 에서 제외한다:`,
    { rejectedIds, violation: result.nestingViolation },
  );

  const violation = result.nestingViolation;
  if (violation) {
    void import("../../workspace/canvas/interaction/nestingNotice")
      .then((module) => module.notifyNestingRejected(violation))
      .catch(() => {
        /* 알림 실패가 편집을 막지 않는다 — 콘솔 경고는 이미 남았다. */
      });
  }

  return new Set(rejectedIds);
}

/** 거부된 id 를 뺀 배열. 거부가 없으면 입력 배열을 그대로 돌려준다. */
export function withoutRejectedElements<T extends { id: string }>(
  elements: readonly T[],
  rejectedIds: ReadonlySet<string>,
): T[] {
  if (rejectedIds.size === 0) return [...elements];
  return elements.filter((element) => !rejectedIds.has(element.id));
}

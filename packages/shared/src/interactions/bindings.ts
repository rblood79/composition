/**
 * @fileoverview ADR-158 Phase 3 — 규칙 → RAC callback props 변환.
 *
 * 렌더러는 요소마다 `createEventHandlerMap(element, context)` 를 부르고 그 결과를
 * spread 한다 (`RuntimeServices` seam — 선언은 있었으나 **공급이 0건이던 dead
 * seam** 이다, breakdown §6 Phase 3 선행 확인). Phase 3 은 그 자리를 채웠고,
 * 2026-08-17 에 preview 에서 shared 로 승격 — publish 도 같은 색인을 소비한다.
 *
 * 여기서 하는 일은 색인 하나뿐이다 — `elementId` 로 규칙을 모아 `trigger` 이름을
 * 키로 하는 callback map 을 만든다. 실제 동작은 `dispatcher` 가 갖는다.
 *
 * 한 요소·한 trigger 에 규칙이 여럿이면 **선언 순서대로 전부** 발화한다. 조건부
 * 실행·우선순위는 스키마에서 원천 제거됐으므로(§2) 여기서 고를 근거가 없다.
 *
 * @see docs/adr/design/158-interactions-rules-capability-registry-breakdown.md §4
 */
import {
  isInteractionRule,
  type InteractionRule,
} from "./interactionRule.types";
import { executeInteractionRule, type DispatchDeps } from "./dispatcher";

/** RAC callback — 인자 형태가 callback 마다 달라 dispatcher 는 쓰지 않는다. */
type InteractionCallback = (...args: unknown[]) => void;

/**
 * `elementId → (trigger → 규칙[])` 색인.
 *
 * 렌더는 요소 수만큼 조회하므로 요소마다 전체 배열을 훑으면 O(요소×규칙) 이 된다.
 * 문서당 1회 색인해 조회를 O(1) 로 만든다.
 */
export type InteractionIndex = ReadonlyMap<
  string,
  ReadonlyMap<string, readonly InteractionRule[]>
>;

/** 빈 색인 — 규칙이 없을 때 매 렌더 새 Map 을 만들지 않도록 공유한다. */
export const EMPTY_INTERACTION_INDEX: InteractionIndex = new Map();

/**
 * canonical `events` root collection 을 색인으로 바꾼다.
 *
 * 구 `SerializedEvent` 잔존 entry 는 `isInteractionRule` 로 걸러낸다 — 마이그레이션
 * 없이 drop 하는 것이 ADR 결정이고(§2), 걸러내지 않으면 `trigger` 가 undefined 인
 * entry 가 색인에 섞인다.
 */
export function buildInteractionIndex(
  rules: readonly unknown[] | undefined | null,
): InteractionIndex {
  if (!rules || rules.length === 0) return EMPTY_INTERACTION_INDEX;

  const index = new Map<string, Map<string, InteractionRule[]>>();
  for (const candidate of rules) {
    if (!isInteractionRule(candidate)) continue;
    if (!candidate.elementId || !candidate.trigger) continue;

    let byTrigger = index.get(candidate.elementId);
    if (!byTrigger) {
      byTrigger = new Map();
      index.set(candidate.elementId, byTrigger);
    }
    const bucket = byTrigger.get(candidate.trigger);
    if (bucket) bucket.push(candidate);
    else byTrigger.set(candidate.trigger, [candidate]);
  }
  return index;
}

/**
 * 한 요소의 callback map 을 만든다. 규칙이 없으면 **같은 빈 객체**를 돌려준다 —
 * 렌더러가 spread 하므로 매번 새 객체를 주면 하위 컴포넌트 memo 가 깨진다.
 */
const NO_HANDLERS: Record<string, InteractionCallback> = Object.freeze({});

export function createElementHandlers(
  elementId: string,
  index: InteractionIndex,
  deps: DispatchDeps,
  onOutcome?: (
    rule: InteractionRule,
    outcome: ReturnType<typeof executeInteractionRule>,
  ) => void,
): Record<string, InteractionCallback> {
  const byTrigger = index.get(elementId);
  if (!byTrigger || byTrigger.size === 0) return NO_HANDLERS;

  const handlers: Record<string, InteractionCallback> = {};
  for (const [trigger, rules] of byTrigger) {
    handlers[trigger] = () => {
      for (const rule of rules) {
        const outcome = executeInteractionRule(rule, deps);
        onOutcome?.(rule, outcome);
      }
    };
  }
  return handlers;
}

/**
 * ADR-158 Phase 2 — 선택 요소의 규칙 read/write 훅.
 *
 * **read**: canonical `events` root collection 을 직접 구독한다
 * (`useInteractionRulesForElement`). 구 EventsPanel 이 쓰던 legacy projection
 * (`selectedElement.events`) 비의존 — breakdown §2.
 *
 * **write**: `updateEventsRootCollection` 단일 진입점 (ADR-149 계승, ADR-158 로
 * payload 만 교체). clean-slate replace 이므로 항상 그 요소의 전체 규칙 배열을 넘긴다.
 */
import { useCallback, useMemo } from "react";
import type { InteractionRule } from "@composition/shared";

import { useStore } from "../../stores";
import { useInteractionRulesForElement } from "../../stores/canonical/canonicalElementsBridge";

let ruleSeq = 0;

/** 규칙 id 생성 — 같은 tick 내 다중 생성에도 충돌하지 않도록 시퀀스 병기 */
export function createRuleId(): string {
  ruleSeq += 1;
  return `rule-${Date.now().toString(36)}-${ruleSeq}`;
}

export interface UseInteractionRulesResult {
  rules: readonly InteractionRule[];
  addRule: (trigger: string) => void;
  updateRule: (id: string, patch: Partial<Omit<InteractionRule, "id">>) => void;
  removeRule: (id: string) => void;
}

export function useInteractionRules(
  elementId: string | null,
): UseInteractionRulesResult {
  const rules = useInteractionRulesForElement(elementId);
  const write = useStore((state) => state.updateEventsRootCollection);

  const commit = useCallback(
    (next: readonly InteractionRule[]) => {
      if (!elementId) return;
      write(elementId, next);
    },
    [elementId, write],
  );

  const addRule = useCallback(
    (trigger: string) => {
      if (!elementId) return;
      const rule: InteractionRule = {
        id: createRuleId(),
        type: "interaction",
        elementId,
        trigger,
        action: { kind: "navigate", params: { path: "" } },
      };
      commit([...rules, rule]);
    },
    [commit, elementId, rules],
  );

  const updateRule = useCallback(
    (id: string, patch: Partial<Omit<InteractionRule, "id">>) => {
      commit(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    },
    [commit, rules],
  );

  const removeRule = useCallback(
    (id: string) => {
      commit(rules.filter((r) => r.id !== id));
    },
    [commit, rules],
  );

  return useMemo(
    () => ({ rules, addRule, updateRule, removeRule }),
    [rules, addRule, updateRule, removeRule],
  );
}

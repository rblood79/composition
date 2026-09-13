/**
 * ADR-158 Phase 3 + ADR-214 Phase 4 — 요소 하나의 이벤트 핸들러 맵.
 *
 * - 규칙 핸들러 (`createElementHandlers`): 트리거 요소의 렌더 문맥 (`stateInstanceScope`) 을
 *   setState 규칙에 실어 요소 변수 스코프 (instanceKey) 를 정한다 (R3).
 * - 암묵 상태 미러: 이름 붙인 RAC 상태 prop (`VariableDef.source.prop`) 의 관찰 이벤트 →
 *   런타임 값 (읽기만, prop 주입 0 — R6). 같은 이벤트의 규칙 핸들러와는 합성한다.
 *
 * App 의 `RenderContext.services.createEventHandlerMap` 이 이 함수를 쓰고, 테스트는 App 없이
 * 같은 배선을 검증한다.
 */
import {
  composeEventHandlers,
  createElementHandlers,
  normalizeImplicitStateValue,
  resolveImplicitStateSources,
  type DispatchDeps,
  type EventHandlerMap,
  type InteractionIndex,
  type InteractionRule,
  type PreviewElement,
  type RuntimeStateHandle,
  type VariableDefType,
} from "@composition/shared";

export interface PreviewEventHandlerMapInput {
  interactionIndex: InteractionIndex;
  interactionDeps: DispatchDeps;
  reportInteractionOutcome?: (
    rule: InteractionRule,
    outcome: { ok: boolean },
  ) => void;
  getRuntimeState: () => RuntimeStateHandle;
}

type ElementLike = Pick<
  PreviewElement,
  "id" | "type" | "stateInstanceScope" | "stateDefs"
>;

export function createPreviewEventHandlerMap(
  element: ElementLike,
  input: PreviewEventHandlerMapInput,
): EventHandlerMap {
  const ruleHandlers = createElementHandlers(
    element.id,
    input.interactionIndex,
    input.interactionDeps,
    input.reportInteractionOutcome,
    element.stateInstanceScope
      ? {
          instanceKeyFor: (ownerId) =>
            element.stateInstanceScope?.get(ownerId) ?? ownerId,
        }
      : undefined,
  );
  const mirrored = (element.stateDefs ?? []).filter((def) => def.source);
  if (mirrored.length === 0) return ruleHandlers as EventHandlerMap;
  const sources = resolveImplicitStateSources(element.type);
  const instanceKey = element.stateInstanceScope?.get(element.id) ?? element.id;
  const mirrorHandlers: Record<string, (...args: unknown[]) => void> = {};
  for (const def of mirrored) {
    const source = sources.find((s) => s.prop === def.source?.prop);
    if (!source) continue;
    mirrorHandlers[source.event] = (value: unknown) => {
      input.getRuntimeState().write({
        variableId: def.id,
        op: "set",
        value: normalizeImplicitStateValue(def.type as VariableDefType, value),
        scope: { kind: "element", instanceKey },
      });
    };
  }
  return composeEventHandlers(
    ruleHandlers as Record<string, (...args: unknown[]) => void>,
    mirrorHandlers,
  ) as EventHandlerMap;
}

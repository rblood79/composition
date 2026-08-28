/**
 * create_interaction_rule Tool — 이벤트 규칙 1건을 만든다 (ADR-134 Phase 4, D4).
 *
 * 목표 스키마는 **ADR-158 `InteractionRule`** 이다 — dormant `SerializedEvent` / root
 * `actions` 는 쓰지 않는다 (ADR-134 R6 이 정확히 그 오조준을 막으려는 위험이다).
 * 저장은 canonical `events` root collection (`addEvent`).
 *
 * trigger 와 capability 는 **`capabilityRegistry` 로 검증**한다: 등록되지 않은 callback 이름
 * (DOM 별칭 `onClick` 등) 이나 대상이 노출하지 않는 capability 는 거부하고, 쓸 수 있는 목록을
 * 결과에 실어 모델이 다음 호출을 고칠 수 있게 한다.
 */
import {
  isInteractionRule,
  resolveCapabilities,
  resolveTriggers,
  type InteractionAction,
  type InteractionRule,
} from "@composition/shared";
import type {
  ToolExecutor,
  ToolExecutionResult,
} from "../../../types/integrations/ai.types";
import { useCanonicalDocumentStore } from "../../../builder/stores/canonical/canonicalDocumentStore";
import { runCanonicalMutation } from "../../../adapters/canonical/canonicalMutationRunner";
import { getAiToolReadModel } from "./canonicalToolReadModel";

type ActionArgs = {
  kind?: string;
  path?: string;
  message?: string;
  targetId?: string;
  capability?: string;
  value?: unknown;
};

interface ActionResult {
  action?: InteractionAction;
  error?: string;
  hint?: unknown;
}

function buildAction(
  raw: ActionArgs,
  elementsById: Map<string, { type: string }>,
): ActionResult {
  if (raw.kind === "navigate") {
    return raw.path
      ? { action: { kind: "navigate", params: { path: raw.path } } }
      : { error: "navigate 액션은 path 가 필요합니다." };
  }

  if (raw.kind === "toast") {
    return raw.message
      ? { action: { kind: "toast", params: { message: raw.message } } }
      : { error: "toast 액션은 message 가 필요합니다." };
  }

  if (raw.kind === "capability") {
    if (!raw.targetId || !raw.capability) {
      return {
        error: "capability 액션은 targetId 와 capability 가 필요합니다.",
      };
    }
    const target = elementsById.get(raw.targetId);
    if (!target) {
      return { error: `대상 요소를 찾을 수 없습니다: ${raw.targetId}` };
    }
    const available = resolveCapabilities(target.type);
    if (!available[raw.capability]) {
      return {
        error: `${target.type} 은 '${raw.capability}' capability 를 노출하지 않습니다.`,
        hint: { availableCapabilities: Object.keys(available) },
      };
    }
    return {
      action: {
        kind: "capability",
        targetId: raw.targetId,
        capability: raw.capability,
        ...(raw.value !== undefined ? { params: { value: raw.value } } : {}),
      },
    };
  }

  return {
    error: "action.kind 는 navigate / toast / capability 중 하나여야 합니다.",
  };
}

export const createInteractionRuleTool: ToolExecutor = {
  name: "create_interaction_rule",

  async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const elementIdArg = args.elementId as string | undefined;
    const trigger = args.trigger as string | undefined;
    const actionArgs = (args.action ?? {}) as ActionArgs;

    if (!elementIdArg || !trigger) {
      return { success: false, error: "elementId 와 trigger 는 필수입니다." };
    }

    try {
      const {
        elementsById,
        state: { selectedElementId },
      } = getAiToolReadModel();

      const targetId =
        elementIdArg === "selected" ? selectedElementId : elementIdArg;
      if (!targetId) {
        return { success: false, error: "선택된 요소가 없습니다." };
      }

      const element = elementsById.get(targetId);
      if (!element) {
        return {
          success: false,
          error: `요소를 찾을 수 없습니다: ${targetId}`,
        };
      }

      const triggers = resolveTriggers(element.type);
      if (!triggers.includes(trigger)) {
        return {
          success: false,
          error: `${element.type} 은 '${trigger}' 트리거를 제공하지 않습니다.`,
          data: { availableTriggers: triggers },
        };
      }

      const { action, error, hint } = buildAction(
        actionArgs,
        elementsById as Map<string, { type: string }>,
      );
      if (!action) {
        return { success: false, error, ...(hint ? { data: hint } : {}) };
      }

      const rule: InteractionRule = {
        id: crypto.randomUUID(),
        type: "interaction",
        elementId: targetId,
        trigger,
        action,
      };

      // 스키마 가드 — 구 `SerializedEvent` 형태가 섞이면 여기서 걸린다
      if (!isInteractionRule(rule)) {
        return { success: false, error: "InteractionRule 스키마 검증 실패" };
      }

      // 러너 경유 (ADR-184) — events root collection 은 legacy mirror 가 없지만
      // (ADR-158 에서 중단) persist 는 필요하다. Preview 는 canonical 구독으로 받는다.
      runCanonicalMutation({
        canonical: () => {
          useCanonicalDocumentStore.getState().addEvent(rule);
          const store = useCanonicalDocumentStore.getState();
          return {
            changed: true,
            document: store.currentProjectId
              ? (store.documents.get(store.currentProjectId) ?? null)
              : null,
          };
        },
        history: {
          skip:
            "이벤트 규칙은 Events 패널과 같은 canonical-only 경로 — 패널도 history 를 " +
            "남기지 않는다 (inspectorActions.updateEventsRootCollection)",
        },
      });

      return {
        success: true,
        data: { ruleId: rule.id, elementId: targetId, trigger, action },
        affectedElementIds: [targetId],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

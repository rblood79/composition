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
  ToolExecutionResult,
  ToolExecutor,
  ToolTranslate,
} from "../../../types/integrations/ai.types";
import { getAiToolReadModel } from "./aiToolReadModel";
import { AI_WRITE_HOST_MISSING, getAiWriteHost } from "../aiWriteHost";
import { resolveElementRef } from "./elementRef";

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
  t: ToolTranslate,
  raw: ActionArgs,
  elementsById: Map<string, { type: string }>,
): ActionResult {
  if (raw.kind === "navigate") {
    return raw.path
      ? { action: { kind: "navigate", params: { path: raw.path } } }
      : { error: t("aiToolError.navigateNeedsPath") };
  }

  if (raw.kind === "toast") {
    return raw.message
      ? { action: { kind: "toast", params: { message: raw.message } } }
      : { error: t("aiToolError.toastNeedsMessage") };
  }

  if (raw.kind === "capability") {
    if (!raw.targetId || !raw.capability) {
      return {
        error: t("aiToolError.capabilityNeedsTarget"),
      };
    }
    const target = elementsById.get(raw.targetId);
    if (!target) {
      return {
        error: t("aiToolError.targetNotFound", { id: String(raw.targetId) }),
      };
    }
    const available = resolveCapabilities(target.type);
    if (!available[raw.capability]) {
      return {
        error: t("aiToolError.capabilityNotExposed", {
          type: target.type,
          capability: String(raw.capability),
        }),
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
    error: t("aiToolError.actionKind"),
  };
}

export const createInteractionRuleTool: ToolExecutor = {
  name: "create_interaction_rule",

  async execute(
    args: Record<string, unknown>,
    t: ToolTranslate,
  ): Promise<ToolExecutionResult> {
    const elementIdArg = args.elementId as string | undefined;
    const trigger = args.trigger as string | undefined;
    const actionArgs = (args.action ?? {}) as ActionArgs;

    if (!elementIdArg || !trigger) {
      return {
        success: false,
        error: t("aiToolError.ruleNeedsIdTrigger"),
      };
    }

    try {
      const {
        elementsById,
        state: { selectedElementId },
      } = getAiToolReadModel();

      // 별칭·실제 id 를 한 곳에서 해석한다 (`elementRef.ts`) — 실패 시 다음 시도가
      // 맞도록 복구 경로를 담은 오류를 돌려준다.
      const ref = resolveElementRef(
        elementIdArg,
        {
          selectedElementId,
          elementsById,
        },
        t,
      );
      if ("error" in ref) return { success: false, error: ref.error };
      const targetId = ref.id;
      const element = elementsById.get(targetId)!;

      const triggers = resolveTriggers(element.type);
      if (!triggers.includes(trigger)) {
        return {
          success: false,
          error: t("aiToolError.triggerNotProvided", {
            type: element.type,
            trigger: String(trigger),
          }),
          data: { availableTriggers: triggers },
        };
      }

      const { action, error, hint } = buildAction(
        t,
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
        return {
          success: false,
          error: t("aiToolError.ruleSchemaInvalid"),
        };
      }

      // ADR-248 4e-5: the open Builder adds the rule to its document (one step) — 4e-7: only the
      // host (the old canonical `events` write is the old store host's).
      const writeHost = getAiWriteHost();
      if (!writeHost) return { success: false, error: AI_WRITE_HOST_MISSING };
      const written = await writeHost.addInteraction(targetId, trigger, action);
      if (!written.ok) return { success: false, error: written.error };
      return {
        success: true,
        data: { ruleId: written.ruleId, elementId: targetId, trigger, action },
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

/**
 * run_command Tool — AI 패널이 빌더 명령을 이름으로 부른다 (ADR-196 Phase 3).
 *
 * 도구 정의(enum)는 `COMMAND_META` allowlist 에서 생성한다 — 표가 곧 노출 표면이라
 * 도구 목록이 따로 낡지 않는다. 실행은 executor 를 그대로 지난다 (allowlist →
 * precondition → 승인 → 기록). 도구가 store 를 직접 만지지 않는다.
 *
 * ADR-134 Phase 2 가 Groq 를 걷어내면서 정의는 provider 중립 `LLMToolDefinition` 이 됐다 —
 * D11 이 MCP tool 로 옮길 때 형태 변환이 더 필요하지 않다.
 */
import type { LLMToolDefinition } from "../providers/LLMProvider";
import type {
  ToolExecutionResult,
  ToolExecutor,
} from "../../../types/integrations/ai.types";
import {
  executeAgentCommand,
  executeAgentCommands,
  listAgentCommands,
} from "../../agent/executeAgentCommand";
import { requestAgentCommandConfirmation } from "../../agent/agentCommandConfirmation";
import type { AgentExecutionContext } from "../../agent/executeAgentCommand";
import type { PromptTranslate } from "../promptTranslate";

/** AI 패널 host — 승인은 앱 안 다이얼로그, 기록은 `agentCommandLog`. */
export const aiPanelAgentContext: AgentExecutionContext = {
  host: "ai-panel",
  requestConfirm: ({ id, summary, meta, args }) =>
    requestAgentCommandConfirmation({
      id,
      summary,
      mutation: meta.mutation,
      undo: meta.undo,
      host: "ai-panel",
      args,
    }),
};

/** allowlist 를 enum 으로 굳힌 도구 정의 — 목록·설명이 `COMMAND_META` 에서 파생된다. */
export function buildRunCommandToolDefinition(
  t: PromptTranslate,
): LLMToolDefinition {
  const commands = listAgentCommands();
  const lines = commands.map(
    (c) =>
      `${c.id}: ${c.description} (${c.mutation}${c.confirm ? t("aiRunCommand.needsApproval") : ""})`,
  );
  return {
    name: "run_command",
    description: `${t("aiRunCommand.description")}\n${t(
      "aiRunCommand.availableHeading",
    )}\n${lines.join("\n")}`,
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          enum: commands.map((c) => c.id),
          description: t("aiRunCommand.idParam"),
        },
        ids: {
          type: "array",
          items: { type: "string", enum: commands.map((c) => c.id) },
          description: t("aiRunCommand.idsParam"),
        },
      },
    },
  };
}

export const runCommandTool: ToolExecutor = {
  name: "run_command",

  async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const id = typeof args.id === "string" ? args.id : null;
    const ids = Array.isArray(args.ids)
      ? args.ids.filter((value): value is string => typeof value === "string")
      : null;

    if (!id && (!ids || ids.length === 0)) {
      return { success: false, error: "id 또는 ids 가 필요합니다." };
    }

    try {
      if (ids && ids.length > 0) {
        const results = await executeAgentCommands(
          ids.map((commandId) => ({ id: commandId })),
          aiPanelAgentContext,
        );
        const failed = results.find((result) => result.status !== "ok");
        return {
          success: !failed,
          data: { results },
          ...(failed ? { error: `${failed.id}: ${failed.reason}` } : {}),
        };
      }

      const result = await executeAgentCommand(
        id as string,
        args.args,
        aiPanelAgentContext,
      );
      if (result.status !== "ok") {
        return { success: false, data: result, error: result.reason };
      }
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

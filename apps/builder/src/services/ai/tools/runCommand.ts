/**
 * run_command Tool — AI 패널이 빌더 명령을 이름으로 부른다 (ADR-196 Phase 3).
 *
 * 도구 정의(enum)는 `COMMAND_META` allowlist 에서 생성한다 — 표가 곧 노출 표면이라
 * 도구 목록이 따로 낡지 않는다. 실행은 executor 를 그대로 지난다 (allowlist →
 * precondition → 승인 → 기록). 도구가 store 를 직접 만지지 않는다.
 *
 * ADR-134 가 Groq 를 걷어내면 같은 descriptor 를 MCP tool 로 옮긴다 (D11) — 이 파일에서
 * Groq 에 묶인 것은 `toolDefinition` 의 형태뿐이다.
 */
import type Groq from "groq-sdk";
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

type ChatCompletionTool = Groq.Chat.Completions.ChatCompletionTool;

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
export function buildRunCommandToolDefinition(): ChatCompletionTool {
  const commands = listAgentCommands();
  const lines = commands.map(
    (c) =>
      `${c.id}: ${c.description} (${c.mutation}${c.confirm ? ", 사용자 승인 필요" : ""})`,
  );
  return {
    type: "function",
    function: {
      name: "run_command",
      description:
        "빌더 명령을 이름으로 실행합니다 (정렬·분배·그룹·복제·z-order·되돌리기·줌·패널 토글 등). " +
        "요소 좌표를 직접 계산하지 말고 이 도구를 쓰세요. 파괴적 명령은 사용자 승인 뒤에만 실행됩니다.\n" +
        `사용 가능한 명령:\n${lines.join("\n")}`,
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            enum: commands.map((c) => c.id),
            description: "실행할 명령 id",
          },
          ids: {
            type: "array",
            items: { type: "string", enum: commands.map((c) => c.id) },
            description:
              "여러 명령을 순서대로 실행 (각 명령마다 승인을 따로 묻고, 실패하면 거기서 멈춥니다). id 대신 사용.",
          },
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

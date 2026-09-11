/**
 * propose_data_change Tool — 모델 대면 데이터 쓰기의 **유일한** tool (ADR-213 Phase 4, HC1 · HC2).
 *
 * 입력 스키마는 `dataChange.ts` 에서 파생한다 (`modelFacingDataChangeJsonSchema` — 사람 전용
 * op 제외 · origin 없음 · 내부 필드 없음). 실행은 `dispatchDataProposal` 하나를 지난다:
 * 검증 → 승인 diff (`AgentCommandConfirmDialog`) → executor 가 `origin:"ai"` stamp →
 * 152 적용기 → History 1 + 세션 provenance 1. 직접 적용 경로는 없다.
 */
import type { DataOp } from "@composition/shared";
import type {
  ToolExecutionResult,
  ToolExecutor,
  ToolTranslate,
} from "../../../types/integrations/ai.types";
import { dispatchDataProposal } from "../data/dataProposalDispatcher";

export const proposeDataChangeTool: ToolExecutor = {
  name: "propose_data_change",

  async execute(
    args: Record<string, unknown>,
    t: ToolTranslate,
  ): Promise<ToolExecutionResult> {
    // 모델이 `ops: [...]` 대신 op 하나를 최상위에 펼쳐 보내는 경우 (live 에서 qwen3 이
    //   실제로 그랬다) 를 한 개짜리 제안으로 읽는다 — 검증 · 승인 경로는 같다.
    const ops = Array.isArray(args.ops)
      ? args.ops
      : typeof args.op === "string"
        ? [
            Object.fromEntries(
              Object.entries(args).filter(([k]) => k !== "label"),
            ),
          ]
        : [];
    if (ops.length === 0) {
      return { success: false, error: t("aiToolError.proposalOpsRequired") };
    }
    // origin 은 모델 입력으로 받지 않는다 — 있으면 무시하지 않고 거부 (HC2).
    if ("origin" in args && args.origin !== undefined) {
      return {
        success: false,
        error: t("aiToolError.proposalOriginForbidden"),
      };
    }
    const label =
      typeof args.label === "string" && args.label.trim()
        ? args.label.trim()
        : undefined;

    try {
      const result = await dispatchDataProposal(
        {
          ops: ops as DataOp[],
          ...(label !== undefined ? { label } : {}),
          host: "ai-panel",
          origin: "ai",
        },
        t,
      );
      if (result.status === "invalid") {
        return { success: false, error: result.errors.join("; ") };
      }
      if (result.status === "rejected") {
        return { success: false, error: t("aiDataProposal.rejected") };
      }
      return {
        success: true,
        data: {
          status: "applied",
          opsCount: result.opsCount,
          historyId: result.historyId ?? null,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

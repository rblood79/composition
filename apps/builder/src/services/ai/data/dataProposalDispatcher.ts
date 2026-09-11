/**
 * 데이터 proposal dispatcher — AI · agent 데이터 쓰기의 **유일한** 진입점 (ADR-213 HC1 · R7).
 *
 * Propose → Review → Apply: 모델/agent 가 만든 `DataOp[]` 를 받아 (1) 모델 대면 스키마로
 * 검증하고 (origin 없음 · 사람 전용 op 없음 · inverse 전용 `restore` 없음) (2) 승인
 * 채널 (`requestAgentCommandConfirmation`, host 없으면 거부) 을 지난 뒤 (3) executor 가
 * `origin:"ai"|"agent"` 를 stamp 해 152 적용기 `applyDataChange` 를 **한 번** 부른다 —
 * History `type:"data"` entry 1 + 세션 provenance entry 1 (HC4).
 *
 * `origin` 을 적용기에 넘기는 AI/agent 코드는 이 파일뿐이어야 한다 (정적 가드
 * `dataProposalDispatcher.static.test.ts` — Phase 4).
 */
import {
  DataOpSchema,
  HUMAN_ONLY_DATA_OPS,
  INTERNAL_DATA_OP_FIELDS,
} from "@composition/shared";
import type { DataChangeOrigin, DataOp } from "@composition/shared";
import { z } from "zod";
import {
  useAgentCommandLogStore,
  type AgentHost,
} from "../../../builder/stores/agentCommandLog";
import { useDataStore } from "../../../builder/stores/data";
import { historyManager } from "../../../builder/stores/history";
import type { ToolTranslate } from "../../../types/integrations/ai.types";
import { requestAgentCommandConfirmation } from "../../agent/agentCommandConfirmation";

/** 승인 채널 · provenance 로그에 쓰는 데이터 proposal 의 id (agent 명령 id 축과 구분). */
export const DATA_PROPOSAL_COMMAND_ID = "data.propose" as const;

export interface DataProposal {
  ops: readonly DataOp[];
  label?: string;
  host: AgentHost;
  /** 호출 주체 — executor 가 정한다. 모델 입력으로 받지 않는다 (HC2). */
  origin: Extract<DataChangeOrigin, "ai" | "agent">;
}

export type DataProposalResult =
  | { status: "applied"; historyId?: number; opsCount: number }
  | { status: "rejected"; opsCount: number }
  | { status: "invalid"; errors: string[] };

/**
 * 모델 대면 op 스키마 — 152 정본에서 사람 전용 op 를 빼고 inverse 전용 필드를 금지한다.
 * Phase 4 의 `propose_data_change` tool JSON Schema 도 같은 zod 에서 파생한다.
 */
export const ProposalOpsSchema = z
  .array(
    DataOpSchema.superRefine((op, ctx) => {
      if ((HUMAN_ONLY_DATA_OPS as readonly string[]).includes(op.op)) {
        ctx.addIssue({
          code: "custom",
          message: `${op.op} 는 사람 UI 전용입니다 (AI/agent 제안 불가)`,
        });
      }
      for (const field of INTERNAL_DATA_OP_FIELDS[op.op] ?? []) {
        if (
          field in op &&
          (op as Record<string, unknown>)[field] !== undefined
        ) {
          ctx.addIssue({
            code: "custom",
            message: `${op.op}.${field} 는 적용기 내부 필드입니다`,
          });
        }
      }
    }),
  )
  .min(1);

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) =>
    issue.path.length
      ? `${issue.path.join(".")}: ${issue.message}`
      : issue.message,
  );
}

function record(
  entry: Omit<
    ReturnType<typeof useAgentCommandLogStore.getState>["entries"][number],
    "seq" | "ts"
  >,
): void {
  useAgentCommandLogStore.getState().append({ ...entry, ts: Date.now() });
}

function summarize(ops: readonly DataOp[], t: ToolTranslate): string {
  const counts = new Map<string, number>();
  for (const op of ops) counts.set(op.op, (counts.get(op.op) ?? 0) + 1);
  const parts = [...counts].map(([op, n]) => (n > 1 ? `${op} ×${n}` : op));
  return t("aiDataProposal.summary", {
    ops: parts.join(", "),
    count: ops.length,
  });
}

export async function dispatchDataProposal(
  proposal: DataProposal,
  t: ToolTranslate,
): Promise<DataProposalResult> {
  const started = performance.now();
  const parsed = ProposalOpsSchema.safeParse(proposal.ops);
  if (!parsed.success) {
    return { status: "invalid", errors: formatIssues(parsed.error) };
  }
  const ops = parsed.data;

  // Review — host 가 없으면 거부다 (자동화 환경에서 "물어볼 수 없음" 은 통과가 아니다).
  const approved = await requestAgentCommandConfirmation({
    id: DATA_PROPOSAL_COMMAND_ID,
    summary: summarize(ops, t),
    mutation: "document",
    undo: "history",
    host: proposal.host,
    args: { ops, label: proposal.label, origin: proposal.origin },
  });
  if (!approved) {
    record({
      host: proposal.host,
      id: DATA_PROPOSAL_COMMAND_ID,
      args: { origin: proposal.origin, opsCount: ops.length, approved: false },
      status: "declined",
      reason: "user-declined",
      mutation: "document",
      undoable: false,
      durationMs: performance.now() - started,
    });
    return { status: "rejected", opsCount: ops.length };
  }

  // Apply — executor 가 origin 을 stamp 한다.
  try {
    const { applyDataChange, currentProjectId } = useDataStore.getState();
    await applyDataChange(
      {
        ops,
        origin: proposal.origin,
        ...(proposal.label !== undefined ? { label: proposal.label } : {}),
      },
      { projectId: currentProjectId ?? undefined },
    );
    const historyId = historyManager.getCurrentPageHistory().currentIndex;
    record({
      host: proposal.host,
      id: DATA_PROPOSAL_COMMAND_ID,
      args: {
        origin: proposal.origin,
        opsCount: ops.length,
        approved: true,
        historyId,
      },
      status: "ok",
      mutation: "document",
      undoable: true,
      historyIndex: historyId,
      durationMs: performance.now() - started,
    });
    return { status: "applied", historyId, opsCount: ops.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    record({
      host: proposal.host,
      id: DATA_PROPOSAL_COMMAND_ID,
      args: { origin: proposal.origin, opsCount: ops.length, approved: true },
      status: "error",
      reason: message,
      mutation: "document",
      undoable: false,
      durationMs: performance.now() - started,
    });
    return { status: "invalid", errors: [message] };
  }
}

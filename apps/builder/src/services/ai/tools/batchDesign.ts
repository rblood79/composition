/**
 * batch_design Tool
 *
 * 여러 작업(create/update/delete)을 순차 실행 — 기존 도구의 execute() 를 그대로 재사용한다
 * (의미를 다시 구현하지 않는다).
 *
 * **되돌리기 단위 (ADR-134 Phase 3 / G3)**: 배치 하나가 history **1 entry** 다 — 사용자
 * ⌘Z 한 번으로 배치 전체가 되돌아간다. 묶지 않으면 3-op 배치가 3 entry 였다 (Phase 3 실측).
 *
 * 트랜잭션 창은 원래 동기 전용이고 (`history.ts` `runInTransaction` 주석), 도구 실행은
 * 비동기라 창이 이벤트 루프에 양보한다. 그래서 창이 열려 있는 동안 **사용자가 만든
 * 무관한 변경이 같은 entry 로 합쳐질 수 있다** — AI 배치가 도는 몇 백 ms 사이의 편집이
 * 그렇다. 대안(각 op 를 skipHistory 로 돌리고 끝에 1건 기록)은 `updateElementProps` 에
 * skipHistory 표면이 없어 성립하지 않는다. 비동기 전용 병합 표면은 ADR-180 소관.
 */

import type {
  ToolExecutor,
  ToolExecutionResult,
} from "../../../types/integrations/ai.types";
import { historyManager } from "../../../builder/stores/history";
import { createElementTool } from "./createElement";
import { updateElementTool } from "./updateElement";
import { deleteElementTool } from "./deleteElement";

interface BatchOperation {
  action: "create" | "update" | "delete";
  args: Record<string, unknown>;
}

const ACTION_EXECUTORS: Record<string, ToolExecutor> = {
  create: createElementTool,
  update: updateElementTool,
  delete: deleteElementTool,
};

export const batchDesignTool: ToolExecutor = {
  name: "batch_design",

  async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const operations = args.operations as BatchOperation[] | undefined;

    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      return { success: false, error: "operations 배열이 필요합니다." };
    }

    if (operations.length > 20) {
      return {
        success: false,
        error: "한 번에 최대 20개 작업까지 가능합니다.",
      };
    }

    // 배치 전체를 되돌리기 1 단위로 묶는다 (G3). elementId 는 대표값이 없으므로
    // 배치 식별자를 쓴다 — entry 는 canonicalEvents 로 역연산된다.
    historyManager.beginTransaction({
      type: "batch",
      elementId: `ai-batch-${operations.length}`,
    });

    const results: Array<{
      index: number;
      action: string;
      success: boolean;
      data?: unknown;
      error?: string;
    }> = [];
    const allAffectedIds: string[] = [];

    try {
      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        const executor = ACTION_EXECUTORS[op.action];

        if (!executor) {
          results.push({
            index: i,
            action: op.action,
            success: false,
            error: `알 수 없는 action: ${op.action}. create/update/delete만 가능.`,
          });
          continue;
        }

        const result = await executor.execute(op.args || {});
        results.push({
          index: i,
          action: op.action,
          success: result.success,
          data: result.data,
          error: result.error,
        });

        if (result.affectedElementIds) {
          allAffectedIds.push(...result.affectedElementIds);
        }

        // 실패 시 나머지 작업 중단
        if (!result.success) {
          break;
        }
      }
    } finally {
      historyManager.commitTransaction();
    }

    const successCount = results.filter((r) => r.success).length;

    return {
      success: successCount > 0,
      data: {
        total: operations.length,
        executed: results.length,
        succeeded: successCount,
        failed: results.length - successCount,
        results,
      },
      affectedElementIds: allAffectedIds,
    };
  },
};

/**
 * delete_element Tool
 *
 * 요소 삭제 (AIPanel.tsx의 executeIntent delete case 추출)
 */

import type {
  ToolExecutionResult,
  ToolExecutor,
  ToolTranslate,
} from "../../../types/integrations/ai.types";
import { getAiToolReadModel } from "./aiToolReadModel";
import { AI_WRITE_HOST_MISSING, getAiWriteHost } from "../aiWriteHost";
import { resolveElementRef } from "./elementRef";

export const deleteElementTool: ToolExecutor = {
  name: "delete_element",

  async execute(
    args: Record<string, unknown>,
    t: ToolTranslate,
  ): Promise<ToolExecutionResult> {
    const elementIdArg = args.elementId as string;
    if (!elementIdArg) {
      return { success: false, error: t("aiToolError.elementIdRequired") };
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

      // ADR-248 4e-5: the open Builder removes it (one step) — its remove command checks the
      // structure itself. 4e-7: only the host (the old checks are the old store host's).
      const writeHost = getAiWriteHost();
      if (!writeHost) return { success: false, error: AI_WRITE_HOST_MISSING };
      const written = await writeHost.remove(targetId, t);
      if (!written.ok) return { success: false, error: written.error };

      // 반영 확인 — 지우기도 조용히 빠지는 경로가 있다 (`mutationVerification.ts` 주석).
      const remaining = getAiToolReadModel().elementsById.get(targetId);
      if (remaining) {
        return {
          success: false,
          error: t("aiToolError.notDeleted", { id: targetId }),
        };
      }

      return {
        success: true,
        data: {
          deletedElementId: targetId,
          type: element.type,
        },
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

/**
 * delete_element Tool
 *
 * 요소 삭제 (AIPanel.tsx의 executeIntent delete case 추출)
 */

import type {
  ToolExecutor,
  ToolExecutionResult,
} from "../../../types/integrations/ai.types";
import { getAiToolReadModel } from "./canonicalToolReadModel";
import { resolveElementRef } from "./elementRef";

export const deleteElementTool: ToolExecutor = {
  name: "delete_element",

  async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const elementIdArg = args.elementId as string;
    if (!elementIdArg) {
      return { success: false, error: "elementId는 필수입니다." };
    }

    try {
      const {
        elementsById,
        state: { removeElement, selectedElementId },
      } = getAiToolReadModel();

      // 별칭·실제 id 를 한 곳에서 해석한다 (`elementRef.ts`) — 실패 시 다음 시도가
      // 맞도록 복구 경로를 담은 오류를 돌려준다.
      const ref = resolveElementRef(elementIdArg, {
        selectedElementId,
        elementsById,
      });
      if ("error" in ref) return { success: false, error: ref.error };
      const targetId = ref.id;
      const element = elementsById.get(targetId)!;

      // body 요소 보호
      if (element.type === "body") {
        return { success: false, error: "body 요소는 삭제할 수 없습니다." };
      }

      await removeElement(targetId);

      // 반영 확인 — `removeElement` 도 반환값이 없다 (`mutationVerification.ts` 주석).
      const remaining = getAiToolReadModel().elementsById.get(targetId);
      if (remaining && !remaining.deleted) {
        return {
          success: false,
          error: `삭제되지 않았습니다: ${targetId}. 보호된 요소이거나 편집이 차단된 상태일 수 있습니다. get_editor_state 로 현재 상태를 확인하세요.`,
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

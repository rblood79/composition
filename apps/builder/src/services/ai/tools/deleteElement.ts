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

      // "selected" → 실제 ID 해석
      const targetId =
        elementIdArg === "selected" ? selectedElementId : elementIdArg;
      if (!targetId) {
        return { success: false, error: "선택된 요소가 없습니다." };
      }

      // 요소 존재 확인
      const element = elementsById.get(targetId);
      if (!element) {
        return {
          success: false,
          error: `요소를 찾을 수 없습니다: ${targetId}`,
        };
      }

      // body 요소 보호
      if (element.type === "body") {
        return { success: false, error: "body 요소는 삭제할 수 없습니다." };
      }

      await removeElement(targetId);

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

/**
 * get_selection Tool
 *
 * 현재 선택된 요소의 상세 정보를 조회
 */

import type {
  ToolExecutionResult,
  ToolExecutor,
  ToolTranslate,
} from "../../../types/integrations/ai.types";
import { getAiToolReadModel } from "./canonicalToolReadModel";

export const getSelectionTool: ToolExecutor = {
  name: "get_selection",

  async execute(
    _args: Record<string, unknown>,
    t: ToolTranslate,
  ): Promise<ToolExecutionResult> {
    try {
      const {
        childrenByParent,
        elementsById,
        state: { selectedElementId },
      } = getAiToolReadModel();

      if (!selectedElementId) {
        return {
          success: true,
          data: { selected: null, message: t("aiToolError.selectionEmpty") },
        };
      }

      const element = elementsById.get(selectedElementId);
      if (!element) {
        return {
          success: true,
          data: {
            selected: null,
            message: t("aiToolError.selectionMissing"),
          },
        };
      }

      // 자식 요소 ID 목록
      const children = childrenByParent.get(selectedElementId) || [];

      return {
        success: true,
        data: {
          id: element.id,
          type: element.type,
          props: element.props,
          parent_id: element.parent_id,
          page_id: element.page_id,
          childrenCount: children.length,
          childrenIds: children.map((c) => c.id),
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

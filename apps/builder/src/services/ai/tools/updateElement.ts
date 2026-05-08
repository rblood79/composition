/**
 * update_element Tool
 *
 * 기존 요소의 속성/스타일 수정 (AIPanel.tsx의 executeIntent modify case 추출)
 */

import type {
  ToolExecutor,
  ToolExecutionResult,
} from "../../../types/integrations/ai.types";
import { adaptStylePatchWithFills } from "../styleAdapter";
import { useAIVisualFeedbackStore } from "../../../builder/stores/aiVisualFeedback";
import { getAiToolReadModel } from "./canonicalToolReadModel";

export const updateElementTool: ToolExecutor = {
  name: "update_element",

  async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const elementIdArg = args.elementId as string;
    if (!elementIdArg) {
      return { success: false, error: "elementId는 필수입니다." };
    }

    const newProps = (args.props || {}) as Record<string, unknown>;
    const newStyles = (args.styles || {}) as Record<string, unknown>;
    const newFills = Array.isArray(args.fills) ? args.fills : undefined;

    if (
      Object.keys(newProps).length === 0 &&
      Object.keys(newStyles).length === 0 &&
      (!newFills || newFills.length === 0)
    ) {
      return {
        success: false,
        error: "변경할 props, styles 또는 fills를 지정하세요.",
      };
    }

    try {
      const {
        elementsById,
        state: { selectedElementId, updateElementProps },
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

      // 업데이트 객체 구성
      const updates: Record<string, unknown> = { ...newProps };

      // 스타일 병합 (기존 스타일 유지 + 새 스타일 덮어쓰기)
      if (Object.keys(newStyles).length > 0 || newFills) {
        const existingStyle = (element.props?.style || {}) as Record<
          string,
          unknown
        >;
        updates.style = adaptStylePatchWithFills(
          existingStyle,
          newStyles,
          newFills,
        ).style;
      }

      if (newFills) {
        updates.fills = newFills;
      }

      await updateElementProps(targetId, updates);

      // G.3 시각 피드백: 수정 완료 flash
      useAIVisualFeedbackStore.getState().addFlashForNode(targetId, {
        strokeWidth: 1,
      });

      return {
        success: true,
        data: {
          elementId: targetId,
          type: element.type,
          updatedProps: Object.keys(newProps),
          updatedStyles: Object.keys(newStyles),
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

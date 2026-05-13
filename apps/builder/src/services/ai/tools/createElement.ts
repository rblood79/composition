/**
 * create_element Tool
 *
 * 캔버스에 새 요소를 생성 (AIPanel.tsx의 executeIntent create case 추출)
 */

import type {
  ToolExecutor,
  ToolExecutionResult,
} from "../../../types/integrations/ai.types";
import type { Element } from "../../../types/core/store.types";
import { getDefaultProps } from "../../../types/builder/unified.types";
import { adaptPropsForElement } from "../styleAdapter";
import { useAIVisualFeedbackStore } from "../../../builder/stores/aiVisualFeedback";
import { getAiToolReadModel } from "./canonicalToolReadModel";

export const createElementTool: ToolExecutor = {
  name: "create_element",

  async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const type = args.type as string;
    if (!type) {
      return { success: false, error: "type는 필수입니다." };
    }

    const aiProps = (args.props || {}) as Record<string, unknown>;
    const aiStyles = (args.styles || {}) as Record<string, unknown>;
    const aiFills = Array.isArray(args.fills) ? args.fills : undefined;
    const parentIdArg = args.parentId as string | undefined;
    const dataBindingArg = args.dataBinding as
      | { endpoint?: string }
      | undefined;

    try {
      const {
        elements,
        state: { addElement, currentPageId, selectedElementId },
      } = getAiToolReadModel();

      // 기본 props 생성 + AI props 병합
      const defaultProps = getDefaultProps(type);
      const mergedProps = { ...defaultProps, ...aiProps };

      // 스타일 적용
      const finalProps = adaptPropsForElement(
        type,
        mergedProps,
        aiStyles,
        aiFills,
      );

      // 부모 결정
      let parentId: string | null = parentIdArg || null;
      if (!parentId) {
        if (selectedElementId) {
          parentId = selectedElementId;
        } else {
          const bodyElement = elements.find((el) => el.type === "body");
          if (bodyElement) {
            parentId = bodyElement.id;
          }
        }
      }

      // Element 생성
      const newElement: Element = {
        id: crypto.randomUUID(),
        type,
        props: finalProps,
        parent_id: parentId,
        page_id: currentPageId || "default",
        dataBinding: undefined,
      } as Element;

      // dataBinding 처리
      if (dataBindingArg?.endpoint) {
        newElement.dataBinding = {
          type: "collection",
          source: "api",
          config: {
            baseUrl: "MOCK_DATA",
            endpoint: dataBindingArg.endpoint,
            params: {},
            dataMapping: {
              idField: "id",
              labelField: "name",
            },
          },
        };
      }

      await addElement(newElement);

      // ADR-131 Phase 8 (2026-05-13): root collection data sync 제거.
      // data SSOT 는 `data_tables` / `api_endpoints` / `variables`.
      // Element.dataBinding 은 element 별 binding reference 로 유지.

      // G.3 시각 피드백: 생성 완료 flash
      useAIVisualFeedbackStore.getState().addFlashForNode(newElement.id, {
        scanLine: true,
      });

      return {
        success: true,
        data: {
          elementId: newElement.id,
          type,
          parentId,
        },
        affectedElementIds: [newElement.id],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

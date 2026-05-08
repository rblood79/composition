/**
 * get_editor_state Tool
 *
 * 현재 에디터 상태를 조회하여 AI에게 컨텍스트를 제공
 */

import type {
  ToolExecutor,
  ToolExecutionResult,
} from "../../../types/integrations/ai.types";
import { getAiToolReadModel } from "./canonicalToolReadModel";

export const getEditorStateTool: ToolExecutor = {
  name: "get_editor_state",

  async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const includeStyles = args.includeStyles !== false;
    const maxDepth = typeof args.maxDepth === "number" ? args.maxDepth : 5;

    try {
      const {
        childrenByParent,
        elements,
        state: { currentPageId, pages, selectedElementId },
      } = getAiToolReadModel();

      // 현재 페이지 요소만 필터
      const pageElements = elements.filter(
        (el) => el.page_id === currentPageId,
      );

      // 트리 구조로 변환
      const buildTree = (parentId: string | null, depth: number): unknown[] => {
        if (depth > maxDepth) return [];

        const children = parentId
          ? childrenByParent.get(parentId) || []
          : pageElements.filter(
              (el) => el.parent_id === null || el.type === "body",
            );

        return children.map((child) => {
          const node: Record<string, unknown> = {
            id: child.id,
            type: child.type,
          };

          // 주요 props만 포함 (토큰 절약)
          const propKeys = Object.keys(child.props || {}).filter(
            (k) => k !== "style",
          );
          if (propKeys.length > 0) {
            node.props = propKeys;
          }

          if (includeStyles && child.props?.style) {
            const styleKeys = Object.keys(
              child.props.style as Record<string, unknown>,
            );
            if (styleKeys.length > 0) {
              node.styleKeys = styleKeys;
            }
          }

          const childNodes = buildTree(child.id, depth + 1);
          if (childNodes.length > 0) {
            node.children = childNodes;
          }

          return node;
        });
      };

      const tree = buildTree(null, 0);

      return {
        success: true,
        data: {
          currentPageId,
          selectedElementId: selectedElementId || null,
          totalElements: pageElements.length,
          pages: pages?.map((p) => ({ id: p.id, title: p.title })) || [],
          tree,
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

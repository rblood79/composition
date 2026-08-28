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
import { readCanonicalFields } from "./canonicalNodeFields";
import { useCanonicalDocumentStore } from "../../../builder/stores/canonical/canonicalDocumentStore";

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

          // ADR-134 Phase 3 — canonical 1차 필드를 트리에 노출 (frame/slot/reusable)
          const canonical = readCanonicalFields(child.id);
          if (canonical) {
            node.canonical = canonical;
          }

          const childNodes = buildTree(child.id, depth + 1);
          if (childNodes.length > 0) {
            node.children = childNodes;
          }

          return node;
        });
      };

      const tree = buildTree(null, 0);

      // ADR-158 `InteractionRule` root collection — dormant `SerializedEvent` /
      // root `actions` 는 싣지 않는다 (ADR-134 R6).
      const canonicalStore = useCanonicalDocumentStore.getState();
      const activeDoc = canonicalStore.currentProjectId
        ? canonicalStore.documents.get(canonicalStore.currentProjectId)
        : undefined;
      const interactionRules = (activeDoc?.events ?? []).map((rule) => ({
        id: rule.id,
        elementId: rule.elementId,
        trigger: rule.trigger,
        actionKind: rule.action?.kind,
      }));

      return {
        success: true,
        data: {
          currentPageId,
          selectedElementId: selectedElementId || null,
          totalElements: pageElements.length,
          pages: pages?.map((p) => ({ id: p.id, title: p.title })) || [],
          tree,
          interactionRules,
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

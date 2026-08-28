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
import {
  applyCanonicalFields,
  parseCanonicalFields,
} from "./canonicalNodeFields";

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
      { endpoint?: string } | undefined;
    // ADR-134 Phase 3: canonical 1차 필드 (clip / placeholder / slot / reusable)
    const { patch: canonicalPatch, rejected: canonicalRejected } =
      parseCanonicalFields(args.canonical, type);

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

      // ADR-159 P4b: 구 Mock API dataBinding 생성 제거 — 데이터 소스는 dataTable(collection)
      //   단일. endpoint 인자는 무시하고 경고만 남긴다 (신규 api 바인딩 유입 차단, §5-1).
      if (dataBindingArg?.endpoint) {
        console.warn(
          `[AI createElement] dataBinding.endpoint("${dataBindingArg.endpoint}") 는 더 이상 지원하지 않음 — collections(dataTable) 바인딩을 사용하세요 (ADR-159 P4b)`,
        );
      }

      await addElement(newElement);

      // 1차 필드는 생성 직후 canonical patch — facade 가 legacy props 를 다루므로
      // schema 필드는 store action 을 직접 경유한다 (breakdown §5 Phase 3 산출물).
      const canonicalApplied = applyCanonicalFields(
        newElement.id,
        canonicalPatch,
      );

      // ADR-131 Phase 8 (2026-05-13): root collection data sync 제거.
      // data SSOT 는 `collections` / `api_endpoints` / `variables`.
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
          ...(canonicalApplied ? { canonical: canonicalPatch } : {}),
          ...(canonicalRejected.length > 0 ? { canonicalRejected } : {}),
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

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
import {
  applyCanonicalFields,
  parseCanonicalFields,
} from "./canonicalNodeFields";
import { resolveElementRef } from "./elementRef";

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

    const canonicalArg = args.canonical;

    if (
      Object.keys(newProps).length === 0 &&
      Object.keys(newStyles).length === 0 &&
      (!newFills || newFills.length === 0) &&
      canonicalArg == null
    ) {
      return {
        success: false,
        error: "변경할 props, styles, fills 또는 canonical 필드를 지정하세요.",
      };
    }

    try {
      const {
        elementsById,
        state: { selectedElementId, updateElementProps },
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

      // ADR-134 Phase 3 — canonical 1차 필드는 schema 쪽이라 store action 직접 경유.
      // 노드 타입을 알아야 frame 전용 필드를 판정할 수 있으므로 요소 확인 뒤에 파싱한다.
      const { patch: canonicalPatch, rejected: canonicalRejected } =
        parseCanonicalFields(canonicalArg, element.type);

      if (Object.keys(updates).length > 0) {
        await updateElementProps(targetId, updates);
      }
      const canonicalApplied = applyCanonicalFields(targetId, canonicalPatch);

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
          ...(canonicalApplied ? { canonical: canonicalPatch } : {}),
          ...(canonicalRejected.length > 0 ? { canonicalRejected } : {}),
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

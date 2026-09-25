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
import { getAiToolReadModel } from "./canonicalToolReadModel";
import { confirmStructuralOriginImpact } from "../../../builder/stores/utils/elementUpdate";
import { resolveElementRef } from "./elementRef";
import {
  canOperate,
  getOperationRejectMessageKey,
} from "../../../builder/domain/canOperate";

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
        state: { removeElement, selectedElementId },
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

      // 구조 변경 판정 (ADR-236 Phase 3 — 메뉴 · 단축키 · Layers 와 같은 `canOperate`). body 는 전용 문구,
      // systemOwned origin · ListBox template anchor 는 store 가 지우지 않으므로 여기서 이유와 함께 거부한다.
      const verdict = canOperate("delete", targetId, (id) =>
        elementsById.get(id),
      );
      if (!verdict.ok) {
        switch (verdict.reason) {
          case "body":
            return { success: false, error: t("aiToolError.bodyUndeletable") };
        }
        const messageKey = getOperationRejectMessageKey(verdict.reason);
        return {
          success: false,
          error: messageKey
            ? t(messageKey)
            : t("aiToolError.notDeleted", { id: targetId }),
        };
      }

      // origin 안 삭제는 모든 instance 를 바꾼다 — 편집과 같은 영향 확인 (ADR-236 E4).
      const impactGate = confirmStructuralOriginImpact([targetId]);
      if (impactGate !== true && !(await impactGate)) {
        return { success: false, error: t("aiToolError.originImpactCancelled") };
      }

      await removeElement(targetId);

      // 반영 확인 — `removeElement` 도 반환값이 없다 (`mutationVerification.ts` 주석).
      const remaining = getAiToolReadModel().elementsById.get(targetId);
      if (remaining && !remaining.deleted) {
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

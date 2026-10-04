/**
 * update_element Tool
 *
 * 기존 요소의 속성/스타일 수정 (AIPanel.tsx의 executeIntent modify case 추출)
 */

import { resolveSubpartStyleOwnerType } from "@composition/shared";
import type {
  ToolExecutionResult,
  ToolExecutor,
  ToolTranslate,
} from "../../../types/integrations/ai.types";
import { useAIVisualFeedbackStore } from "../../../builder/stores/aiVisualFeedback";
import { getAiToolReadModel } from "./aiToolReadModel";
import { AI_WRITE_HOST_MISSING, getAiWriteHost } from "../aiWriteHost";
import { parseCanonicalFields } from "./canonicalNodeFields";
import { normalizeToolFills } from "./toolFills";
import { resolveElementRef } from "./elementRef";
import {
  findUnappliedProps,
  findUnappliedStyles,
} from "./mutationVerification";

/** The type that owns the element's style (a delegated sub-part), else null. */
function subpartStyleOwnerOf(
  id: string,
  elementsById: ReadonlyMap<
    string,
    { type: string; parent_id?: string | null }
  >,
): string | null {
  const self = elementsById.get(id);
  const parent = self?.parent_id ? elementsById.get(self.parent_id) : undefined;
  if (!self || !parent) return null;
  const grandparent = parent.parent_id
    ? elementsById.get(parent.parent_id)
    : undefined;
  return resolveSubpartStyleOwnerType(
    self.type,
    parent.type,
    grandparent?.type,
  );
}

export const updateElementTool: ToolExecutor = {
  name: "update_element",

  async execute(
    args: Record<string, unknown>,
    t: ToolTranslate,
  ): Promise<ToolExecutionResult> {
    const elementIdArg = args.elementId as string;
    if (!elementIdArg) {
      return { success: false, error: t("aiToolError.elementIdRequired") };
    }

    const newProps = (args.props || {}) as Record<string, unknown>;
    const newStyles = (args.styles || {}) as Record<string, unknown>;
    const newFills = normalizeToolFills(args.fills);

    const canonicalArg = args.canonical;

    if (
      Object.keys(newProps).length === 0 &&
      Object.keys(newStyles).length === 0 &&
      newFills === undefined &&
      canonicalArg == null
    ) {
      return {
        success: false,
        error: t("aiToolError.nothingToUpdate"),
      };
    }

    try {
      const {
        elementsById,
        state: { selectedElementId },
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

      // 위임 sub-part (TextField 의 Label 등) 의 style 은 owner rule 이 정한다 — 쓰면 layout · Skia · DOM
      //   이 모두 무시하고 성공만 보고된다. 캔버스 resize · spacing 과 같은 판정 (ADR-236 Phase 3, A-2).
      //   ADR-248 4e-7: judged on the read model's chain (self · parent · grandparent types) — the
      //   old store's synthetic-child lookup is the old store host's (`aiHosts.store.ts`).
      if (
        (Object.keys(newStyles).length > 0 || newFills) &&
        subpartStyleOwnerOf(targetId, elementsById)
      ) {
        return {
          success: false,
          error: t("aiToolError.subpartStyleOwned", { id: targetId }),
        };
      }

      // ADR-134 Phase 3 — canonical 1차 필드는 schema 쪽이라 store action 직접 경유.
      // 노드 타입을 알아야 frame 전용 필드를 판정할 수 있으므로 요소 확인 뒤에 파싱한다.
      const { patch: canonicalPatch, rejected: canonicalRejected } =
        parseCanonicalFields(t, canonicalArg, element.type);

      // ADR-248 4e-5: the open Builder writes (one step) — the canonical first-class fields too
      // (a node that becomes a component is its instance from then on). 4e-7: only the host.
      const writeHost = getAiWriteHost();
      if (!writeHost) return { success: false, error: AI_WRITE_HOST_MISSING };
      const written = await writeHost.update(
        targetId,
        {
          props: newProps,
          styles: newStyles,
          ...(newFills !== undefined ? { fills: newFills } : {}),
          ...(Object.keys(canonicalPatch).length
            ? { canonical: canonicalPatch }
            : {}),
        },
        t,
      );
      if (!written.ok) return { success: false, error: written.error };
      const canonicalApplied =
        written.canonicalApplied ?? Object.keys(canonicalPatch).length > 0;
      const resultId = written.elementId;

      // 반영 확인 — 스토어 액션은 반환값이 없고 조용히 return 하는 경로가 여럿이다
      // (`mutationVerification.ts` 주석). 확인 없이 성공을 보고하면 모델이 반영됐다는
      // 전제로 다음 단계를 쌓는다.
      const verified = getAiToolReadModel().elementsById.get(resultId);
      if (!verified) {
        return {
          success: false,
          error: t("aiToolError.missingAfterUpdate", { id: resultId }),
        };
      }

      const unapplied = [
        ...findUnappliedProps(
          { ...verified.props, fills: verified.fills ?? [] },
          { ...newProps, ...(newFills ? { fills: newFills } : {}) },
        ),
        ...findUnappliedStyles(verified.props?.style, newStyles),
      ];
      if (unapplied.length > 0) {
        return {
          success: false,
          error: t("aiToolError.notApplied", { fields: unapplied.join(", ") }),
        };
      }

      const canonicalKeys = Object.keys(canonicalPatch);
      if (canonicalKeys.length > 0 && !canonicalApplied) {
        return {
          success: false,
          error: t("aiToolError.canonicalNotApplied", {
            fields: canonicalKeys.join(", "),
            type: element.type,
          }),
        };
      }

      // G.3 시각 피드백: 수정 완료 flash
      useAIVisualFeedbackStore.getState().addFlashForNode(resultId, {
        strokeWidth: 1,
      });

      return {
        success: true,
        data: {
          elementId: resultId,
          type: element.type,
          updatedProps: Object.keys(newProps),
          updatedStyles: Object.keys(newStyles),
          ...(canonicalApplied ? { canonical: canonicalPatch } : {}),
          ...(canonicalRejected.length > 0 ? { canonicalRejected } : {}),
        },
        affectedElementIds: [resultId],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

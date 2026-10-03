/**
 * create_element Tool
 *
 * 캔버스에 새 요소를 생성 (AIPanel.tsx의 executeIntent create case 추출)
 */

import type {
  ToolExecutionResult,
  ToolExecutor,
  ToolTranslate,
} from "../../../types/integrations/ai.types";
import { useAIVisualFeedbackStore } from "../../../builder/stores/aiVisualFeedback";
import { getAiToolReadModel } from "./canonicalToolReadModel";
import { AI_WRITE_HOST_MISSING, getAiWriteHost } from "../aiWriteHost";
import { parseCanonicalFields } from "./canonicalNodeFields";
import {
  findUnappliedProps,
  findUnappliedStyles,
} from "./mutationVerification";
import { normalizeToolFills } from "./toolFills";
import { rememberCreatedElement } from "./elementRef";

export const createElementTool: ToolExecutor = {
  name: "create_element",

  async execute(
    args: Record<string, unknown>,
    t: ToolTranslate,
  ): Promise<ToolExecutionResult> {
    const type = args.type as string;
    if (!type) {
      return { success: false, error: t("aiToolError.typeRequired") };
    }

    const aiProps = (args.props || {}) as Record<string, unknown>;
    const aiStyles = (args.styles || {}) as Record<string, unknown>;
    const aiFills = normalizeToolFills(args.fills);
    const parentIdArg = args.parentId as string | undefined;
    const dataBindingArg = args.dataBinding as
      { endpoint?: string } | undefined;
    // ADR-134 Phase 3: canonical 1차 필드 (clip / placeholder / slot / reusable)
    const { patch: canonicalPatch, rejected: canonicalRejected } =
      parseCanonicalFields(t, args.canonical, type);

    // ADR-159 P4b: 구 Mock API dataBinding 생성 제거 — 데이터 소스는 dataTable(collection)
    //   단일. endpoint 인자는 무시하고 경고만 남긴다 (신규 api 바인딩 유입 차단, §5-1).
    if (dataBindingArg?.endpoint) {
      console.warn(
        `[AI createElement] dataBinding.endpoint("${dataBindingArg.endpoint}") 는 더 이상 지원하지 않음 — collections(dataTable) 바인딩을 사용하세요 (ADR-159 P4b)`,
      );
    }

    try {
      // ADR-248 4e-5: the open Builder adds it (one step, its own nesting checks) — 4e-7: only
      // the host (the old store's palette branch is the old store host's, `aiHosts.store.ts`).
      const writeHost = getAiWriteHost();
      if (!writeHost) return { success: false, error: AI_WRITE_HOST_MISSING };
      const canonicalApplied = Object.keys(canonicalPatch).length > 0;
      const written = await writeHost.create(
        {
          type,
          props: aiProps,
          styles: aiStyles,
          ...(aiFills ? { fills: aiFills } : {}),
          ...(canonicalApplied ? { canonical: canonicalPatch } : {}),
          parentId: parentIdArg ?? null,
        },
        t,
      );
      if (!written.ok) return { success: false, error: written.error };

      // 반영 확인 — 쓰기가 조용히 빠지는 경로가 있다 (`mutationVerification.ts` 주석).
      const verified = getAiToolReadModel().elementsById.get(written.elementId);
      if (!verified)
        return {
          success: false,
          error: t("aiToolError.missingAfterUpdate", { id: written.elementId }),
        };
      const missing = [
        ...findUnappliedProps(
          { ...verified.props, fills: verified.fills ?? [] },
          { ...aiProps, ...(aiFills ? { fills: aiFills } : {}) },
        ),
        ...findUnappliedStyles(verified.props?.style, aiStyles),
      ];
      if (missing.length)
        return {
          success: false,
          error: t("aiToolError.notApplied", { fields: missing.join(", ") }),
        };

      // G.3 시각 피드백: 생성 완료 flash
      useAIVisualFeedbackStore
        .getState()
        .addFlashForNode(written.elementId, { scanLine: true });
      // 다음 도구가 UUID 를 이어 나르지 않고 "last-created" 로 집을 수 있게 한다.
      rememberCreatedElement(written.elementId);

      return {
        success: true,
        data: {
          elementId: written.elementId,
          type,
          parentId: written.parentId,
          ...(written.composite ? { composite: written.composite } : {}),
          ...(canonicalApplied ? { canonical: canonicalPatch } : {}),
          ...(canonicalRejected.length > 0 ? { canonicalRejected } : {}),
        },
        affectedElementIds: [written.elementId],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

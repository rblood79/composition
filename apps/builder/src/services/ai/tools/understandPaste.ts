/**
 * understand_paste Tool — 붙여넣기 이해 (ADR-213 Phase 6, AI-2).
 *
 * 한 입력 (`text`) 으로 cURL · JSON 샘플 · 표 텍스트를 받는다. **규칙 파서 먼저**
 * (`buildPasteProposal` — Phase 5 `data.importPaste` 와 같은 순수 함수): cURL →
 * `define_endpoint`, 행 → `create_collection` (스키마 추론) 또는 기존 collection `insert_rows`.
 * 파싱이 되면 바로 승인 경로 (`dispatchDataProposal`, diff 다이얼로그 = 미리보기) 로 간다.
 *
 * 규칙 파서가 실패하면 **모델 폴백**: 적용 0 · 이유와 안내를 돌려주고 모델이 텍스트에서
 * 구조를 읽어 `create_table_from_description` (스키마 + 규칙) 또는 `propose_data_change`
 * (텍스트에 있는 행 그대로) 로 제안한다 — 어느 쪽도 같은 승인 경로다.
 *
 * tool 결과는 다음 turn 의 provider payload 에 실린다 — cURL 초안은 header/query **키만**
 * 돌려주고 URL 은 공유 redactor (`redactUrl`) 를 지난다 (HC5). 붙여넣은 원문은 사용자가
 * 이미 대화에 넣은 것이라 새로 노출하는 secret 은 없지만 경계는 같다.
 */
import type {
  ToolExecutionResult,
  ToolExecutor,
  ToolTranslate,
} from "../../../types/integrations/ai.types";
import { dispatchDataProposal } from "../data/dataProposalDispatcher";
import { getDataToolReadModel } from "../data/dataToolReadModel";
import { buildPasteProposal } from "../data/pasteProposal";
import { redactUrl } from "../security/redactEndpointAuth";

const PREVIEW_ROWS = 3;

export const understandPasteTool: ToolExecutor = {
  name: "understand_paste",

  async execute(
    args: Record<string, unknown>,
    t: ToolTranslate,
  ): Promise<ToolExecutionResult> {
    const text = typeof args.text === "string" ? args.text : "";
    if (!text.trim()) {
      return { success: false, error: t("aiToolError.pasteTextRequired") };
    }
    try {
      const { collections } = getDataToolReadModel();
      const built = buildPasteProposal(text, {
        name: typeof args.name === "string" ? args.name : undefined,
        collectionId:
          typeof args.collectionId === "string" && args.collectionId
            ? args.collectionId
            : undefined,
        collections: collections.map((c) => ({ id: c.id, name: c.name })),
      });

      if (built.kind === "error") {
        if (built.reason === "name-required") {
          return { success: false, error: t("aiToolError.pasteNameRequired") };
        }
        if (built.reason === "collection-not-found") {
          return {
            success: false,
            error: t("aiToolError.collectionNotFound", {
              ref: String(args.collectionId ?? ""),
              names: collections.map((c) => c.name).join(", "),
            }),
          };
        }
        // 모델 폴백 — 적용 0
        return {
          success: true,
          data: {
            parsed: false,
            reason: built.reason,
            guidance: t("aiPrompt.pasteFallbackGuidance"),
          },
        };
      }

      const label =
        built.kind === "endpoint"
          ? t("aiDataProposal.importCurlLabel", { name: built.draft.name })
          : t("aiDataProposal.importPasteLabel", {
              count: built.rows.length,
              format: built.format,
            });
      const result = await dispatchDataProposal(
        { ops: built.ops, label, host: "ai-panel", origin: "ai" },
        t,
      );
      if (result.status === "invalid") {
        return { success: false, error: result.errors.join("; ") };
      }
      if (result.status === "rejected") {
        return { success: false, error: t("aiDataProposal.rejected") };
      }

      if (built.kind === "endpoint") {
        // 값은 돌려주지 않는다 (키만) — URL 은 공유 redactor 를 지난다
        const { draft } = built;
        return {
          success: true,
          data: {
            parsed: true,
            kind: "endpoint",
            status: "applied",
            endpoint: {
              name: draft.name,
              method: draft.method,
              baseUrl: redactUrl(draft.baseUrl),
              path: redactUrl(draft.path),
              headerKeys: draft.headers.map((h) => h.key),
              queryKeys: draft.queryParams.map((q) => q.key),
              bodyType: draft.bodyType,
            },
            historyId: result.historyId ?? null,
          },
        };
      }
      return {
        success: true,
        data: {
          parsed: true,
          kind: "rows",
          status: "applied",
          format: built.format,
          target: built.target,
          schema: built.schema,
          rowCount: built.rows.length,
          preview: built.rows.slice(0, PREVIEW_ROWS),
          historyId: result.historyId ?? null,
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

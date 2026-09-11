/**
 * create_table_from_description Tool — "설명으로 테이블 만들기" (ADR-213 Phase 6, AI-1).
 *
 * 모델은 **스키마 + 샘플 행 생성 규칙** (`TableSpec`, 구조화 인자) 만 낸다. 샘플 행은 코드가
 * 만들고 (`generateSampleRows`) 같은 규칙으로 검증한다 (`validateSampleRows` — 스키마에 없는
 * 컬럼 0 · enum 정합 · FK 는 기존 collection 행에서, I3). 그 다음 다른 쓰기와 **같은** 승인
 * 경로 (`dispatchDataProposal` — diff 다이얼로그가 스키마 표 + 샘플 행을 보여 주는 미리보기)
 * 를 지나 `create_collection` 하나로 적용된다. 여기서 적용기를 직접 부르지 않는다 (HC1 · R7).
 *
 * 거부 = "수정 요청" — 모델은 사용자의 지적을 받아 spec 을 고쳐 다시 부른다 (AI-4 와 같은
 * 반복). 이미 있는 이름이면 만들지 않고 안내한다 — 그 테이블을 고치는 건 `propose_data_change`
 * 의 update 계열 (AI-4).
 */
import type { DataOp } from "@composition/shared";
import type {
  ToolExecutionResult,
  ToolExecutor,
  ToolTranslate,
} from "../../../types/integrations/ai.types";
import { dispatchDataProposal } from "../data/dataProposalDispatcher";
import {
  findCollection,
  getDataToolReadModel,
} from "../data/dataToolReadModel";
import {
  TableSpecSchema,
  generateSampleRows,
  tableSpecToSchema,
  validateSampleRows,
  type SampleGenerationContext,
  type TableSpec,
} from "../data/tableSpec";

const PREVIEW_ROWS = 5;

/** preset 카탈로그의 locale 풀 (`presetData.*`) — 쉼표+공백 구분 계약 */
function poolsFrom(t: ToolTranslate): SampleGenerationContext["pools"] {
  const pool = (key: string): string[] | undefined => {
    const text = t(`presetData.${key}`);
    return text && text !== `presetData.${key}`
      ? text.split(", ").filter(Boolean)
      : undefined;
  };
  return {
    firstNames: pool("firstNames"),
    lastNames: pool("lastNames"),
    companies: pool("companies"),
  };
}

/** 순수 — spec → (행 · 검증 · op). 오류는 문자열 목록. */
export function buildCreateTableProposal(
  input: unknown,
  ctx: SampleGenerationContext & {
    existingNames: readonly string[];
    t: ToolTranslate;
  },
):
  | { ops: DataOp[]; spec: TableSpec; rows: Record<string, unknown>[] }
  | { errors: string[] } {
  const parsed = TableSpecSchema.safeParse(input);
  if (!parsed.success) {
    return {
      errors: parsed.error.issues.map((issue) =>
        issue.path.length
          ? `${issue.path.join(".")}: ${issue.message}`
          : issue.message,
      ),
    };
  }
  const spec = parsed.data;
  const taken = ctx.existingNames.some(
    (name) => name.toLowerCase() === spec.name.toLowerCase(),
  );
  if (taken) {
    return {
      errors: [ctx.t("aiToolError.collectionNameExists", { name: spec.name })],
    };
  }
  const rows = generateSampleRows(spec, ctx);
  const issues = validateSampleRows(spec, rows, ctx);
  if (issues.length > 0) {
    return {
      errors: issues.map(
        (issue) => `row ${issue.row} · ${issue.key}: ${issue.reason}`,
      ),
    };
  }
  return {
    spec,
    rows,
    ops: [
      {
        op: "create_collection",
        name: spec.name,
        ...(spec.description ? { description: spec.description } : {}),
        schema: tableSpecToSchema(spec),
        rows,
        source: "manual",
      },
    ],
  };
}

export const createTableFromDescriptionTool: ToolExecutor = {
  name: "create_table_from_description",

  async execute(
    args: Record<string, unknown>,
    t: ToolTranslate,
  ): Promise<ToolExecutionResult> {
    try {
      const { collections } = getDataToolReadModel();
      const built = buildCreateTableProposal(args, {
        collections: collections.map((c) => ({
          id: c.id,
          name: c.name,
          rows: c.mockData ?? [],
        })),
        pools: poolsFrom(t),
        existingNames: collections.map((c) => c.name),
        t,
      });
      if ("errors" in built) {
        return { success: false, error: built.errors.join("; ") };
      }
      const { spec, rows, ops } = built;
      const result = await dispatchDataProposal(
        {
          ops,
          label: t("aiDataProposal.createTableLabel", {
            name: spec.name,
            fields: spec.fields.length,
            rows: rows.length,
          }),
          host: "ai-panel",
          origin: "ai",
        },
        t,
      );
      if (result.status === "invalid") {
        return { success: false, error: result.errors.join("; ") };
      }
      if (result.status === "rejected") {
        return {
          success: false,
          error: t("aiDataProposal.createTableRejected"),
        };
      }
      const created = findCollection(getDataToolReadModel().collections, {
        name: spec.name,
      });
      return {
        success: true,
        data: {
          status: "applied",
          collectionId: created?.id ?? null,
          name: spec.name,
          fieldCount: spec.fields.length,
          rowCount: rows.length,
          preview: rows.slice(0, PREVIEW_ROWS),
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

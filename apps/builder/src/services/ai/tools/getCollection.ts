/**
 * get_collection Tool — collection 1개의 스키마 + 샘플 행 (ADR-213 Phase 1, 읽기).
 *
 * 참조는 `collectionId` 우선 · `name` fallback (152 `resolveBoundCollection` 과 같은
 * 순서). `sampleRows` 는 0..5 로 고정한다 — 행 전량을 모델에 싣는 tool 은 없다 (I7).
 */
import type {
  ToolExecutionResult,
  ToolExecutor,
} from "../../../types/integrations/ai.types";
import {
  summarizeCollections,
  visibleRowCount,
} from "../data/collectionReadModel";
import { findCollection, getDataToolReadModel } from "../data/dataToolReadModel";
import { readFormat } from "./listCollections";

export const SAMPLE_ROWS_MAX = 5;
const SAMPLE_ROWS_DEFAULT = 3;

function clampSampleRows(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return SAMPLE_ROWS_DEFAULT;
  }
  return Math.max(0, Math.min(SAMPLE_ROWS_MAX, Math.floor(value)));
}

export const getCollectionTool: ToolExecutor = {
  name: "get_collection",

  async execute(args, t): Promise<ToolExecutionResult> {
    const hasRef =
      (typeof args.collectionId === "string" && args.collectionId) ||
      (typeof args.name === "string" && args.name);
    if (!hasRef) {
      return { success: false, error: t("aiToolError.collectionRefRequired") };
    }

    try {
      const { collections, usage } = getDataToolReadModel();
      const table = findCollection(collections, args);
      if (!table) {
        return {
          success: false,
          error: t("aiToolError.collectionNotFound", {
            ref: String(args.collectionId ?? args.name),
            names: collections.map((c) => c.name).join(", "),
          }),
        };
      }

      // format 은 sample 만 좌우한다 — 스키마는 op 작성에 전부 필요하다 (required · label).
      const rows = table.useMockData
        ? (table.mockData ?? [])
        : (table.runtimeData ?? []);
      const [summary] = summarizeCollections([table], usage);

      return {
        success: true,
        data: {
          ...summary,
          ...(table.description ? { description: table.description } : {}),
          rowCount: visibleRowCount(table),
          schema: table.schema.map((field) => ({
            id: field.id,
            key: field.key,
            type: field.type,
            ...(field.label !== undefined ? { label: field.label } : {}),
            ...(field.required !== undefined
              ? { required: field.required }
              : {}),
            ...(field.defaultValue !== undefined
              ? { defaultValue: field.defaultValue }
              : {}),
          })),
          sample:
            readFormat(args) === "concise"
              ? rows.slice(0, clampSampleRows(args.sampleRows))
              : rows.slice(0, SAMPLE_ROWS_MAX),
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

/**
 * list_collections Tool — 프로젝트의 collection 요약 (ADR-213 Phase 1, 읽기).
 *
 * `format: "concise"` (기본) 는 id · name · fieldCount · rowCount · source · usedBy,
 * `"detailed"` 는 fields (id · key · type) 를 더한다. 행은 싣지 않는다 (I7 —
 * `get_collection.sampleRows` ≤ 5 만).
 */
import type {
  ToolExecutionResult,
  ToolExecutor,
} from "../../../types/integrations/ai.types";
import { summarizeCollections } from "../data/collectionReadModel";
import { getDataToolReadModel } from "../data/dataToolReadModel";

export type ReadFormat = "concise" | "detailed";

export function readFormat(args: Record<string, unknown>): ReadFormat {
  return args.format === "detailed" ? "detailed" : "concise";
}

export const listCollectionsTool: ToolExecutor = {
  name: "list_collections",

  async execute(args): Promise<ToolExecutionResult> {
    try {
      const { collections, usage } = getDataToolReadModel();
      const summaries = summarizeCollections(collections, usage);
      if (readFormat(args) === "concise") {
        return { success: true, data: summaries };
      }
      const byId = new Map(collections.map((c) => [c.id, c]));
      return {
        success: true,
        data: summaries.map((summary) => ({
          ...summary,
          ...(byId.get(summary.id)?.description
            ? { description: byId.get(summary.id)!.description }
            : {}),
          fields: (byId.get(summary.id)?.schema ?? []).map((field) => ({
            id: field.id,
            key: field.key,
            type: field.type,
          })),
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

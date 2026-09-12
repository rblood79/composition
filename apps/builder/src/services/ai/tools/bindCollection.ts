/**
 * bind_collection Tool — compatibility alias (ADR-213 Phase 2, AX-3).
 *
 * ADR-134 Phase 4 의 원형은 `{ elementId, source: static|api, config }` 를 받아
 * `applyCanonicalExtensionPatch` 로 **즉시** 썼다 — 승인 0 · History 0 · 사람 UI 형상
 * (`{ source:"dataTable", collectionId, name }`) 과 다른 형태라 이미 있는 DataTable 에
 * 요소를 잇는 경로가 없었다 (리서치 §1-6).
 *
 * 지금은 입력을 `bind_element` DataChange 로 정규화한 뒤 **같은 proposal dispatcher**
 * (`dispatchDataProposal` — 승인 diff → executor origin stamp → 152 적용기 → History 1)
 * 를 지난다. 직접 적용 경로는 없다 (HC1 · R7).
 *
 * 입력:
 * - 정상: `{ elementId | elementRef, collectionId | collectionName, fieldMap? }`
 * - legacy `source:"static"` + `config.data[]`: 행을 새 collection 으로 만들고 (스키마
 *   추론) 잇는다 — `create_collection` + `bind_element` 한 묶음 (승인 1회)
 * - legacy `source:"api"`: 정의는 endpoint 축이라 Phase 4 (`define_endpoint`)
 *   전까지 안내만 돌려준다
 */
import type { DataOp } from "@composition/shared";
import type {
  ToolExecutionResult,
  ToolExecutor,
  ToolTranslate,
} from "../../../types/integrations/ai.types";
import {
  columnsToSchema,
  detectColumns,
} from "../../../builder/panels/datatable/utils/columnDetector";
import { dispatchDataProposal } from "../data/dataProposalDispatcher";
import {
  findCollection,
  getDataToolReadModel,
} from "../data/dataToolReadModel";
import { getAiToolReadModel } from "./canonicalToolReadModel";
import { resolveElementRef } from "./elementRef";

type FieldMap = { value?: string; icon?: string };

function readFieldMap(value: unknown): FieldMap | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const record = value as Record<string, unknown>;
  const out: FieldMap = {};
  if (typeof record.value === "string") out.value = record.value;
  if (typeof record.icon === "string") out.icon = record.icon;
  return Object.keys(out).length > 0 ? out : undefined;
}

/** 입력 → `DataOp[]` (순수). 오류는 문자열로. */
export function normalizeBindCollectionArgs(
  args: Record<string, unknown>,
  context: {
    elementId: string;
    collections: Parameters<typeof findCollection>[0];
    t: ToolTranslate;
  },
): { ops: DataOp[]; collectionName: string } | { error: string } {
  const { elementId, collections, t } = context;
  const fieldMap = readFieldMap(args.fieldMap);
  const source = args.source;

  // legacy static — 인라인 행을 collection 으로 승격해 잇는다
  if (source === "static") {
    const config =
      args.config &&
      typeof args.config === "object" &&
      !Array.isArray(args.config)
        ? (args.config as Record<string, unknown>)
        : {};
    const rows = config.data;
    if (!Array.isArray(rows) || rows.length === 0) {
      return { error: t("aiToolError.staticNeedsData") };
    }
    const schema = columnsToSchema(detectColumns(rows));
    if (schema.length === 0) {
      return { error: t("aiToolError.staticNeedsData") };
    }
    const name =
      typeof args.collectionName === "string" && args.collectionName
        ? args.collectionName
        : typeof config.name === "string" && config.name
          ? config.name
          : `${elementId}-data`;
    const id = `col_${elementId}_${Date.now().toString(36)}`;
    return {
      collectionName: name,
      ops: [
        {
          op: "create_collection",
          id,
          name,
          schema,
          rows: rows as Record<string, unknown>[],
          source: "manual",
        },
        {
          op: "bind_element",
          elementId,
          collectionId: id,
          ...(fieldMap ? { fieldMap } : {}),
        },
      ],
    };
  }

  if (source === "api") {
    return { error: t("aiToolError.bindLegacySourceUnsupported") };
  }

  const target = findCollection(collections, {
    collectionId: args.collectionId,
    name: args.collectionName ?? args.name,
  });
  if (!target) {
    const ref = args.collectionId ?? args.collectionName ?? args.name;
    return {
      error: ref
        ? t("aiToolError.collectionNotFound", {
            ref: String(ref),
            names: collections.map((c) => c.name).join(", "),
          })
        : t("aiToolError.collectionRefRequired"),
    };
  }
  return {
    collectionName: target.name,
    ops: [
      {
        op: "bind_element",
        elementId,
        collectionId: target.id,
        ...(fieldMap ? { fieldMap } : {}),
      },
    ],
  };
}

export const bindCollectionTool: ToolExecutor = {
  name: "bind_collection",

  async execute(
    args: Record<string, unknown>,
    t: ToolTranslate,
  ): Promise<ToolExecutionResult> {
    const elementIdArg = (args.elementId ?? args.elementRef) as
      string | undefined;
    if (!elementIdArg) {
      return { success: false, error: t("aiToolError.elementIdRequired") };
    }

    try {
      const {
        elementsById,
        state: { selectedElementId },
      } = getAiToolReadModel();
      const ref = resolveElementRef(
        elementIdArg,
        { selectedElementId, elementsById },
        t,
      );
      if ("error" in ref) return { success: false, error: ref.error };
      const targetId = ref.id;
      const element = elementsById.get(targetId)!;

      const { collections } = getDataToolReadModel();
      const normalized = normalizeBindCollectionArgs(args, {
        elementId: targetId,
        collections,
        t,
      });
      if ("error" in normalized) {
        return { success: false, error: normalized.error };
      }

      const result = await dispatchDataProposal(
        {
          ops: normalized.ops,
          label: t("aiDataProposal.bindLabel", {
            type: element.type,
            collection: normalized.collectionName,
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
        return { success: false, error: t("aiDataProposal.rejected") };
      }
      return {
        success: true,
        data: {
          elementId: targetId,
          type: element.type,
          collection: normalized.collectionName,
          ops: normalized.ops.map((op) => op.op),
          historyId: result.historyId ?? null,
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

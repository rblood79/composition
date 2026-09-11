/**
 * 데이터 proposal 의 승인 diff 요약 — ADR-213 Phase 4 (AX-2 · R3 · R4).
 *
 * `DataOp[]` 를 사람이 읽는 항목으로 바꾼다 (순수 · 문구 없음 — 문구는 `DataChangeDiffView`
 * 가 i18n 으로 붙인다). 큰 `insert_rows` 는 수 + 샘플 3행 (R3), `update_field` 의 type 변경은
 * 152 역참조로 "사용처 N" 을 단다 (R4 — 사람 경로의 확인과 같은 정보).
 */
import type { DataOp } from "@composition/shared";
import { joinEndpointUrl } from "../tools/listApiEndpoints";

export const DIFF_SAMPLE_ROWS_MAX = 3;

export interface DataChangeSummaryContext {
  collections: readonly {
    id: string;
    name: string;
    schema: readonly { id?: string; key: string; type: string }[];
  }[];
  /** collectionId → 바인딩된 요소 수 (152 역참조) */
  usage: ReadonlyMap<string, number>;
  /** 존재하는 endpoint id — define_endpoint 의 신규/변경 판정 */
  endpointIds: ReadonlySet<string>;
  /** elementId → 요소 type (표시용) */
  elementTypes: ReadonlyMap<string, string>;
}

export interface CollectionRef {
  id: string | null;
  name: string;
  isNew: boolean;
}

export interface RowSample {
  keys: string[];
  rows: Record<string, unknown>[];
}

export type DataChangeSummaryItem =
  | {
      kind: "collection";
      op:
        | "create_collection"
        | "update_collection"
        | "delete_collection"
        | "set_source";
      collection: CollectionRef;
      fieldCount?: number;
      /** create_collection — 스키마 표 (미리보기, Phase 6 AI-1) */
      fields?: { key: string; type: string; required: boolean }[];
      rowCount?: number;
      sample?: RowSample;
      patch?: Record<string, unknown>;
      source?: string;
      endpointId?: string;
    }
  | {
      kind: "field";
      op: "add_field" | "update_field" | "remove_field";
      collection: CollectionRef;
      field: { key: string; type: string | null };
      patch?: Record<string, unknown>;
      typeChange?: { from: string | null; to: string };
      usedBy?: number;
    }
  | {
      kind: "rows";
      op: "insert_rows" | "replace_rows" | "remove_rows" | "set_cell";
      collection: CollectionRef;
      rowCount: number;
      sample?: RowSample;
      cell?: { rowIndex: number; key: string; value: unknown };
    }
  | {
      kind: "endpoint";
      op: "define_endpoint" | "delete_endpoint";
      endpoint: {
        id: string | null;
        name: string;
        method: string | null;
        url: string | null;
        isNew: boolean;
        headerKeys: string[];
      };
    }
  | {
      kind: "binding";
      op: "bind_element";
      element: { id: string; type: string | null };
      collection: { id: string; name: string } | null;
      fieldMap?: Record<string, string>;
    }
  | {
      kind: "variable";
      op: "define_variable";
      variableId: string | null;
      name: string | null;
      removed: boolean;
    };

export interface DataChangeSummary {
  items: DataChangeSummaryItem[];
  /** 영향 collection 별 사용처 (바인딩 요소 수 > 0 만) */
  usedBy: { id: string; name: string; count: number }[];
}

function sampleOf(
  rows: readonly Record<string, unknown>[],
  schemaKeys: readonly string[],
): RowSample {
  const seen = new Set(schemaKeys);
  const keys = [...schemaKeys];
  for (const row of rows.slice(0, DIFF_SAMPLE_ROWS_MAX)) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }
  return { keys, rows: rows.slice(0, DIFF_SAMPLE_ROWS_MAX) };
}

export function summarizeDataChange(
  ops: readonly DataOp[],
  ctx: DataChangeSummaryContext,
): DataChangeSummary {
  const byId = new Map(ctx.collections.map((c) => [c.id, c]));
  // 같은 proposal 안에서 만든 collection 은 뒤따르는 op 가 참조할 수 있다 (id 가 있을 때)
  const created = new Map<string, { name: string; keys: string[] }>();
  const touched = new Map<string, string>();

  const refOf = (collectionId: string): CollectionRef => {
    const existing = byId.get(collectionId);
    if (existing) {
      touched.set(existing.id, existing.name);
      return { id: existing.id, name: existing.name, isNew: false };
    }
    const fresh = created.get(collectionId);
    if (fresh) return { id: collectionId, name: fresh.name, isNew: true };
    return { id: collectionId, name: collectionId, isNew: false };
  };
  const keysOf = (collectionId: string): string[] =>
    byId.get(collectionId)?.schema.map((f) => f.key) ??
    created.get(collectionId)?.keys ??
    [];
  const fieldOf = (
    collectionId: string,
    fieldId: string,
  ): { key: string; type: string | null } => {
    const field = byId
      .get(collectionId)
      ?.schema.find((f) => f.id === fieldId || f.key === fieldId);
    return field
      ? { key: field.key, type: field.type }
      : { key: fieldId, type: null };
  };

  const items: DataChangeSummaryItem[] = [];
  for (const op of ops) {
    switch (op.op) {
      case "create_collection": {
        const keys = op.schema.map((f) => f.key);
        if (op.id) created.set(op.id, { name: op.name, keys });
        items.push({
          kind: "collection",
          op: op.op,
          collection: { id: op.id ?? null, name: op.name, isNew: true },
          fieldCount: op.schema.length,
          fields: op.schema.map((f) => ({
            key: f.key,
            type: f.type,
            required: f.required === true,
          })),
          rowCount: op.rows?.length ?? 0,
          ...(op.rows && op.rows.length > 0
            ? { sample: sampleOf(op.rows, keys) }
            : {}),
        });
        break;
      }
      case "update_collection":
        items.push({
          kind: "collection",
          op: op.op,
          collection: refOf(op.collectionId),
          patch: op.patch,
        });
        break;
      case "delete_collection":
        items.push({
          kind: "collection",
          op: op.op,
          collection: refOf(op.collectionId),
        });
        break;
      case "set_source":
        items.push({
          kind: "collection",
          op: op.op,
          collection: refOf(op.collectionId),
          source: op.source,
          ...(op.endpointId ? { endpointId: op.endpointId } : {}),
        });
        break;
      case "add_field":
        items.push({
          kind: "field",
          op: op.op,
          collection: refOf(op.collectionId),
          field: { key: op.field.key, type: op.field.type },
        });
        break;
      case "update_field": {
        const field = fieldOf(op.collectionId, op.fieldId);
        const typeChange =
          op.patch.type !== undefined && op.patch.type !== field.type
            ? { from: field.type, to: op.patch.type }
            : undefined;
        items.push({
          kind: "field",
          op: op.op,
          collection: refOf(op.collectionId),
          field,
          patch: op.patch as Record<string, unknown>,
          ...(typeChange
            ? { typeChange, usedBy: ctx.usage.get(op.collectionId) ?? 0 }
            : {}),
        });
        break;
      }
      case "remove_field":
        items.push({
          kind: "field",
          op: op.op,
          collection: refOf(op.collectionId),
          field: fieldOf(op.collectionId, op.fieldId),
          usedBy: ctx.usage.get(op.collectionId) ?? 0,
        });
        break;
      case "insert_rows":
      case "replace_rows":
        items.push({
          kind: "rows",
          op: op.op,
          collection: refOf(op.collectionId),
          rowCount: op.rows.length,
          ...(op.rows.length > 0
            ? { sample: sampleOf(op.rows, keysOf(op.collectionId)) }
            : {}),
        });
        break;
      case "remove_rows":
        items.push({
          kind: "rows",
          op: op.op,
          collection: refOf(op.collectionId),
          rowCount: op.rowIndexes.length,
        });
        break;
      case "set_cell":
        items.push({
          kind: "rows",
          op: op.op,
          collection: refOf(op.collectionId),
          rowCount: 1,
          cell: {
            rowIndex: op.rowIndex,
            key: fieldOf(op.collectionId, op.fieldId).key,
            value: op.value,
          },
        });
        break;
      case "define_endpoint": {
        const id = op.endpoint.id ?? null;
        items.push({
          kind: "endpoint",
          op: op.op,
          endpoint: {
            id,
            name: op.endpoint.name,
            method: op.endpoint.method,
            url: joinEndpointUrl(op.endpoint.baseUrl, op.endpoint.path),
            isNew: !(id && ctx.endpointIds.has(id)),
            headerKeys: (op.endpoint.headers ?? []).map((h) => h.key),
          },
        });
        break;
      }
      case "delete_endpoint":
        items.push({
          kind: "endpoint",
          op: op.op,
          endpoint: {
            id: op.endpointId,
            name: op.endpointId,
            method: null,
            url: null,
            isNew: false,
            headerKeys: [],
          },
        });
        break;
      case "bind_element": {
        const collection =
          op.collectionId === null
            ? null
            : (() => {
                const ref = refOf(op.collectionId);
                return { id: op.collectionId, name: ref.name };
              })();
        const fieldMap = op.fieldMap
          ? Object.fromEntries(
              Object.entries(op.fieldMap)
                .filter(
                  (entry): entry is [string, string] =>
                    typeof entry[1] === "string",
                )
                .map(([role, fieldId]) => [
                  role,
                  op.collectionId
                    ? fieldOf(op.collectionId, fieldId).key
                    : fieldId,
                ]),
            )
          : undefined;
        items.push({
          kind: "binding",
          op: op.op,
          element: {
            id: op.elementId,
            type: ctx.elementTypes.get(op.elementId) ?? null,
          },
          collection,
          ...(fieldMap && Object.keys(fieldMap).length > 0 ? { fieldMap } : {}),
        });
        break;
      }
      case "define_variable":
        items.push({
          kind: "variable",
          op: op.op,
          variableId: op.variableId ?? null,
          name: op.definition?.name ?? null,
          removed: op.definition === null,
        });
        break;
      default: {
        const never: never = op;
        throw new Error(`알 수 없는 op: ${JSON.stringify(never)}`);
      }
    }
  }

  const usedBy = [...touched]
    .map(([id, name]) => ({ id, name, count: ctx.usage.get(id) ?? 0 }))
    .filter((entry) => entry.count > 0);

  return { items, usedBy };
}

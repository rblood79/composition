/**
 * partial patch (`DataTableUpdate`) → `DataOp[]` (ADR-152 Phase 1c).
 *
 * `updateCollection(id, updates)` 의 기존 호출부 (DataTableEditor · import envelope)
 * 를 바꾸지 않고 적용기 위에 올리기 위한 변환. 편집기가 만드는 patch 는 네 모양뿐이라
 * (셀 1개 · 행 1개 삭제 · 행 1개 추가 · 행 전량 교체) 그 모양을 알아보면 정확한 op 로,
 * 그 밖은 `replace_rows` 로 떨어뜨린다 — 결과는 항상 patch 와 같고 라벨만 거칠어진다.
 *
 * schema 는 필드 id 로 대조한다 (id 없는 대상 필드 = 새 필드). rename 은
 * `update_field` 하나가 행까지 옮기므로, 행 diff 는 schema op 를 먼저 적용한 중간
 * 상태에 대해 잰다 — 편집기가 같이 보내는 옮긴 행이 "변경 없음" 으로 읽힌다.
 */
import { resolveField, type DataOp } from "@composition/shared";
import type {
  DataField,
  DataTable,
  DataTableUpdate,
} from "../../../types/builder/data.types";
import { reduceDataOps } from "./dataChange";

type Row = Record<string, unknown>;

function rowsEqual(a: Row, b: Row): boolean {
  if (a === b) return true;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!(k in b) || !Object.is(a[k], b[k])) return false;
  return true;
}

const PATCHABLE_FIELD_KEYS = [
  "key",
  "type",
  "label",
  "required",
  "defaultValue",
  "children",
] as const;

function fieldPatch(
  before: DataField,
  after: DataField,
): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};
  for (const k of PATCHABLE_FIELD_KEYS) {
    const prev = before[k];
    const next = after[k];
    if (prev === next) continue;
    if (JSON.stringify(prev) === JSON.stringify(next)) continue;
    patch[k] = next === undefined ? null : next;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

function schemaOps(
  collectionId: string,
  before: readonly DataField[],
  after: readonly DataField[],
): DataOp[] {
  const ops: DataOp[] = [];
  const afterIds = new Set(
    after.map((f) => f.id).filter((id): id is string => !!id),
  );
  // 1) 삭제 (id 가 결과에 없음)
  for (const field of before) {
    if (field.id && !afterIds.has(field.id))
      ops.push({ op: "remove_field", collectionId, fieldId: field.id });
  }
  const beforeById = new Map(before.filter((f) => f.id).map((f) => [f.id as string, f]));
  // 2) 추가 · 변경 (결과 순서대로)
  after.forEach((field, index) => {
    const prev = field.id ? beforeById.get(field.id) : undefined;
    if (!prev) {
      ops.push({ op: "add_field", collectionId, field, index });
      return;
    }
    const patch = fieldPatch(prev, field);
    if (patch)
      ops.push({ op: "update_field", collectionId, fieldId: prev.id as string, patch });
  });
  return ops;
}

/** 순서만 다른 필드를 결과 순서로 맞춘다 (remove + add 쌍 — id 유지). */
function reorderOps(
  collectionId: string,
  current: readonly DataField[],
  target: readonly DataField[],
): DataOp[] {
  const ops: DataOp[] = [];
  const working = [...current];
  target.forEach((field, index) => {
    const at = working.findIndex((f) => f.id === field.id);
    if (at === index || at < 0) return;
    const [moved] = working.splice(at, 1);
    working.splice(index, 0, moved);
    ops.push(
      { op: "remove_field", collectionId, fieldId: moved.id as string },
      { op: "add_field", collectionId, field: moved, index },
    );
  });
  return ops;
}

function rowOps(
  collectionId: string,
  schema: readonly DataField[],
  before: readonly Row[],
  after: readonly Row[],
): DataOp[] {
  if (before.length === after.length) {
    const changed: number[] = [];
    for (let i = 0; i < before.length; i++)
      if (!rowsEqual(before[i], after[i])) changed.push(i);
    if (changed.length === 0) return [];
    if (changed.length === 1) {
      const i = changed[0];
      const keys = new Set([...Object.keys(before[i]), ...Object.keys(after[i])]);
      const diffKeys = [...keys].filter((k) => !Object.is(before[i][k], after[i][k]));
      // 행은 key 로 실려 있으니 key → 필드 (id) 로 올린다
      const field =
        diffKeys.length === 1 ? resolveField(schema, diffKeys[0]) : null;
      if (field?.id && diffKeys[0] in after[i])
        return [{ op: "set_cell", collectionId, rowIndex: i, fieldId: field.id as string, value: after[i][diffKeys[0]] }];
    }
    return [{ op: "replace_rows", collectionId, rows: after as Row[] }];
  }
  if (after.length < before.length) {
    // 결과가 이전의 부분열이면 삭제
    const removed: number[] = [];
    let j = 0;
    for (let i = 0; i < before.length; i++) {
      if (j < after.length && rowsEqual(before[i], after[j])) j++;
      else removed.push(i);
    }
    if (j === after.length)
      return [{ op: "remove_rows", collectionId, rowIndexes: removed }];
  } else {
    // 이전이 결과의 접두면 뒤에 추가
    let prefix = true;
    for (let i = 0; i < before.length; i++)
      if (!rowsEqual(before[i], after[i])) {
        prefix = false;
        break;
      }
    if (prefix)
      return [{ op: "insert_rows", collectionId, rows: after.slice(before.length) as Row[], at: before.length }];
  }
  return [{ op: "replace_rows", collectionId, rows: after as Row[] }];
}

export interface CollectionUpdateOps {
  ops: DataOp[];
  /** History 밖 — 메모리 전용 runtimeData (rename 이면 적용기가 옮기므로 생략). */
  runtimeData?: Row[];
}

export function collectionUpdateToOps(
  existing: DataTable,
  updates: DataTableUpdate,
): CollectionUpdateOps {
  const collectionId = existing.id;
  const ops: DataOp[] = [];

  if (updates.name !== undefined && updates.name !== existing.name)
    ops.push({ op: "update_collection", collectionId, patch: { name: updates.name } });
  if (updates.useMockData !== undefined && updates.useMockData !== existing.useMockData)
    ops.push({ op: "set_source", collectionId, source: updates.useMockData ? "manual" : "api" });

  let working = existing;
  let renamed = false;
  if (updates.schema && updates.schema !== existing.schema) {
    const fieldOps = schemaOps(collectionId, existing.schema, updates.schema);
    let reduced = reduceDataOps(new Map([[collectionId, existing]]), fieldOps, {});
    let next = reduced.collections.get(collectionId) as DataTable;
    const order = reorderOps(collectionId, next.schema, updates.schema);
    if (order.length > 0) {
      fieldOps.push(...order);
      reduced = reduceDataOps(new Map([[collectionId, existing]]), fieldOps, {});
      next = reduced.collections.get(collectionId) as DataTable;
    }
    renamed = fieldOps.some(
      (op) => op.op === "update_field" && op.patch.key !== undefined,
    );
    ops.push(...fieldOps);
    working = next;
  }

  if (updates.mockData && updates.mockData !== working.mockData)
    ops.push(...rowOps(collectionId, working.schema, working.mockData, updates.mockData));

  const out: CollectionUpdateOps = { ops };
  if (updates.runtimeData !== undefined && !renamed)
    out.runtimeData = updates.runtimeData;
  return out;
}

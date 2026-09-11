/**
 * `DataChange` 적용기 (ADR-152 §2-3, Phase 1c).
 *
 * 데이터 편집의 단일 진입점 — 사람 UI · import · AI (ADR-213) · agent 가 만든
 * `DataChange` 를 받아 (a) 검증 → (b) 파급 (rename 은 행도 옮긴다) → (c) History
 * `type:"data"` entry 1개 (역연산 `inverse` 동봉) → (d) 메모리 + IndexedDB →
 * (e) Canvas 동기화 순으로 처리한다. undo/redo 는 `inverse` / `ops` 를
 * `record:false` 로 재적용한다 (`historyActions.ts` early-branch).
 *
 * `reduceDataOps` 는 순수 함수다 — 모든 op 를 메모리 사본 위에서 먼저 끝까지 돌리고
 * (all-or-nothing), 그 결과만 저장한다. 검증 실패는 아무것도 바꾸지 않는다.
 *
 * 왕복 불변식: `reduce(reduce(S, ops).inverse)` 는 S 로 돌아온다 (테스트가 op 별로
 * 고정). undo 로 되살아난 collection · 필드는 **같은 id** 를 갖는다 — canonical 문서의
 * `collectionId` · `{#id}` 참조가 끊기지 않게.
 */
import type { StateCreator } from "zustand";
import {
  resolveField,
  type DataChange,
  type DataChangeOrigin,
  type DataOp,
} from "@composition/shared";
import { getDB } from "../../../lib/db";
import { normalizeCollection } from "../../../utils/data/normalizeCollection";
import { renameRowsKey } from "../../../utils/data/schemaMigration";
import type {
  DataField,
  DataStoreActions,
  DataStoreState,
  DataTable,
  DataTableUpdate,
} from "../../../types/builder/data.types";
import { historyManager } from "../history";
import { isCanvasCompareMode, isWebGLCanvas } from "../../../utils/featureFlags";

type DataStore = DataStoreState & DataStoreActions;
type SetState = Parameters<StateCreator<DataStore>>[0];
type GetState = Parameters<StateCreator<DataStore>>[1];
type Row = Record<string, unknown>;

export class DataChangeError extends Error {
  constructor(
    message: string,
    readonly op?: DataOp,
  ) {
    super(message);
    this.name = "DataChangeError";
  }
}

export interface ReduceContext {
  /** `create_collection` 에 projectId 가 없을 때의 기본값. */
  projectId?: string;
}

export interface ReduceResult {
  collections: Map<string, DataTable>;
  /** 정규화된 op (부여된 id · projectId 가 실린다) — History 에는 이것을 담는다. */
  applied: DataOp[];
  /** 역연산 — 역순. 적용하면 원상. */
  inverse: DataOp[];
  /** 저장 대상 — upsert 는 결과 Map 에서, delete 는 이전 Map 에서 읽는다. */
  upserted: Set<string>;
  deleted: Set<string>;
}

// ============================================
// Canvas Sync (iframe Preview — WebGL-only 모드에서는 no-op)
// ============================================

export function syncCollectionsToCanvas(
  collections: Map<string, DataTable>,
): void {
  const isWebGLOnly = isWebGLCanvas() && !isCanvasCompareMode();
  if (isWebGLOnly) return;

  try {
    const iframe = document.getElementById("previewFrame") as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      const dataTablesArray = Array.from(collections.values()).map((dt) => ({
        id: dt.id,
        name: dt.name,
        schema: dt.schema,
        mockData: dt.mockData,
        runtimeData: dt.runtimeData,
        useMockData: dt.useMockData,
      }));
      iframe.contentWindow.postMessage(
        { type: "UPDATE_DATA_TABLES", collections: dataTablesArray },
        "*",
      );
    }
  } catch (error) {
    console.warn("⚠️ Canvas 동기화 실패:", error);
  }
}

// ============================================
// Pure reducer
// ============================================

function requireCollection(
  collections: ReadonlyMap<string, DataTable>,
  op: DataOp & { collectionId: string },
): DataTable {
  const { collectionId } = op;
  const found = collections.get(collectionId);
  if (!found)
    throw new DataChangeError(
      `collection 을 찾을 수 없습니다: ${op.collectionId}`,
      op,
    );
  return found;
}

function requireFieldIndex(
  collection: DataTable,
  fieldId: string,
  op: DataOp,
): number {
  const field = resolveField(collection.schema, fieldId);
  const index = field ? collection.schema.indexOf(field) : -1;
  if (index < 0)
    throw new DataChangeError(`필드를 찾을 수 없습니다: ${fieldId}`, op);
  return index;
}

function requireRowIndex(collection: DataTable, rowIndex: number, op: DataOp) {
  if (rowIndex < 0 || rowIndex >= collection.mockData.length)
    throw new DataChangeError(
      `행 index 범위 밖: ${rowIndex} (행 ${collection.mockData.length})`,
      op,
    );
}

function newCollectionId(): string {
  return crypto.randomUUID();
}

/** `null` 은 키 제거 (`DataFieldPatchSchema` 계약). */
function applyFieldPatch(
  field: DataField,
  patch: Record<string, unknown>,
): DataField {
  const next: Record<string, unknown> = { ...field };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined) delete next[key];
    else next[key] = value;
  }
  return next as unknown as DataField;
}

/** 이전 값 patch — 없던 키는 `null` (되돌릴 때 제거). */
function inverseFieldPatch(
  field: DataField,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const prev: Record<string, unknown> = {};
  for (const key of Object.keys(patch)) {
    const value = (field as unknown as Record<string, unknown>)[key];
    prev[key] = value === undefined ? null : value;
  }
  return prev;
}

function reduceOne(
  collections: Map<string, DataTable>,
  op: DataOp,
  ctx: ReduceContext,
  out: ReduceResult,
): void {
  const stamp = new Date().toISOString();
  const touch = (next: DataTable) => {
    collections.set(next.id, { ...next, updated_at: stamp });
    out.upserted.add(next.id);
  };

  switch (op.op) {
    case "create_collection": {
      const projectId =
        op.projectId ??
        ctx.projectId ??
        [...collections.values()][0]?.project_id;
      if (!projectId)
        throw new DataChangeError("projectId 를 알 수 없습니다", op);
      const id = op.id ?? newCollectionId();
      if (collections.has(id))
        throw new DataChangeError(`collection id 중복: ${id}`, op);
      const created = normalizeCollection({
        id,
        name: op.name,
        project_id: projectId,
        description: op.description,
        schema: op.schema as DataField[],
        mockData: (op.rows ?? []) as Row[],
        useMockData: op.source !== "api",
        created_at: stamp,
        updated_at: stamp,
      }).collection;
      collections.set(id, created);
      out.upserted.add(id);
      out.deleted.delete(id);
      out.applied.push({
        ...op,
        id,
        projectId,
        schema: created.schema,
      });
      out.inverse.unshift({ op: "delete_collection", collectionId: id });
      return;
    }
    case "delete_collection": {
      const existing = requireCollection(collections, op);
      collections.delete(op.collectionId);
      out.deleted.add(op.collectionId);
      out.upserted.delete(op.collectionId);
      out.applied.push(op);
      out.inverse.unshift({
        op: "create_collection",
        id: existing.id,
        projectId: existing.project_id,
        name: existing.name,
        ...(existing.description !== undefined
          ? { description: existing.description }
          : {}),
        schema: existing.schema,
        rows: existing.mockData,
        source: existing.useMockData ? "manual" : "api",
      });
      return;
    }
    case "update_collection": {
      const existing = requireCollection(collections, op);
      const next: DataTable = { ...existing };
      const prev: { name?: string; description?: string | null } = {};
      if (op.patch.name !== undefined) {
        prev.name = existing.name;
        next.name = op.patch.name;
      }
      if (op.patch.description !== undefined) {
        prev.description = existing.description ?? null;
        if (op.patch.description === null) delete next.description;
        else next.description = op.patch.description;
      }
      touch(next);
      out.applied.push(op);
      out.inverse.unshift({
        op: "update_collection",
        collectionId: op.collectionId,
        patch: prev,
      });
      return;
    }
    case "add_field": {
      const existing = requireCollection(collections, op);
      const index = Math.min(op.index ?? existing.schema.length, existing.schema.length);
      const schema = [...existing.schema];
      schema.splice(index, 0, op.field as DataField);
      const normalized = normalizeCollection({ ...existing, schema }).collection;
      const field = normalized.schema[index];
      if (
        normalized.schema.some((f, i) => i !== index && f.key === field.key)
      )
        throw new DataChangeError(`필드 key 중복: ${field.key}`, op);
      touch(normalized);
      out.applied.push({ ...op, field, index });
      out.inverse.unshift({
        op: "remove_field",
        collectionId: op.collectionId,
        fieldId: field.id as string,
      });
      return;
    }
    case "update_field": {
      const existing = requireCollection(collections, op);
      const index = requireFieldIndex(existing, op.fieldId, op);
      const field = existing.schema[index];
      const patch = op.patch as Record<string, unknown>;
      const nextField = applyFieldPatch(field, patch);
      if (!nextField.key)
        throw new DataChangeError("필드 key 는 비울 수 없습니다", op);
      if (
        nextField.key !== field.key &&
        existing.schema.some((f) => f.key === nextField.key)
      )
        throw new DataChangeError(`필드 key 중복: ${nextField.key}`, op);
      const schema = existing.schema.map((f, i) => (i === index ? nextField : f));
      const renamed = nextField.key !== field.key;
      touch({
        ...existing,
        schema,
        mockData: renamed
          ? (renameRowsKey(existing.mockData, field.key, nextField.key) ?? [])
          : existing.mockData,
        runtimeData: renamed
          ? renameRowsKey(existing.runtimeData, field.key, nextField.key)
          : existing.runtimeData,
      });
      out.applied.push({ ...op, fieldId: field.id ?? op.fieldId });
      out.inverse.unshift({
        op: "update_field",
        collectionId: op.collectionId,
        fieldId: field.id ?? op.fieldId,
        patch: inverseFieldPatch(field, patch),
      });
      return;
    }
    case "remove_field": {
      const existing = requireCollection(collections, op);
      const index = requireFieldIndex(existing, op.fieldId, op);
      const field = existing.schema[index];
      touch({
        ...existing,
        schema: existing.schema.filter((_, i) => i !== index),
      });
      out.applied.push({ ...op, fieldId: field.id ?? op.fieldId });
      out.inverse.unshift({
        op: "add_field",
        collectionId: op.collectionId,
        field,
        index,
      });
      return;
    }
    case "set_cell": {
      const existing = requireCollection(collections, op);
      requireRowIndex(existing, op.rowIndex, op);
      const field = existing.schema[requireFieldIndex(existing, op.fieldId, op)];
      const prev = existing.mockData[op.rowIndex][field.key];
      touch({
        ...existing,
        mockData: existing.mockData.map((row, i) =>
          i === op.rowIndex ? { ...row, [field.key]: op.value } : row,
        ),
      });
      out.applied.push({ ...op, fieldId: field.id ?? op.fieldId });
      out.inverse.unshift({
        op: "set_cell",
        collectionId: op.collectionId,
        rowIndex: op.rowIndex,
        fieldId: field.id ?? op.fieldId,
        value: prev,
      });
      return;
    }
    case "insert_rows": {
      const existing = requireCollection(collections, op);
      const at = Math.min(op.at ?? existing.mockData.length, existing.mockData.length);
      const mockData = [...existing.mockData];
      mockData.splice(at, 0, ...(op.rows as Row[]));
      touch({ ...existing, mockData });
      out.applied.push({ ...op, at });
      out.inverse.unshift({
        op: "remove_rows",
        collectionId: op.collectionId,
        rowIndexes: op.rows.map((_, i) => at + i),
      });
      return;
    }
    case "remove_rows": {
      const existing = requireCollection(collections, op);
      const indexes = [...new Set(op.rowIndexes)].sort((a, b) => a - b);
      for (const i of indexes) requireRowIndex(existing, i, op);
      const removed = new Set(indexes);
      touch({
        ...existing,
        mockData: existing.mockData.filter((_, i) => !removed.has(i)),
      });
      out.applied.push({ ...op, rowIndexes: indexes });
      // 오름차순 insert 가 원래 자리를 복원한다 — 앞 삽입이 뒤 index 를 밀어 주므로.
      const restores: DataOp[] = indexes.map((i) => ({
        op: "insert_rows",
        collectionId: op.collectionId,
        rows: [existing.mockData[i]],
        at: i,
      }));
      out.inverse.unshift(...restores);
      return;
    }
    case "replace_rows": {
      const existing = requireCollection(collections, op);
      touch({ ...existing, mockData: op.rows as Row[] });
      out.applied.push(op);
      out.inverse.unshift({
        op: "replace_rows",
        collectionId: op.collectionId,
        rows: existing.mockData,
      });
      return;
    }
    case "set_source": {
      if (op.endpointId !== undefined)
        throw new DataChangeError(
          "set_source.endpointId 는 아직 배선되지 않았습니다 (ApiEndpoint.targetCollectionId 는 endpoint 편집기가 쓴다)",
          op,
        );
      const existing = requireCollection(collections, op);
      touch({ ...existing, useMockData: op.source === "manual" });
      out.applied.push(op);
      out.inverse.unshift({
        op: "set_source",
        collectionId: op.collectionId,
        source: existing.useMockData ? "manual" : "api",
      });
      return;
    }
    case "define_endpoint":
    case "bind_element":
      // ADR-213 (endpoint 정의 · 요소 바인딩은 각각 apiEndpoints · canonical 문서 축)
      throw new DataChangeError(
        `${op.op} 는 Phase 1c 적용기 범위 밖입니다 (ADR-213 에서 배선)`,
        op,
      );
    default: {
      const never: never = op;
      throw new DataChangeError(`알 수 없는 op: ${JSON.stringify(never)}`);
    }
  }
}

export function reduceDataOps(
  collections: ReadonlyMap<string, DataTable>,
  ops: readonly DataOp[],
  ctx: ReduceContext,
): ReduceResult {
  const out: ReduceResult = {
    collections: new Map(collections),
    applied: [],
    inverse: [],
    upserted: new Set(),
    deleted: new Set(),
  };
  for (const op of ops) reduceOne(out.collections, op, ctx, out);
  return out;
}

// ============================================
// Store action
// ============================================

export interface ApplyDataChangeOptions {
  /** false = History entry 를 만들지 않는다 (undo/redo 재적용). 기본 true. */
  record?: boolean;
  projectId?: string;
}

export interface ApplyDataChangeResult {
  applied: DataOp[];
  inverse: DataOp[];
  /** 영향 collection id (upsert + delete). */
  collectionIds: string[];
}

export interface DataChangeHistoryPayload {
  change: { ops: DataOp[]; origin: DataChangeOrigin; label?: string };
  inverse: DataOp[];
}

type CollectionsDB = {
  collections?: {
    insert: (dt: DataTable) => Promise<DataTable>;
    update: (id: string, updates: DataTableUpdate) => Promise<DataTable>;
    delete: (id: string) => Promise<void>;
  };
};

function persistablePatch(dt: DataTable): DataTableUpdate {
  return {
    name: dt.name,
    schema: dt.schema,
    mockData: dt.mockData,
    useMockData: dt.useMockData,
  };
}

/** 적용 순서: 검증·파급 (순수) → IndexedDB → 메모리 → History → Canvas. */
export const createApplyDataChangeAction =
  (set: SetState, get: GetState) =>
  async (
    change: DataChange,
    options: ApplyDataChangeOptions = {},
  ): Promise<ApplyDataChangeResult> => {
    const before = get().collections;
    const result = reduceDataOps(before, change.ops, {
      projectId: options.projectId,
    });

    try {
      const db = (await getDB()) as unknown as CollectionsDB;
      const store = db.collections;
      if (!store) throw new Error("collections store not found in database");
      for (const id of result.deleted) await store.delete(id);
      for (const id of result.upserted) {
        const next = result.collections.get(id);
        if (!next) continue;
        if (before.has(id)) await store.update(id, persistablePatch(next));
        else await store.insert(next);
      }
    } catch (error) {
      console.error("❌ DataChange 저장 실패:", error);
      set((state) => {
        const errors = new Map(state.errors);
        errors.set("applyDataChange", error as Error);
        return { errors };
      });
      throw error;
    }

    set({ collections: result.collections });

    if (options.record !== false) {
      const collectionIds = [...result.upserted, ...result.deleted];
      const payload: DataChangeHistoryPayload = {
        change: {
          ops: result.applied,
          origin: change.origin,
          ...(change.label !== undefined ? { label: change.label } : {}),
        },
        inverse: result.inverse,
      };
      historyManager.addEntry({
        type: "data",
        elementId: collectionIds[0] ?? "",
        elementIds: collectionIds,
        data: { dataChangeEvent: payload },
      });
    }

    syncCollectionsToCanvas(result.collections);

    return {
      applied: result.applied,
      inverse: result.inverse,
      collectionIds: [...result.upserted, ...result.deleted],
    };
  };

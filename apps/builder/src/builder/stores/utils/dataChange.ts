/**
 * `DataChange` 적용기 (ADR-152 §2-3, Phase 1c · ADR-213 Phase 2 bind_element).
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
  collectDocumentVariableNames,
  resolveField,
  type ApiEndpointDraft,
  type DataChange,
  type DataChangeOrigin,
  type DataOp,
  type VariableDefinition,
} from "@composition/shared";
import { getDB } from "../../../lib/db";
import { getActiveCanonicalDocument } from "../canonical/canonicalElementsBridge";
import { normalizeCollection } from "../../../utils/data/normalizeCollection";
import { renameRowsKey } from "../../../utils/data/schemaMigration";
import type {
  ApiEndpoint,
  DataField,
  DataStoreActions,
  DataStoreState,
  DataTable,
  DataTableUpdate,
  Variable,
} from "../../../types/builder/data.types";
import { historyManager } from "../history";
import {
  isCanvasCompareMode,
  isWebGLCanvas,
} from "../../../utils/featureFlags";

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
  /** `create_collection` / `define_variable` 에 projectId 가 없을 때의 기본값. */
  projectId?: string;
  /**
   * ADR-214 — 프로젝트 변수 (store 의 name 키 Map). `define_variable` 축의 시작 상태.
   * 생략하면 빈 Map (collections 전용 호출 호환).
   */
  variables?: ReadonlyMap<string, Variable>;
  /**
   * ADR-214 HC5 — canonical 문서의 페이지 · 요소 변수 이름 (예약어). 프로젝트 변수는 모든
   * 가시성 사슬의 끝이라 문서 안 어떤 이름과도 겹치면 안 된다. 적용기가 활성 문서에서 모은다.
   */
  documentVariableNames?: ReadonlySet<string>;
  /**
   * ADR-213 Phase 4 — API endpoint (store 의 name 키 Map). `define_endpoint` ·
   * `delete_endpoint` 축의 시작 상태. 생략하면 빈 Map.
   */
  apiEndpoints?: ReadonlyMap<string, ApiEndpoint>;
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
  /** ADR-214 — 프로젝트 변수 축 (name 키 Map · 저장 대상은 variable id). */
  variables: Map<string, Variable>;
  variablesUpserted: Set<string>;
  variablesDeleted: Set<string>;
  /** ADR-213 Phase 4 — API endpoint 축 (name 키 Map · 저장 대상은 endpoint id). */
  apiEndpoints: Map<string, ApiEndpoint>;
  endpointsUpserted: Set<string>;
  endpointsDeleted: Set<string>;
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

// ============================================
// ADR-214 — 프로젝트 변수 축 (`define_variable`)
// ============================================

function findVariableById(
  variables: ReadonlyMap<string, Variable>,
  variableId: string,
): Variable | undefined {
  for (const variable of variables.values()) {
    if (variable.id === variableId) return variable;
  }
  return undefined;
}

/** 저장된 `Variable` → op 의 `definition` (inverse 에 싣는 형태). */
function toVariableDefinition(variable: Variable): VariableDefinition {
  return {
    name: variable.name,
    type: variable.type,
    ...(variable.defaultValue !== undefined
      ? { defaultValue: variable.defaultValue }
      : {}),
    persist: variable.persist ?? false,
  };
}

/**
 * HC5 — 프로젝트 변수 이름은 store 의 다른 변수 · 문서 안 페이지/요소 state 이름과 겹칠 수 없다.
 * 검증기 자체는 shared `findVariableNameConflict` 가 정본이나, 적용기는 문서 대신 미리 모은
 * 이름 집합 (`ctx.documentVariableNames`) 을 받아 reduce 를 순수하게 유지한다.
 */
function assertVariableNameAvailable(
  variables: ReadonlyMap<string, Variable>,
  name: string,
  selfId: string | null,
  ctx: ReduceContext,
  op: DataOp,
): void {
  for (const variable of variables.values()) {
    if (variable.id !== selfId && variable.name.trim() === name) {
      throw new DataChangeError(
        `변수 이름이 이미 있습니다: ${name} (프로젝트 변수 ${variable.id})`,
        op,
      );
    }
  }
  if (ctx.documentVariableNames?.has(name)) {
    throw new DataChangeError(
      `변수 이름이 이미 있습니다: ${name} (페이지 · 요소 변수와 겹칩니다 — 가시성 사슬 안 이름은 하나)`,
      op,
    );
  }
}

function reduceDefineVariable(
  op: Extract<DataOp, { op: "define_variable" }>,
  ctx: ReduceContext,
  out: ReduceResult,
): void {
  const { variables } = out;
  const stamp = new Date().toISOString();

  if (op.definition === null) {
    if (!op.variableId)
      throw new DataChangeError("삭제할 variableId 가 없습니다", op);
    const existing = findVariableById(variables, op.variableId);
    if (!existing)
      throw new DataChangeError(
        `변수를 찾을 수 없습니다: ${op.variableId}`,
        op,
      );
    variables.delete(existing.name);
    out.variablesDeleted.add(existing.id);
    out.variablesUpserted.delete(existing.id);
    out.applied.push(op);
    out.inverse.unshift({
      op: "define_variable",
      variableId: existing.id,
      definition: toVariableDefinition(existing),
    });
    return;
  }

  const name = op.definition.name.trim();
  if (!name) throw new DataChangeError("변수 이름은 비울 수 없습니다", op);
  const existing = op.variableId
    ? findVariableById(variables, op.variableId)
    : undefined;
  assertVariableNameAvailable(variables, name, existing?.id ?? null, ctx, op);

  if (existing) {
    // update — name/type/defaultValue/persist 만 쓰고 나머지 (owner · scope · page_id ·
    //   migrationStatus 배지 · validation · transform) 는 보존한다. 배지 해소는 Phase 5 의 명시 UI.
    const next: Variable = {
      ...existing,
      name,
      type: op.definition.type,
      persist: op.definition.persist ?? existing.persist ?? false,
      updated_at: stamp,
    };
    if (op.definition.defaultValue !== undefined) {
      next.defaultValue = op.definition.defaultValue;
    } else {
      delete next.defaultValue;
    }
    variables.delete(existing.name);
    variables.set(name, next);
    out.variablesUpserted.add(existing.id);
    out.applied.push({ ...op, variableId: existing.id });
    out.inverse.unshift({
      op: "define_variable",
      variableId: existing.id,
      definition: toVariableDefinition(existing),
    });
    return;
  }

  // create (variableId 가 있으면 undo 가 같은 id 로 되살리는 경우 — 참조 보존)
  const projectId = ctx.projectId ?? [...variables.values()][0]?.project_id;
  if (!projectId) throw new DataChangeError("projectId 를 알 수 없습니다", op);
  const id = op.variableId ?? crypto.randomUUID();
  const created: Variable = {
    id,
    name,
    project_id: projectId,
    type: op.definition.type,
    ...(op.definition.defaultValue !== undefined
      ? { defaultValue: op.definition.defaultValue }
      : {}),
    persist: op.definition.persist ?? false,
    scope: "global",
    owner: { kind: "project" },
    created_at: stamp,
    updated_at: stamp,
  };
  variables.set(name, created);
  out.variablesUpserted.add(id);
  out.variablesDeleted.delete(id);
  out.applied.push({ ...op, variableId: id });
  out.inverse.unshift({
    op: "define_variable",
    variableId: id,
    definition: null,
  });
}

// ============================================
// ADR-213 Phase 4 — API endpoint 축 (`define_endpoint` · `delete_endpoint`)
// ============================================

function findEndpointById(
  endpoints: ReadonlyMap<string, ApiEndpoint>,
  endpointId: string,
): ApiEndpoint | undefined {
  for (const endpoint of endpoints.values()) {
    if (endpoint.id === endpointId) return endpoint;
  }
  return undefined;
}

/** 저장된 `ApiEndpoint` → op 의 `endpoint` draft (inverse 에 싣는 형태 — 전체 정의). */
export function toEndpointDraft(endpoint: ApiEndpoint): ApiEndpointDraft {
  return {
    id: endpoint.id,
    name: endpoint.name,
    ...(endpoint.description !== undefined
      ? { description: endpoint.description }
      : {}),
    method: endpoint.method,
    baseUrl: endpoint.baseUrl,
    path: endpoint.path,
    headers: endpoint.headers,
    queryParams: endpoint.queryParams,
    bodyType: endpoint.bodyType,
    ...(endpoint.bodyTemplate !== undefined
      ? { bodyTemplate: endpoint.bodyTemplate }
      : {}),
    dataPath: endpoint.responseMapping?.dataPath ?? "",
    ...(endpoint.targetCollectionId !== undefined
      ? { targetCollectionId: endpoint.targetCollectionId }
      : {}),
  };
}

function assertEndpointNameAvailable(
  endpoints: ReadonlyMap<string, ApiEndpoint>,
  name: string,
  selfId: string | null,
  op: DataOp,
): void {
  for (const endpoint of endpoints.values()) {
    if (endpoint.id !== selfId && endpoint.name.trim() === name) {
      throw new DataChangeError(
        `endpoint 이름이 이미 있습니다: ${name} (${endpoint.id})`,
        op,
      );
    }
  }
}

/**
 * ADR-213 HC5 후반 — AI 는 redactor 를 지난 정의 (`{{secret.KEY}}`) 만 보므로, 제안 patch 의
 * placeholder 값은 "이 값은 그대로" 라는 뜻이다. 같은 키의 기존 원문이 있으면 보존하고,
 * 새 키의 placeholder 는 그대로 둔다 (ADR-212 Phase 4 vault 참조 문법과 같다). live 에서
 * AI 가 돌려준 정의를 그대로 적용해 X-API-Key · Cookie 원문이 placeholder 로 덮인 것을 보고
 * 넣었다.
 */
const SECRET_PLACEHOLDER =
  /^\s*(?:bearer\s+|basic\s+)?\{\{secret\.[^}]+\}\}\s*$/i;

function preserveSecrets<T extends { key: string; value: string }>(
  incoming: readonly T[],
  existing: readonly { key: string; value: string }[],
): T[] {
  const byKey = new Map(
    existing.map((entry) => [entry.key.trim().toLowerCase(), entry.value]),
  );
  return incoming.map((entry) => {
    if (!SECRET_PLACEHOLDER.test(entry.value)) return entry;
    const previous = byKey.get(entry.key.trim().toLowerCase());
    if (previous === undefined || SECRET_PLACEHOLDER.test(previous))
      return entry;
    return { ...entry, value: previous };
  });
}

function reduceDefineEndpoint(
  op: Extract<DataOp, { op: "define_endpoint" }>,
  ctx: ReduceContext,
  out: ReduceResult,
): void {
  const { apiEndpoints } = out;
  const draft = op.endpoint;
  const stamp = new Date().toISOString();
  const name = draft.name.trim();
  if (!name) throw new DataChangeError("endpoint 이름은 비울 수 없습니다", op);
  const existing = draft.id
    ? findEndpointById(apiEndpoints, draft.id)
    : undefined;
  assertEndpointNameAvailable(apiEndpoints, name, existing?.id ?? null, op);

  if (existing) {
    // update — draft 가 준 필드만 덮는다 (headers/queryParams 는 배열 교체). 나머지
    //   (project_id · executionMode · serverConfig · timeout · retryCount · targetCollection
    //   이름 · created_at) 는 보존.
    const next: ApiEndpoint = {
      ...existing,
      name,
      method: draft.method,
      baseUrl: draft.baseUrl,
      path: draft.path,
      ...(draft.description !== undefined
        ? { description: draft.description }
        : {}),
      ...(draft.headers !== undefined
        ? { headers: preserveSecrets(draft.headers, existing.headers) }
        : {}),
      ...(draft.queryParams !== undefined
        ? {
            queryParams: preserveSecrets(
              draft.queryParams,
              existing.queryParams,
            ),
          }
        : {}),
      ...(draft.bodyType !== undefined ? { bodyType: draft.bodyType } : {}),
      ...(draft.bodyTemplate !== undefined
        ? { bodyTemplate: draft.bodyTemplate }
        : {}),
      ...(draft.dataPath !== undefined
        ? {
            responseMapping: {
              ...existing.responseMapping,
              dataPath: draft.dataPath,
            },
          }
        : {}),
      ...(draft.targetCollectionId !== undefined
        ? { targetCollectionId: draft.targetCollectionId }
        : {}),
      updated_at: stamp,
    };
    apiEndpoints.delete(existing.name);
    apiEndpoints.set(name, next);
    out.endpointsUpserted.add(existing.id);
    out.applied.push({ ...op, endpoint: { ...draft, id: existing.id } });
    out.inverse.unshift({
      op: "define_endpoint",
      endpoint: toEndpointDraft(existing),
    });
    return;
  }

  // create (draft.id 가 있으면 undo 가 같은 id 로 되살리는 경우 — 참조 보존)
  const projectId = ctx.projectId ?? [...apiEndpoints.values()][0]?.project_id;
  if (!projectId) throw new DataChangeError("projectId 를 알 수 없습니다", op);
  const id = draft.id ?? crypto.randomUUID();
  const created: ApiEndpoint = {
    id,
    name,
    project_id: projectId,
    ...(draft.description !== undefined
      ? { description: draft.description }
      : {}),
    method: draft.method,
    baseUrl: draft.baseUrl,
    path: draft.path,
    headers: draft.headers ?? [],
    queryParams: draft.queryParams ?? [],
    bodyType: draft.bodyType ?? "none",
    ...(draft.bodyTemplate !== undefined
      ? { bodyTemplate: draft.bodyTemplate }
      : {}),
    responseMapping: { dataPath: draft.dataPath ?? "" },
    ...(draft.targetCollectionId !== undefined
      ? { targetCollectionId: draft.targetCollectionId }
      : {}),
    executionMode: "client",
    timeout: 30000,
    retryCount: 0,
    created_at: stamp,
    updated_at: stamp,
  };
  apiEndpoints.set(name, created);
  out.endpointsUpserted.add(id);
  out.endpointsDeleted.delete(id);
  out.applied.push({ ...op, endpoint: { ...draft, id } });
  out.inverse.unshift({ op: "delete_endpoint", endpointId: id });
}

function reduceDeleteEndpoint(
  op: Extract<DataOp, { op: "delete_endpoint" }>,
  out: ReduceResult,
): void {
  const existing = findEndpointById(out.apiEndpoints, op.endpointId);
  if (!existing) {
    throw new DataChangeError(
      `endpoint 를 찾을 수 없습니다: ${op.endpointId}`,
      op,
    );
  }
  out.apiEndpoints.delete(existing.name);
  out.endpointsDeleted.add(existing.id);
  out.endpointsUpserted.delete(existing.id);
  out.applied.push(op);
  out.inverse.unshift({
    op: "define_endpoint",
    endpoint: toEndpointDraft(existing),
  });
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
      const index = Math.min(
        op.index ?? existing.schema.length,
        existing.schema.length,
      );
      const schema = [...existing.schema];
      schema.splice(index, 0, op.field as DataField);
      const normalized = normalizeCollection({
        ...existing,
        schema,
      }).collection;
      const field = normalized.schema[index];
      if (normalized.schema.some((f, i) => i !== index && f.key === field.key))
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
      const schema = existing.schema.map((f, i) =>
        i === index ? nextField : f,
      );
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
      const field =
        existing.schema[requireFieldIndex(existing, op.fieldId, op)];
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
      const at = Math.min(
        op.at ?? existing.mockData.length,
        existing.mockData.length,
      );
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
    case "bind_element":
      // canonical 문서 축 — 적용기 (`createApplyDataChangeAction`) 가 collections
      // reduce 앞에서 나누어 `DataBindingConsumer` 로 보낸다. 여기 오면 계약 위반.
      throw new DataChangeError(
        "bind_element 는 collections reducer 범위 밖입니다 (적용기가 canonical 축으로 보낸다)",
        op,
      );
    case "define_endpoint":
      // ADR-213 Phase 4 — apiEndpoints 축 (collections 무변경)
      reduceDefineEndpoint(op, ctx, out);
      return;
    case "delete_endpoint":
      reduceDeleteEndpoint(op, out);
      return;
    case "define_variable":
      // ADR-214 Phase 1 — 프로젝트 변수 축 (collections 무변경)
      reduceDefineVariable(op, ctx, out);
      return;
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
    variables: new Map(ctx.variables ?? []),
    variablesUpserted: new Set(),
    variablesDeleted: new Set(),
    apiEndpoints: new Map(ctx.apiEndpoints ?? []),
    endpointsUpserted: new Set(),
    endpointsDeleted: new Set(),
  };
  for (const op of ops) reduceOne(out.collections, op, ctx, out);
  return out;
}

// ============================================
// Store action
// ============================================

// ============================================
// bind_element — canonical 축 consumer (ADR-213 Phase 2)
// ============================================

export type BindElementOp = Extract<DataOp, { op: "bind_element" }>;

/** 사람 UI (`PropertyDataBinding`) 가 `props.dataBinding` 에 기록하는 것과 같은 형상. */
export interface DataTableBindingValue {
  source: "dataTable";
  collectionId: string;
  name: string;
  fieldMap?: BindElementOp["fieldMap"];
}

export interface DataBindingWrite {
  /** `null` = 해제. `restore` 가 있으면 무시된다. */
  binding: DataTableBindingValue | null;
  /** inverse 전용 — props · extension 원본을 그대로 되돌린다. */
  restore?: BindElementOp["restore"];
}

export interface DataBindingSnapshot {
  props?: unknown;
  extension?: unknown;
}

/**
 * canonical 문서에 바인딩을 쓰는 쪽 (elements store) 이 등록한다 — data store 가
 * elements store 를 import 하면 순환이라 bridge 로 잇는다 (`stores/index.ts` 가 등록).
 * History 는 만들지 않는다 — 이 적용기가 `type:"data"` entry 하나로 묶는다 (HC4).
 */
export interface DataBindingConsumer {
  has: (elementId: string) => boolean;
  /** @returns 적용 전 스냅샷. 요소가 없으면 null. */
  apply: (
    elementId: string,
    write: DataBindingWrite,
  ) => { previous: DataBindingSnapshot } | null;
}

let bindingConsumer: DataBindingConsumer | null = null;

export function registerDataBindingConsumer(
  consumer: DataBindingConsumer | null,
): void {
  bindingConsumer = consumer;
}

function isBindElementOp(op: DataOp): op is BindElementOp {
  return op.op === "bind_element";
}

/** collection 축 / canonical 축 분리 — 순서는 각 축 안에서만 보존한다. */
function partitionDataOps(ops: readonly DataOp[]): {
  collectionOps: DataOp[];
  bindingOps: BindElementOp[];
} {
  const collectionOps: DataOp[] = [];
  const bindingOps: BindElementOp[] = [];
  for (const op of ops) {
    if (isBindElementOp(op)) bindingOps.push(op);
    else collectionOps.push(op);
  }
  return { collectionOps, bindingOps };
}

/** 검증 (순수) — 요소 존재 · collection 존재 (같은 change 의 create 결과 포함). */
function preflightBindingOps(
  ops: readonly BindElementOp[],
  collections: Map<string, DataTable>,
): DataBindingConsumer {
  if (ops.length === 0) return bindingConsumer as DataBindingConsumer;
  if (!bindingConsumer) {
    throw new DataChangeError(
      "bind_element consumer 가 등록되지 않았습니다 (elements store 미초기화)",
      ops[0],
    );
  }
  for (const op of ops) {
    if (!bindingConsumer.has(op.elementId)) {
      throw new DataChangeError(`요소를 찾을 수 없습니다: ${op.elementId}`, op);
    }
    if (op.restore || op.collectionId === null) continue;
    if (!collections.has(op.collectionId)) {
      throw new DataChangeError(
        `collection 을 찾을 수 없습니다: ${op.collectionId}`,
        op,
      );
    }
  }
  return bindingConsumer;
}

function toBindingWrite(
  op: BindElementOp,
  collections: Map<string, DataTable>,
): DataBindingWrite {
  if (op.restore) return { binding: null, restore: op.restore };
  if (op.collectionId === null) return { binding: null };
  const collectionId = op.collectionId;
  const collection = collections.get(collectionId);
  return {
    binding: {
      source: "dataTable",
      collectionId,
      name: collection?.name ?? collectionId,
      ...(op.fieldMap ? { fieldMap: op.fieldMap } : {}),
    },
  };
}

function inverseOfBinding(
  op: BindElementOp,
  previous: DataBindingSnapshot,
): BindElementOp {
  const prevProps = previous.props as
    Partial<DataTableBindingValue> | undefined;
  return {
    op: "bind_element",
    elementId: op.elementId,
    collectionId:
      typeof prevProps?.collectionId === "string"
        ? prevProps.collectionId
        : null,
    restore: { props: previous.props, extension: previous.extension },
  };
}

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
  /** ADR-214 — 영향 프로젝트 변수 id (upsert + delete). */
  variableIds: string[];
  /** ADR-213 Phase 4 — 영향 API endpoint id (upsert + delete). */
  endpointIds: string[];
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
  variables?: {
    insert: (v: Variable) => Promise<Variable>;
    update: (id: string, updates: Partial<Variable>) => Promise<Variable>;
    delete: (id: string) => Promise<void>;
  };
  api_endpoints?: {
    insert: (ep: ApiEndpoint) => Promise<ApiEndpoint>;
    update: (id: string, updates: Partial<ApiEndpoint>) => Promise<ApiEndpoint>;
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
    const beforeVariables = get().variables;
    const beforeEndpoints = get().apiEndpoints;
    // 1. preflight (순수) — collections · variables reduce 전량 + binding 검증. 실패는 무변경.
    const { collectionOps, bindingOps } = partitionDataOps(change.ops);
    const touchesVariables = collectionOps.some(
      (op) => op.op === "define_variable",
    );
    const result = reduceDataOps(before, collectionOps, {
      projectId: options.projectId,
      variables: beforeVariables,
      apiEndpoints: beforeEndpoints,
      // ADR-214 HC5 — 문서 안 페이지/요소 state 이름은 프로젝트 변수로 못 쓴다.
      ...(touchesVariables
        ? {
            documentVariableNames: collectDocumentVariableNames(
              getActiveCanonicalDocument(),
            ),
          }
        : {}),
    });
    const consumer = preflightBindingOps(bindingOps, result.collections);
    const variablesChanged =
      result.variablesUpserted.size > 0 || result.variablesDeleted.size > 0;
    const endpointsChanged =
      result.endpointsUpserted.size > 0 || result.endpointsDeleted.size > 0;
    const statePatch = (reduced: ReduceResult): Partial<DataStoreState> => ({
      collections: reduced.collections,
      ...(variablesChanged ? { variables: reduced.variables } : {}),
      ...(endpointsChanged ? { apiEndpoints: reduced.apiEndpoints } : {}),
    });

    const persist = async (
      prev: Map<string, DataTable>,
      prevVariables: Map<string, Variable>,
      reduced: ReduceResult,
      prevEndpoints: ReadonlyMap<string, ApiEndpoint> = beforeEndpoints,
    ): Promise<void> => {
      const db = (await getDB()) as unknown as CollectionsDB;
      const store = db.collections;
      if (!store) throw new Error("collections store not found in database");
      for (const id of reduced.deleted) await store.delete(id);
      for (const id of reduced.upserted) {
        const next = reduced.collections.get(id);
        if (!next) continue;
        if (prev.has(id)) await store.update(id, persistablePatch(next));
        else await store.insert(next);
      }
      // ADR-214 — 프로젝트 변수 축 저장 (IndexedDB `variables`, keyPath id)
      if (
        reduced.variablesUpserted.size > 0 ||
        reduced.variablesDeleted.size > 0
      ) {
        const variablesStore = db.variables;
        if (!variablesStore)
          throw new Error("variables store not found in database");
        const beforeIds = new Set([...prevVariables.values()].map((v) => v.id));
        for (const id of reduced.variablesDeleted)
          await variablesStore.delete(id);
        for (const id of reduced.variablesUpserted) {
          const next = findVariableById(reduced.variables, id);
          if (!next) continue;
          if (beforeIds.has(id)) await variablesStore.update(id, next);
          else await variablesStore.insert(next);
        }
      }
      // ADR-213 Phase 4 — API endpoint 축 저장 (IndexedDB `api_endpoints`, keyPath id)
      if (
        reduced.endpointsUpserted.size > 0 ||
        reduced.endpointsDeleted.size > 0
      ) {
        const endpointsStore = db.api_endpoints;
        if (!endpointsStore)
          throw new Error("api_endpoints store not found in database");
        const beforeIds = new Set([...prevEndpoints.values()].map((e) => e.id));
        for (const id of reduced.endpointsDeleted)
          await endpointsStore.delete(id);
        for (const id of reduced.endpointsUpserted) {
          const next = findEndpointById(reduced.apiEndpoints, id);
          if (!next) continue;
          if (beforeIds.has(id)) await endpointsStore.update(id, next);
          else await endpointsStore.insert(next);
        }
      }
    };

    // 2. collections · variables commit (IndexedDB → 메모리)
    try {
      await persist(before, beforeVariables, result);
    } catch (error) {
      console.error("❌ DataChange 저장 실패:", error);
      set((state) => {
        const errors = new Map(state.errors);
        errors.set("applyDataChange", error as Error);
        return { errors };
      });
      throw error;
    }
    set(statePatch(result));

    // 3. canonical 축 commit — 실패 시 앞서 적용한 binding 과 collections·variables 를 역순 rollback
    const appliedBindings: BindElementOp[] = [];
    const bindingInverse: BindElementOp[] = [];
    try {
      for (const op of bindingOps) {
        const outcome = consumer.apply(
          op.elementId,
          toBindingWrite(op, result.collections),
        );
        if (!outcome) {
          throw new DataChangeError(
            `요소를 찾을 수 없습니다: ${op.elementId}`,
            op,
          );
        }
        appliedBindings.push(op);
        bindingInverse.unshift(inverseOfBinding(op, outcome.previous));
      }
    } catch (error) {
      for (const inverse of bindingInverse) {
        consumer.apply(
          inverse.elementId,
          toBindingWrite(inverse, result.collections),
        );
      }
      if (result.applied.length > 0) {
        const rollback = reduceDataOps(result.collections, result.inverse, {
          projectId: options.projectId,
          variables: result.variables,
          apiEndpoints: result.apiEndpoints,
        });
        set(statePatch(rollback));
        try {
          await persist(
            result.collections,
            result.variables,
            rollback,
            result.apiEndpoints,
          );
        } catch (persistError) {
          console.error("❌ DataChange rollback 저장 실패:", persistError);
        }
      }
      console.error("❌ DataChange 바인딩 적용 실패 (rollback):", error);
      throw error;
    }

    const applied: DataOp[] = [...result.applied, ...appliedBindings];
    const inverse: DataOp[] = [...bindingInverse, ...result.inverse];
    const collectionIds = [...result.upserted, ...result.deleted];
    const variableIds = [
      ...result.variablesUpserted,
      ...result.variablesDeleted,
    ];
    const endpointIds = [
      ...result.endpointsUpserted,
      ...result.endpointsDeleted,
    ];
    const affectedIds = [
      ...collectionIds,
      ...variableIds,
      ...endpointIds,
      ...appliedBindings.map((op) => op.elementId),
    ];

    // 4. History 1 entry — 승인 묶음 = entry 1 (⌘Z 1회로 전체 원상, HC4)
    if (options.record !== false) {
      const payload: DataChangeHistoryPayload = {
        change: {
          ops: applied,
          origin: change.origin,
          ...(change.label !== undefined ? { label: change.label } : {}),
        },
        inverse,
      };
      historyManager.addEntry({
        type: "data",
        elementId: affectedIds[0] ?? "",
        elementIds: affectedIds,
        data: { dataChangeEvent: payload },
      });
    }

    // 변수만 바뀐 change 는 collections postMessage 를 보내지 않는다 — 변수 전송은
    //   `useIframeMessenger` 의 variables useEffect (JSON 비교) 가 맡는다.
    if (collectionIds.length > 0) syncCollectionsToCanvas(result.collections);

    return { applied, inverse, collectionIds, variableIds, endpointIds };
  };

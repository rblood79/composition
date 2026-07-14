/**
 * Database Adapter Interface
 *
 * IndexedDB, PGlite, Supabase 등 다양한 데이터베이스를
 * 동일한 인터페이스로 사용하기 위한 추상화 레이어
 */

import type {
  DataTable,
  ApiEndpoint,
  Variable,
} from "../../types/builder/data.types";
import type {
  CompositionDocument,
  SerializedAction,
  SerializedEvent,
} from "@composition/shared";

// === Project Types ===

export interface Project {
  id: string;
  name: string;
  created_by?: string;
  domain?: string;
  created_at?: string;
  updated_at?: string;
}

// === Canonical Document Storage (ADR-116 direct cutover) ===

export interface CanonicalDocumentRecord {
  project_id: string;
  document: CompositionDocument;
  updated_at: string;
}

/**
 * documents_backup ring row (2026-07-14 요소 소실 사건 대응).
 * `backup_id` = `${project_id}::${원본 row 의 updated_at}`.
 */
export interface CanonicalDocumentBackupRecord {
  backup_id: string;
  project_id: string;
  document: CompositionDocument;
  updated_at: string;
}

/**
 * documents.put 급감 가드 옵션 — adapter 구현은
 * `indexedDB/documentPersistGuard.ts` 판정 경유.
 */
export interface DocumentPersistOptions {
  /** 대량 삭제가 의도된 흐름 (요소 삭제 / 페이지 삭제) 에서만 true */
  allowShrink?: boolean;
  /**
   * 설명 가능한 감소량 (history undo/redo 전용, 2026-07-15 사용자 승인) —
   * entry 의 canonical event deleteIds 로 산출한 예상 제거 node 수.
   * 가드는 `nextCount ≥ prevCount − expectedShrinkNodeCount` 일 때만 통과
   * (delta 불일치 시 기존과 동일하게 차단 — fail-closed).
   */
  expectedShrinkNodeCount?: number;
  /** 진단 로그용 호출 출처 */
  reason?: string;
}

// === ADR-131 — Root collection store records ===
//
// 각 store row 는 SerializedEvent/Action 본체 + `project_id` 필드.
// IndexedDB index = `project_id` (cross-project 분리), `target` (events 전용),
// `kind` (events / actions 공통).
//
// **`SerializedDataRecord` 부재 (Phase 7-revert, 2026-05-13)**: 사용자 framing
// 정정 — `data` store 는 기존 `collections` / `api_endpoints` 와 중복 개념.
// DB_VERSION 17 에서 data store deleteObjectStore + 본 type 제거.
// `SerializedData` schema 와 `CompositionDocument.data` root field 는 schema
// 영역에서 별도 framing 정리 (현 commit scope 외).

export interface SerializedEventRecord extends SerializedEvent {
  project_id: string;
}

export interface SerializedActionRecord extends SerializedAction {
  project_id: string;
}

// === Database Adapter Interface ===

export interface DatabaseAdapter {
  // Initialize database
  init(): Promise<void>;

  // Close database
  close(): Promise<void>;

  // Projects
  projects: {
    insert(project: Project): Promise<Project>;
    update(id: string, data: Partial<Project>): Promise<Project>;
    delete(id: string): Promise<void>;
    getById(id: string): Promise<Project | null>;
    getAll(): Promise<Project[]>;
  };

  // Canonical document primary storage (ADR-116)
  // put 은 급감 가드 + 백업 ring 경유 (2026-07-14 — documentPersistGuard.ts).
  documents: {
    put(
      projectId: string,
      document: CompositionDocument,
      options?: DocumentPersistOptions,
    ): Promise<CompositionDocument>;
    get(projectId: string): Promise<CompositionDocument | null>;
    delete(projectId: string): Promise<void>;
    getAll(): Promise<CanonicalDocumentRecord[]>;
    getBackups(projectId: string): Promise<CanonicalDocumentBackupRecord[]>;
  };

  // Data Tables (Data Panel System)
  collections: {
    insert(dataTable: DataTable): Promise<DataTable>;
    update(id: string, data: Partial<DataTable>): Promise<DataTable>;
    delete(id: string): Promise<void>;
    getById(id: string): Promise<DataTable | null>;
    getByProject(projectId: string): Promise<DataTable[]>;
    getByName(name: string): Promise<DataTable | null>;
    getAll(): Promise<DataTable[]>;
  };

  // API Endpoints (Data Panel System)
  api_endpoints: {
    insert(apiEndpoint: ApiEndpoint): Promise<ApiEndpoint>;
    update(id: string, data: Partial<ApiEndpoint>): Promise<ApiEndpoint>;
    delete(id: string): Promise<void>;
    getById(id: string): Promise<ApiEndpoint | null>;
    getByProject(projectId: string): Promise<ApiEndpoint[]>;
    getByName(name: string): Promise<ApiEndpoint | null>;
    getAll(): Promise<ApiEndpoint[]>;
  };

  // Variables (Data Panel System)
  variables: {
    insert(variable: Variable): Promise<Variable>;
    update(id: string, data: Partial<Variable>): Promise<Variable>;
    delete(id: string): Promise<void>;
    getById(id: string): Promise<Variable | null>;
    getByProject(projectId: string): Promise<Variable[]>;
    getByName(name: string): Promise<Variable | null>;
    getByScope(scope: string): Promise<Variable[]>;
    getByPage(pageId: string): Promise<Variable[]>;
    getAll(): Promise<Variable[]>;
  };

  // ADR-131 Phase 7 — Events root collection store
  events: {
    insert(record: SerializedEventRecord): Promise<SerializedEventRecord>;
    update(
      id: string,
      patch: Partial<SerializedEventRecord>,
    ): Promise<SerializedEventRecord>;
    delete(id: string): Promise<void>;
    getById(id: string): Promise<SerializedEventRecord | null>;
    getByProject(projectId: string): Promise<SerializedEventRecord[]>;
    getByTarget(target: string): Promise<SerializedEventRecord[]>;
    getAll(): Promise<SerializedEventRecord[]>;
  };

  // ADR-131 Phase 7-revert (2026-05-13): `data` store 부재 — 기존 `collections`
  // / `api_endpoints` 와 중복 개념.

  // ADR-131 Phase 7 — Actions root collection store
  actions: {
    insert(record: SerializedActionRecord): Promise<SerializedActionRecord>;
    update(
      id: string,
      patch: Partial<SerializedActionRecord>,
    ): Promise<SerializedActionRecord>;
    delete(id: string): Promise<void>;
    getById(id: string): Promise<SerializedActionRecord | null>;
    getByProject(projectId: string): Promise<SerializedActionRecord[]>;
    getAll(): Promise<SerializedActionRecord[]>;
  };
}

// === Helper Types ===

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  ascending?: boolean;
}

export interface BulkInsertResult {
  inserted: number;
  failed: number;
  errors?: Array<{ id: string; error: string }>;
}

/**
 * Database Adapter Interface
 *
 * IndexedDB, PGlite, Supabase 등 다양한 데이터베이스를
 * 동일한 인터페이스로 사용하기 위한 추상화 레이어
 */

import type { DesignToken, DesignTheme } from "../../types/theme";
import type {
  DataTable,
  ApiEndpoint,
  Variable,
  Transformer,
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

// === ADR-131 — Root collection store records ===
//
// 각 store row 는 SerializedEvent/Action 본체 + `project_id` 필드.
// IndexedDB index = `project_id` (cross-project 분리), `target` (events 전용),
// `kind` (events / actions 공통).
//
// **`SerializedDataRecord` 부재 (Phase 7-revert, 2026-05-13)**: 사용자 framing
// 정정 — `data` store 는 기존 `data_tables` / `api_endpoints` 와 중복 개념.
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

  // Design Tokens
  designTokens: {
    insert(token: DesignToken): Promise<DesignToken>;
    insertMany(tokens: DesignToken[]): Promise<DesignToken[]>;
    update(id: string, data: Partial<DesignToken>): Promise<DesignToken>;
    delete(id: string): Promise<void>;
    getById(id: string): Promise<DesignToken | null>;
    getByTheme(themeId: string): Promise<DesignToken[]>;
    getByProject(projectId: string): Promise<DesignToken[]>;
    getAll(): Promise<DesignToken[]>;
  };

  // Design Themes
  themes: {
    insert(theme: DesignTheme): Promise<DesignTheme>;
    update(id: string, data: Partial<DesignTheme>): Promise<DesignTheme>;
    delete(id: string): Promise<void>;
    getById(id: string): Promise<DesignTheme | null>;
    getByProject(projectId: string): Promise<DesignTheme[]>;
    getActiveTheme(projectId: string): Promise<DesignTheme | null>;
    getAll(): Promise<DesignTheme[]>;
  };

  // Canonical document primary storage (ADR-116)
  documents: {
    put(
      projectId: string,
      document: CompositionDocument,
    ): Promise<CompositionDocument>;
    get(projectId: string): Promise<CompositionDocument | null>;
    delete(projectId: string): Promise<void>;
    getAll(): Promise<CanonicalDocumentRecord[]>;
  };

  // Data Tables (Data Panel System)
  data_tables: {
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
    getByTargetDataTable(tableName: string): Promise<ApiEndpoint[]>;
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

  // Transformers (Data Panel System)
  transformers: {
    insert(transformer: Transformer): Promise<Transformer>;
    update(id: string, data: Partial<Transformer>): Promise<Transformer>;
    delete(id: string): Promise<void>;
    getById(id: string): Promise<Transformer | null>;
    getByProject(projectId: string): Promise<Transformer[]>;
    getByName(name: string): Promise<Transformer | null>;
    getByLevel(level: string): Promise<Transformer[]>;
    getByInputDataTable(tableName: string): Promise<Transformer[]>;
    getByOutputDataTable(tableName: string): Promise<Transformer[]>;
    getAll(): Promise<Transformer[]>;
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

  // ADR-131 Phase 7-revert (2026-05-13): `data` store 부재 — 기존 `data_tables`
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

  // Batch Operations
  batch: {
    // Export all data for sync
    export(): Promise<{
      project: Project | null;
      document: CompositionDocument | null;
      designTokens: DesignToken[];
    }>;

    // Import data from sync
    import(data: {
      project?: Project;
      document?: CompositionDocument;
      designTokens?: DesignToken[];
    }): Promise<void>;

    // Clear all data
    clear(): Promise<void>;
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

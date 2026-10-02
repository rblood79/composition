/**
 * Database Adapter Interface
 *
 * IndexedDB, PGlite 등 다양한 데이터베이스를
 * 동일한 인터페이스로 사용하기 위한 추상화 레이어
 */

import type {
  DataTable,
  ApiEndpoint,
  Variable,
} from "../../types/builder/data.types";

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




// === Database Adapter Interface ===

export interface DatabaseAdapter {
  // Initialize database
  init(): Promise<void>;

  // Close database
  close(): Promise<void>;

  /** ADR-235 Phase 5 — 버려도 되는 캐시 (collection_runtime) 비우기 */
  clearCaches(): Promise<void>;

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

/**
 * Database Adapter Interface
 *
 * IndexedDB, PGlite 등 다양한 데이터베이스를
 * 동일한 인터페이스로 사용하기 위한 추상화 레이어
 */

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

/**
 * Database Adapter Interface
 *
 * IndexedDB, PGlite, Supabase 등 다양한 데이터베이스를
 * 동일한 인터페이스로 사용하기 위한 추상화 레이어
 */

import type {
  DesignToken,
  DesignTheme,
  DesignVariable,
} from "../../types/theme";
import type { Element } from "../../types/core/store.types";
import type {
  DataTable,
  ApiEndpoint,
  Variable,
  Transformer,
} from "../../types/builder/data.types";
import type { CompositionDocument } from "@composition/shared";

// === Project Types ===

export interface Project {
  id: string;
  name: string;
  created_by?: string;
  domain?: string;
  created_at?: string;
  updated_at?: string;
}

// === History Types ===

export interface HistoryEntry {
  id: string;
  page_id: string;
  type:
    | "add"
    | "update"
    | "remove"
    | "move"
    | "batch"
    | "group"
    | "ungroup"
    | "instance-create"
    | "instance-detach"
    | "master-propagate";
  element_id: string;
  element_ids?: string[];
  data: {
    element?: Element;
    prevElement?: Element;
    elements?: Element[];
    prevElements?: Element[];
    batchUpdates?: Array<{
      elementId: string;
      prevProps: Record<string, unknown>;
      newProps: Record<string, unknown>;
    }>;
    groupData?: {
      groupId: string;
      childIds: string[];
    };
  };
  created_at: string;
}

// === Sync Metadata Types ===

export interface SyncMetadata {
  project_id: string;
  sync_enabled: boolean;
  last_sync_at: string | null;
  local_updated_at: string;
  cloud_updated_at: string | null;
  sync_status: "local-only" | "synced" | "conflict" | "pending";
}

// === Canonical Document Storage (ADR-116 direct cutover) ===

export interface CanonicalDocumentRecord {
  project_id: string;
  document: CompositionDocument;
  updated_at: string;
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

  // Design Variables (G.2 Variable Reference System)
  designVariables: {
    insert(variable: DesignVariable): Promise<DesignVariable>;
    insertMany(variables: DesignVariable[]): Promise<DesignVariable[]>;
    update(id: string, data: Partial<DesignVariable>): Promise<DesignVariable>;
    delete(id: string): Promise<void>;
    getById(id: string): Promise<DesignVariable | null>;
    getByProject(projectId: string): Promise<DesignVariable[]>;
    getByName(projectId: string, name: string): Promise<DesignVariable | null>;
    getAll(): Promise<DesignVariable[]>;
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

  // History
  history: {
    insert(entry: HistoryEntry): Promise<HistoryEntry>;
    getByPage(pageId: string, limit?: number): Promise<HistoryEntry[]>;
    deleteOldEntries(pageId: string, keepCount: number): Promise<void>;
    clear(pageId: string): Promise<void>;
  };

  // Sync Metadata
  metadata: {
    get(): Promise<SyncMetadata | null>;
    set(data: SyncMetadata): Promise<void>;
    update(data: Partial<SyncMetadata>): Promise<void>;
  };

  // Batch Operations
  batch: {
    // Export all data for sync
    export(): Promise<{
      project: Project | null;
      document: CompositionDocument | null;
      designTokens: DesignToken[];
      metadata: SyncMetadata | null;
    }>;

    // Import data from sync
    import(data: {
      project?: Project;
      document?: CompositionDocument;
      designTokens?: DesignToken[];
      metadata?: SyncMetadata;
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

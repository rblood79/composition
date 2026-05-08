/**
 * IndexedDB Adapter Implementation
 *
 * 브라우저의 IndexedDB를 사용한 로컬 데이터베이스 구현
 * - 빠른 로컬 저장 (1-5ms)
 * - 오프라인 지원
 * - Supabase와 동일한 인터페이스
 */

import type {
  DatabaseAdapter,
  Project,
  CanonicalDocumentRecord,
} from "../types";
import type { DesignToken, DesignTheme } from "../../../types/theme";
import type { CompositionDocument } from "@composition/shared";
import type {
  DataTable,
  ApiEndpoint,
  Variable,
  Transformer,
} from "../../../types/builder/data.types";
import { LRUCache } from "./LRUCache";

const DB_NAME = "composition";
const DB_VERSION = 15; // ADR-121 removes dormant legacy IndexedDB surfaces.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deleteLegacyOrderFields(record: Record<string, unknown>): boolean {
  let changed = false;

  if (Object.prototype.hasOwnProperty.call(record, "order_num")) {
    delete record.order_num;
    changed = true;
  }

  if (Object.prototype.hasOwnProperty.call(record, "orderNum")) {
    delete record.orderNum;
    changed = true;
  }

  return changed;
}

function stripCanonicalNodeOrderMetadata(value: unknown): boolean {
  if (!isRecord(value)) return false;

  let changed = false;
  const metadata = value.metadata;

  if (isRecord(metadata)) {
    changed = deleteLegacyOrderFields(metadata) || changed;
    if (Object.keys(metadata).length === 0) {
      delete value.metadata;
      changed = true;
    }
  }

  const children = value.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      changed = stripCanonicalNodeOrderMetadata(child) || changed;
    }
  }

  const descendants = value.descendants;
  if (isRecord(descendants)) {
    for (const descendant of Object.values(descendants)) {
      changed = stripCanonicalNodeOrderMetadata(descendant) || changed;
    }
  }

  return changed;
}

export function stripLegacyOrderPayload(value: unknown): boolean {
  if (!isRecord(value)) return false;

  let changed = deleteLegacyOrderFields(value);
  const document = isRecord(value.document) ? value.document : value;
  const children = document.children;

  if (Array.isArray(children)) {
    for (const child of children) {
      changed = stripCanonicalNodeOrderMetadata(child) || changed;
    }
  }

  return changed;
}

function stripLegacyOrderPayloadsFromStore(
  transaction: IDBTransaction,
  storeName: string,
): void {
  const store = transaction.objectStore(storeName);
  const request = store.openCursor();
  let cleaned = 0;

  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) {
      if (cleaned > 0) {
        console.log(
          `[IndexedDB] Removed legacy order payloads from ${storeName}: ${cleaned}`,
        );
      }
      return;
    }

    const value = cursor.value;
    if (stripLegacyOrderPayload(value)) {
      cleaned += 1;
      cursor.update(value);
    }
    cursor.continue();
  };

  request.onerror = () => {
    console.warn(
      `[IndexedDB] Failed to clean legacy order payloads from ${storeName}`,
      request.error,
    );
  };
}

function stripLegacyOrderPayloads(transaction: IDBTransaction | null): void {
  if (!transaction) return;

  for (const storeName of ["documents"]) {
    if (!transaction.objectStoreNames.contains(storeName)) continue;
    stripLegacyOrderPayloadsFromStore(transaction, storeName);
  }
}

export class IndexedDBAdapter implements DatabaseAdapter {
  private db: IDBDatabase | null = null;

  // LRU Caches for frequently accessed data
  private projectCache = new LRUCache<Project>(10);

  // === Database Lifecycle ===

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error("Failed to open IndexedDB"));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        // ADR-116 direct cutover: 개발 단계에서는 기존 row 보존 migration 을
        // 지원하지 않는다. DB schema bump 는 canonical document primary marker.
        if (oldVersion < 10 && oldVersion > 0) {
          console.log(
            `[IndexedDB] ADR-116 direct cutover: oldVersion=${oldVersion} → 10`,
          );
        }
        if (oldVersion < 11 && oldVersion > 0) {
          console.log(
            `[IndexedDB] Element order cleanup: oldVersion=${oldVersion} → 11`,
          );
        }
        if (oldVersion < 12 && oldVersion > 0) {
          console.log(
            `[IndexedDB] Page/layout order cleanup: oldVersion=${oldVersion} → 12`,
          );
        }
        if (oldVersion < 13 && oldVersion > 0) {
          console.log(
            `[IndexedDB] Legacy order payload cleanup: oldVersion=${oldVersion} → 13`,
          );
        }
        if (oldVersion < 15 && oldVersion > 0) {
          console.log(
            `[IndexedDB] Legacy dormant surface cleanup: oldVersion=${oldVersion} → 15`,
          );
        }

        // Projects store
        if (!db.objectStoreNames.contains("projects")) {
          db.createObjectStore("projects", { keyPath: "id" });
          console.log("[IndexedDB] Created store: projects");
        }

        // Canonical documents store (ADR-116 primary storage)
        if (!db.objectStoreNames.contains("documents")) {
          db.createObjectStore("documents", { keyPath: "project_id" });
          console.log("[IndexedDB] Created store: documents");
        }

        for (const legacyStore of [
          "pages",
          "elements",
          "layouts",
          "metadata",
          "history",
          "design_" + "variables",
        ] as const) {
          if (db.objectStoreNames.contains(legacyStore)) {
            db.deleteObjectStore(legacyStore);
            console.log(`[IndexedDB] Deleted legacy store: ${legacyStore}`);
          }
        }

        // Design tokens store
        if (!db.objectStoreNames.contains("design_tokens")) {
          const tokensStore = db.createObjectStore("design_tokens", {
            keyPath: "id",
          });
          tokensStore.createIndex("project_id", "project_id", {
            unique: false,
          });
          tokensStore.createIndex("theme_id", "theme_id", { unique: false });
          console.log("[IndexedDB] Created store: design_tokens");
        } else {
          // ✅ 버전 3: 기존 스토어에 theme_id 인덱스 추가
          const transaction = (event.target as IDBOpenDBRequest).transaction;
          if (transaction) {
            const tokensStore = transaction.objectStore("design_tokens");
            if (!tokensStore.indexNames.contains("theme_id")) {
              tokensStore.createIndex("theme_id", "theme_id", {
                unique: false,
              });
              console.log("[IndexedDB] Added index: design_tokens.theme_id");
            }
          }
        }

        // Design themes store
        if (!db.objectStoreNames.contains("design_themes")) {
          const themesStore = db.createObjectStore("design_themes", {
            keyPath: "id",
          });
          themesStore.createIndex("project_id", "project_id", {
            unique: false,
          });
          themesStore.createIndex("status", "status", { unique: false });
          console.log("[IndexedDB] Created store: design_themes");
        }

        // ✅ 버전 7: Data Panel 스토어들 추가
        // DataTables store
        if (!db.objectStoreNames.contains("data_tables")) {
          const dataTablesStore = db.createObjectStore("data_tables", {
            keyPath: "id",
          });
          dataTablesStore.createIndex("project_id", "project_id", {
            unique: false,
          });
          dataTablesStore.createIndex("name", "name", { unique: false });
          console.log("[IndexedDB] Created store: data_tables");
        }

        // ApiEndpoints store
        if (!db.objectStoreNames.contains("api_endpoints")) {
          const apiEndpointsStore = db.createObjectStore("api_endpoints", {
            keyPath: "id",
          });
          apiEndpointsStore.createIndex("project_id", "project_id", {
            unique: false,
          });
          apiEndpointsStore.createIndex("name", "name", { unique: false });
          apiEndpointsStore.createIndex("targetDataTable", "targetDataTable", {
            unique: false,
          });
          console.log("[IndexedDB] Created store: api_endpoints");
        }

        // Variables store
        if (!db.objectStoreNames.contains("variables")) {
          const variablesStore = db.createObjectStore("variables", {
            keyPath: "id",
          });
          variablesStore.createIndex("project_id", "project_id", {
            unique: false,
          });
          variablesStore.createIndex("name", "name", { unique: false });
          variablesStore.createIndex("scope", "scope", { unique: false });
          variablesStore.createIndex("page_id", "page_id", { unique: false });
          console.log("[IndexedDB] Created store: variables");
        }

        // Transformers store
        if (!db.objectStoreNames.contains("transformers")) {
          const transformersStore = db.createObjectStore("transformers", {
            keyPath: "id",
          });
          transformersStore.createIndex("project_id", "project_id", {
            unique: false,
          });
          transformersStore.createIndex("name", "name", { unique: false });
          transformersStore.createIndex("level", "level", { unique: false });
          transformersStore.createIndex("inputDataTable", "inputDataTable", {
            unique: false,
          });
          transformersStore.createIndex("outputDataTable", "outputDataTable", {
            unique: false,
          });
          console.log("[IndexedDB] Created store: transformers");
        }

        if (oldVersion < 13 && oldVersion > 0) {
          stripLegacyOrderPayloads(
            (event.target as IDBOpenDBRequest).transaction,
          );
        }

        console.log("[IndexedDB] Schema upgrade completed");
      };
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;

      // Clear all caches
      this.projectCache.clear();

      console.log("[IndexedDB] Database closed and caches cleared");
    }
  }

  // === Helper Methods ===

  private ensureDB(): IDBDatabase {
    if (!this.db) {
      throw new Error("Database not initialized. Call init() first.");
    }
    return this.db;
  }

  private async getFromStore<T>(
    storeName: string,
    id: string,
  ): Promise<T | null> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  private async putToStore<T>(storeName: string, data: T): Promise<T> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteFromStore(storeName: string, id: string): Promise<void> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async getAllFromStore<T>(storeName: string): Promise<T[]> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async getAllByIndex<T>(
    storeName: string,
    indexName: string,
    value: string,
  ): Promise<T[]> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // === Projects ===

  projects = {
    insert: async (project: Project): Promise<Project> => {
      const result = await this.putToStore("projects", project);
      this.projectCache.set(project.id, result);
      return result;
    },

    update: async (id: string, data: Partial<Project>): Promise<Project> => {
      let existing = this.projectCache.get(id);

      if (!existing) {
        existing = await this.getFromStore<Project>("projects", id);
      }

      if (!existing) {
        throw new Error(`Project not found: ${id}`);
      }

      const updated = {
        ...existing,
        ...data,
        updated_at: new Date().toISOString(),
      };
      const result = await this.putToStore("projects", updated);
      this.projectCache.set(id, result);
      return result;
    },

    delete: async (id: string): Promise<void> => {
      await this.deleteFromStore("projects", id);
      this.projectCache.delete(id);
    },

    getById: async (id: string): Promise<Project | null> => {
      const cached = this.projectCache.get(id);

      if (cached) {
        return cached;
      }

      const project = await this.getFromStore<Project>("projects", id);

      if (project) {
        this.projectCache.set(id, project);
      }

      return project;
    },

    getAll: async (): Promise<Project[]> => {
      return this.getAllFromStore<Project>("projects");
    },
  };

  // === Design Tokens ===

  designTokens = {
    getById: async (id: string): Promise<DesignToken | null> => {
      return this.getFromStore<DesignToken>("design_tokens", id);
    },

    insert: async (token: DesignToken): Promise<DesignToken> => {
      return this.putToStore("design_tokens", token);
    },

    insertMany: async (tokens: DesignToken[]): Promise<DesignToken[]> => {
      if (tokens.length === 0) {
        return [];
      }

      const db = this.ensureDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("design_tokens", "readwrite");
        const store = tx.objectStore("design_tokens");

        // Queue all operations - single transaction commit
        tokens.forEach((token) => {
          store.put(token);
        });

        // Resolve when entire transaction completes
        tx.oncomplete = () => {
          if (process.env.NODE_ENV === "development") {
            console.log(
              `✅ [IndexedDB] designTokens.insertMany completed: ${tokens.length} tokens`,
            );
          }
          resolve(tokens);
        };

        tx.onerror = () => {
          console.error(
            "❌ [IndexedDB] designTokens.insertMany transaction failed:",
            tx.error,
          );
          reject(tx.error);
        };
      });
    },

    update: async (
      id: string,
      data: Partial<DesignToken>,
    ): Promise<DesignToken> => {
      const existing = await this.getFromStore<DesignToken>(
        "design_tokens",
        id,
      );
      if (!existing) {
        throw new Error(`Design token not found: ${id}`);
      }
      const updated = { ...existing, ...data };
      return this.putToStore("design_tokens", updated);
    },

    delete: async (id: string): Promise<void> => {
      return this.deleteFromStore("design_tokens", id);
    },

    getByProject: async (projectId: string): Promise<DesignToken[]> => {
      return this.getAllByIndex<DesignToken>(
        "design_tokens",
        "project_id",
        projectId,
      );
    },

    getByTheme: async (themeId: string): Promise<DesignToken[]> => {
      return this.getAllByIndex<DesignToken>(
        "design_tokens",
        "theme_id",
        themeId,
      );
    },

    getAll: async (): Promise<DesignToken[]> => {
      return this.getAllFromStore<DesignToken>("design_tokens");
    },
  };

  // === Design Themes ===

  themes = {
    getAll: async (): Promise<DesignTheme[]> => {
      return this.getAllFromStore<DesignTheme>("design_themes");
    },

    getById: async (id: string): Promise<DesignTheme | null> => {
      return this.getFromStore<DesignTheme>("design_themes", id);
    },

    getByProject: async (projectId: string): Promise<DesignTheme[]> => {
      const db = this.ensureDB();
      return new Promise<DesignTheme[]>((resolve, reject) => {
        const tx = db.transaction("design_themes", "readonly");
        const store = tx.objectStore("design_themes");
        const index = store.index("project_id");
        const request = index.getAll(projectId);

        request.onsuccess = () =>
          resolve((request.result || []) as DesignTheme[]);
        request.onerror = () => reject(request.error);
      });
    },

    getActiveTheme: async (projectId: string): Promise<DesignTheme | null> => {
      const themes = await this.themes.getByProject(projectId);
      const activeTheme = themes.find((t) => t.status === "active");
      return activeTheme || themes[0] || null;
    },

    insert: async (theme: DesignTheme): Promise<DesignTheme> => {
      await this.putToStore("design_themes", theme);
      return theme;
    },

    update: async (
      id: string,
      updates: Partial<DesignTheme>,
    ): Promise<DesignTheme> => {
      const existing = await this.themes.getById(id);
      if (!existing) {
        throw new Error(`Theme ${id} not found`);
      }
      const updated = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      await this.putToStore("design_themes", updated);
      return updated;
    },

    delete: async (id: string) => {
      const db = this.ensureDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction("design_themes", "readwrite");
        const store = tx.objectStore("design_themes");
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },
  };

  // === Canonical Documents (ADR-116 primary storage) ===

  documents = {
    put: async (
      projectId: string,
      document: CompositionDocument,
    ): Promise<CompositionDocument> => {
      const record: CanonicalDocumentRecord = {
        project_id: projectId,
        document,
        updated_at: new Date().toISOString(),
      };
      await this.putToStore("documents", record);
      return document;
    },

    get: async (projectId: string): Promise<CompositionDocument | null> => {
      const record = await this.getFromStore<CanonicalDocumentRecord>(
        "documents",
        projectId,
      );
      return record?.document ?? null;
    },

    delete: async (projectId: string): Promise<void> => {
      await this.deleteFromStore("documents", projectId);
    },

    getAll: async (): Promise<CanonicalDocumentRecord[]> => {
      return this.getAllFromStore<CanonicalDocumentRecord>("documents");
    },
  };

  // === Data Tables (Data Panel System) ===

  data_tables = {
    insert: async (dataTable: DataTable): Promise<DataTable> => {
      const now = new Date().toISOString();
      const dataTableWithTimestamps: DataTable = {
        ...dataTable,
        created_at: dataTable.created_at || now,
        updated_at: dataTable.updated_at || now,
      };
      await this.putToStore("data_tables", dataTableWithTimestamps);
      return dataTableWithTimestamps;
    },

    update: async (
      id: string,
      updates: Partial<DataTable>,
    ): Promise<DataTable> => {
      const existing = await this.data_tables.getById(id);
      if (!existing) {
        throw new Error(`DataTable ${id} not found`);
      }
      const updated: DataTable = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      await this.putToStore("data_tables", updated);
      return updated;
    },

    delete: async (id: string): Promise<void> => {
      await this.deleteFromStore("data_tables", id);
    },

    getById: async (id: string): Promise<DataTable | null> => {
      return this.getFromStore<DataTable>("data_tables", id);
    },

    getByProject: async (projectId: string): Promise<DataTable[]> => {
      return this.getAllByIndex<DataTable>(
        "data_tables",
        "project_id",
        projectId,
      );
    },

    getByName: async (name: string): Promise<DataTable | null> => {
      const results = await this.getAllByIndex<DataTable>(
        "data_tables",
        "name",
        name,
      );
      return results[0] || null;
    },

    getAll: async (): Promise<DataTable[]> => {
      return this.getAllFromStore<DataTable>("data_tables");
    },
  };

  // === API Endpoints (Data Panel System) ===

  api_endpoints = {
    insert: async (apiEndpoint: ApiEndpoint): Promise<ApiEndpoint> => {
      const now = new Date().toISOString();
      const apiEndpointWithTimestamps: ApiEndpoint = {
        ...apiEndpoint,
        created_at: apiEndpoint.created_at || now,
        updated_at: apiEndpoint.updated_at || now,
      };
      await this.putToStore("api_endpoints", apiEndpointWithTimestamps);
      return apiEndpointWithTimestamps;
    },

    update: async (
      id: string,
      updates: Partial<ApiEndpoint>,
    ): Promise<ApiEndpoint> => {
      const existing = await this.api_endpoints.getById(id);
      if (!existing) {
        throw new Error(`ApiEndpoint ${id} not found`);
      }
      const updated: ApiEndpoint = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      await this.putToStore("api_endpoints", updated);
      return updated;
    },

    delete: async (id: string): Promise<void> => {
      await this.deleteFromStore("api_endpoints", id);
    },

    getById: async (id: string): Promise<ApiEndpoint | null> => {
      return this.getFromStore<ApiEndpoint>("api_endpoints", id);
    },

    getByProject: async (projectId: string): Promise<ApiEndpoint[]> => {
      return this.getAllByIndex<ApiEndpoint>(
        "api_endpoints",
        "project_id",
        projectId,
      );
    },

    getByName: async (name: string): Promise<ApiEndpoint | null> => {
      const results = await this.getAllByIndex<ApiEndpoint>(
        "api_endpoints",
        "name",
        name,
      );
      return results[0] || null;
    },

    getByTargetDataTable: async (tableName: string): Promise<ApiEndpoint[]> => {
      return this.getAllByIndex<ApiEndpoint>(
        "api_endpoints",
        "targetDataTable",
        tableName,
      );
    },

    getAll: async (): Promise<ApiEndpoint[]> => {
      return this.getAllFromStore<ApiEndpoint>("api_endpoints");
    },
  };

  // === Variables (Data Panel System) ===

  variables = {
    insert: async (variable: Variable): Promise<Variable> => {
      const now = new Date().toISOString();
      const variableWithTimestamps: Variable = {
        ...variable,
        created_at: variable.created_at || now,
        updated_at: variable.updated_at || now,
      };
      await this.putToStore("variables", variableWithTimestamps);
      return variableWithTimestamps;
    },

    update: async (
      id: string,
      updates: Partial<Variable>,
    ): Promise<Variable> => {
      const existing = await this.variables.getById(id);
      if (!existing) {
        throw new Error(`Variable ${id} not found`);
      }
      const updated: Variable = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      await this.putToStore("variables", updated);
      return updated;
    },

    delete: async (id: string): Promise<void> => {
      await this.deleteFromStore("variables", id);
    },

    getById: async (id: string): Promise<Variable | null> => {
      return this.getFromStore<Variable>("variables", id);
    },

    getByProject: async (projectId: string): Promise<Variable[]> => {
      return this.getAllByIndex<Variable>("variables", "project_id", projectId);
    },

    getByName: async (name: string): Promise<Variable | null> => {
      const results = await this.getAllByIndex<Variable>(
        "variables",
        "name",
        name,
      );
      return results[0] || null;
    },

    getByScope: async (scope: string): Promise<Variable[]> => {
      return this.getAllByIndex<Variable>("variables", "scope", scope);
    },

    getByPage: async (pageId: string): Promise<Variable[]> => {
      return this.getAllByIndex<Variable>("variables", "page_id", pageId);
    },

    getAll: async (): Promise<Variable[]> => {
      return this.getAllFromStore<Variable>("variables");
    },
  };

  // === Transformers (Data Panel System) ===

  transformers = {
    insert: async (transformer: Transformer): Promise<Transformer> => {
      const now = new Date().toISOString();
      const transformerWithTimestamps: Transformer = {
        ...transformer,
        created_at: transformer.created_at || now,
        updated_at: transformer.updated_at || now,
      };
      await this.putToStore("transformers", transformerWithTimestamps);
      return transformerWithTimestamps;
    },

    update: async (
      id: string,
      updates: Partial<Transformer>,
    ): Promise<Transformer> => {
      const existing = await this.transformers.getById(id);
      if (!existing) {
        throw new Error(`Transformer ${id} not found`);
      }
      const updated: Transformer = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      await this.putToStore("transformers", updated);
      return updated;
    },

    delete: async (id: string): Promise<void> => {
      await this.deleteFromStore("transformers", id);
    },

    getById: async (id: string): Promise<Transformer | null> => {
      return this.getFromStore<Transformer>("transformers", id);
    },

    getByProject: async (projectId: string): Promise<Transformer[]> => {
      return this.getAllByIndex<Transformer>(
        "transformers",
        "project_id",
        projectId,
      );
    },

    getByName: async (name: string): Promise<Transformer | null> => {
      const results = await this.getAllByIndex<Transformer>(
        "transformers",
        "name",
        name,
      );
      return results[0] || null;
    },

    getByLevel: async (level: string): Promise<Transformer[]> => {
      return this.getAllByIndex<Transformer>("transformers", "level", level);
    },

    getByInputDataTable: async (tableName: string): Promise<Transformer[]> => {
      return this.getAllByIndex<Transformer>(
        "transformers",
        "inputDataTable",
        tableName,
      );
    },

    getByOutputDataTable: async (tableName: string): Promise<Transformer[]> => {
      return this.getAllByIndex<Transformer>(
        "transformers",
        "outputDataTable",
        tableName,
      );
    },

    getAll: async (): Promise<Transformer[]> => {
      return this.getAllFromStore<Transformer>("transformers");
    },
  };

  // === Cache Management ===

  cache = {
    getStats: () => {
      return {
        projects: this.projectCache.getStats(),
      };
    },

    clear: () => {
      this.projectCache.clear();
      console.log("[IndexedDB] All caches cleared");
    },

    resetStats: () => {
      this.projectCache.resetStats();
      console.log("[IndexedDB] Cache statistics reset");
    },
  };

  // === Batch Operations ===

  batch = {
    export: async () => {
      const [project, documents, designTokens] = await Promise.all([
        this.projects.getAll().then((projects) => projects[0] || null),
        this.documents.getAll(),
        this.designTokens.getAll(),
      ]);

      return {
        project,
        document: project
          ? (documents.find((doc) => doc.project_id === project.id)?.document ??
            null)
          : (documents[0]?.document ?? null),
        designTokens,
      };
    },

    import: async (data: {
      project?: Project;
      document?: CompositionDocument;
      designTokens?: DesignToken[];
    }): Promise<void> => {
      if (data.project) {
        await this.projects.insert(data.project);
      }

      if (data.document) {
        const projectId = data.project?.id;
        if (!projectId) {
          throw new Error(
            "Cannot import CompositionDocument without project id",
          );
        }
        await this.documents.put(projectId, data.document);
      }

      if (data.designTokens && data.designTokens.length > 0) {
        await this.designTokens.insertMany(data.designTokens);
      }

      console.log("[IndexedDB] Import completed:", {
        document: Boolean(data.document),
        designTokens: data.designTokens?.length || 0,
      });
    },

    clear: async (): Promise<void> => {
      const db = this.ensureDB();
      return new Promise<void>((resolve, reject) => {
        const stores = [
          "projects",
          "documents",
          "design_tokens",
          "design_themes",
          // ✅ 버전 7: Data Panel 스토어들 추가
          "data_tables",
          "api_endpoints",
          "variables",
          "transformers",
        ];
        const tx = db.transaction(stores, "readwrite");

        let completed = 0;

        stores.forEach((storeName) => {
          const request = tx.objectStore(storeName).clear();
          request.onsuccess = () => {
            completed++;
            if (completed === stores.length) {
              console.log("[IndexedDB] All stores cleared");
              resolve();
            }
          };
          request.onerror = () => reject(request.error);
        });
      });
    },
  };
}

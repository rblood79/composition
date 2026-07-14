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
  CanonicalDocumentBackupRecord,
  SerializedActionRecord,
  SerializedEventRecord,
} from "../types";
import type { CompositionDocument } from "@composition/shared";
import type {
  DataTable,
  ApiEndpoint,
  Variable,
} from "../../../types/builder/data.types";
import { LRUCache } from "./LRUCache";
import {
  BACKUP_GENERATIONS,
  countCanonicalDocumentNodes,
  evaluateDocumentPersist,
  shouldWriteBackup,
  type DocumentPersistOptions,
} from "./documentPersistGuard";

const DB_NAME = "composition";
const DB_VERSION = 20; // 2026-07-14: documents_backup ring 도입 (요소 소실 사건 대응 — 덮어쓰기 전 세대 보존).

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

        // Canonical documents backup ring (DB_VERSION 20 — 2026-07-14)
        // 덮어쓰기 전 세대 보존: 프로젝트당 BACKUP_GENERATIONS 세대,
        // 시간 버킷 (documentPersistGuard.shouldWriteBackup) 로 회전 소모 방지.
        if (!db.objectStoreNames.contains("documents_backup")) {
          const backupStore = db.createObjectStore("documents_backup", {
            keyPath: "backup_id",
          });
          backupStore.createIndex("project_id", "project_id", {
            unique: false,
          });
          console.log("[IndexedDB] Created store: documents_backup");
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

        // ADR-143 Phase 4 (DB_VERSION 19): design_tokens / design_themes store 폐기.
        // canonical document 의 themes/tokens 필드가 시각 토큰 SSOT —
        // dead ThemeStudio (themeStore / TokenService / ThemeService) 동반 제거.
        for (const legacyThemeStore of [
          "design_tokens",
          "design_themes",
        ] as const) {
          if (db.objectStoreNames.contains(legacyThemeStore)) {
            db.deleteObjectStore(legacyThemeStore);
            console.log(
              `[IndexedDB] Deleted legacy store: ${legacyThemeStore} (ADR-143 Phase 4)`,
            );
          }
        }

        // ADR-132 Phase 5 (DB_VERSION 18): legacy `data_tables` store drop.
        // `collections` 신규 store 가 같은 schema 로 대체. 개발 단계 — migration 코드 없음.
        if (db.objectStoreNames.contains("data_tables")) {
          db.deleteObjectStore("data_tables");
          console.log(
            "[IndexedDB] Deleted legacy store: data_tables (ADR-132 Phase 5)",
          );
        }

        // ✅ 버전 7: Data Panel 스토어들 추가
        // Collections store (ADR-132 Phase 5: data_tables → collections rename)
        if (!db.objectStoreNames.contains("collections")) {
          const dataTablesStore = db.createObjectStore("collections", {
            keyPath: "id",
          });
          dataTablesStore.createIndex("project_id", "project_id", {
            unique: false,
          });
          dataTablesStore.createIndex("name", "name", { unique: false });
          console.log("[IndexedDB] Created store: collections");
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
          apiEndpointsStore.createIndex(
            "targetCollection",
            "targetCollection",
            {
              unique: false,
            },
          );
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

        // ADR-132 Phase 7: legacy `transformers` store drop (dead infrastructure cleanup).
        // 3-Level Transformer 시스템 전체 제거 — 외부 caller 0건 검증 완료.
        if (db.objectStoreNames.contains("transformers")) {
          db.deleteObjectStore("transformers");
          console.log(
            "[IndexedDB] Deleted legacy store: transformers (ADR-132 Phase 7)",
          );
        }

        // ADR-131 Phase 7 — events / actions root collection stores
        // (design §4 D1=(b) — design_themes / variables / collections /
        //  api_endpoints 패턴 정합)
        //
        // **data store 부재 (Phase 7-revert, 2026-05-13)**: 사용자 framing 정정으로
        // `data` store 는 기존 `collections` / `api_endpoints` 와 중복 개념으로
        // 판정 → 본 upgrade path 에서 제거. `CompositionDocument.data` root field 와
        // `SerializedData` type 은 schema 영역에서 별도 framing 정리 (현 commit
        // scope 외). DB_VERSION 16 의 (단명 land) `data` store 는 17 에서 drop.
        if (!db.objectStoreNames.contains("events")) {
          const eventsStore = db.createObjectStore("events", {
            keyPath: "id",
          });
          eventsStore.createIndex("project_id", "project_id", {
            unique: false,
          });
          eventsStore.createIndex("target", "target", { unique: false });
          eventsStore.createIndex("kind", "kind", { unique: false });
          console.log("[IndexedDB] Created store: events");
        }

        // DB_VERSION 16 에서 단명 생성된 `data` store 를 17 에서 drop.
        // 사용자 framing — `collections` / `api_endpoints` 와 중복 개념.
        if (db.objectStoreNames.contains("data")) {
          db.deleteObjectStore("data");
          console.log(
            "[IndexedDB] Deleted store: data (ADR-131 Phase 7-revert)",
          );
        }

        if (!db.objectStoreNames.contains("actions")) {
          const actionsStore = db.createObjectStore("actions", {
            keyPath: "id",
          });
          actionsStore.createIndex("project_id", "project_id", {
            unique: false,
          });
          actionsStore.createIndex("kind", "kind", { unique: false });
          console.log("[IndexedDB] Created store: actions");
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

  /**
   * documents_backup ring 에 기존 row 세대 보존 (2026-07-14).
   *
   * - 시간 버킷: 최신 백업이 BACKUP_MIN_INTERVAL_MS 이내면 skip.
   * - 프로젝트당 BACKUP_GENERATIONS 초과분은 오래된 것부터 prune.
   * - 백업 실패는 본 write 를 막지 않는다 (best-effort — 원본 persist 가 우선).
   */
  private async writeDocumentBackup(
    existing: CanonicalDocumentRecord,
  ): Promise<void> {
    try {
      const backups = await this.getAllByIndex<CanonicalDocumentBackupRecord>(
        "documents_backup",
        "project_id",
        existing.project_id,
      );
      backups.sort((a, b) => b.updated_at.localeCompare(a.updated_at));

      if (!shouldWriteBackup(backups[0]?.updated_at, Date.now())) {
        return;
      }

      const backup: CanonicalDocumentBackupRecord = {
        backup_id: `${existing.project_id}::${existing.updated_at}`,
        project_id: existing.project_id,
        document: existing.document,
        updated_at: existing.updated_at,
      };
      await this.putToStore("documents_backup", backup);

      const pruneTargets = [backup, ...backups]
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(BACKUP_GENERATIONS);
      for (const stale of pruneTargets) {
        await this.deleteFromStore("documents_backup", stale.backup_id);
      }
    } catch (error) {
      console.warn("[IndexedDB] document backup write failed:", error);
    }
  }

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

  // === Canonical Documents (ADR-116 primary storage) ===

  documents = {
    /**
     * 급감 가드 + 백업 ring 경유 write (2026-07-14 요소 소실 사건 대응).
     *
     * - node 수 급감 write 는 기본 거부 (throw 하지 않고 skip + 경고 —
     *   실패 모드가 "새로고침 시 DB 상태로 복원" 이 되도록).
     * - 덮어쓰기 전 기존 row 를 documents_backup ring 에 보존 (프로젝트당
     *   BACKUP_GENERATIONS 세대, BACKUP_MIN_INTERVAL_MS 시간 버킷).
     */
    put: async (
      projectId: string,
      document: CompositionDocument,
      options?: DocumentPersistOptions,
    ): Promise<CompositionDocument> => {
      const existing = await this.getFromStore<CanonicalDocumentRecord>(
        "documents",
        projectId,
      );

      if (existing) {
        const decision = evaluateDocumentPersist(
          countCanonicalDocumentNodes(existing.document),
          countCanonicalDocumentNodes(document),
          options,
        );
        if (!decision.allowed) {
          console.error(
            "🚨 [IndexedDB] canonical document write BLOCKED " +
              `(project ${projectId}${options?.reason ? `, from ${options.reason}` : ""}): ` +
              decision.blockReason,
          );
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("composition:document-persist-blocked", {
                detail: {
                  projectId,
                  prevCount: decision.prevCount,
                  nextCount: decision.nextCount,
                  reason: options?.reason ?? null,
                },
              }),
            );
          }
          return document;
        }

        await this.writeDocumentBackup(existing);
      }

      const record: CanonicalDocumentRecord = {
        project_id: projectId,
        document,
        updated_at: new Date().toISOString(),
      };
      await this.putToStore("documents", record);
      return document;
    },

    /** 백업 ring 조회 (최신순) — 사고 시 콘솔 복구용 진입점 */
    getBackups: async (
      projectId: string,
    ): Promise<CanonicalDocumentBackupRecord[]> => {
      const backups = await this.getAllByIndex<CanonicalDocumentBackupRecord>(
        "documents_backup",
        "project_id",
        projectId,
      );
      return backups.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
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

  collections = {
    insert: async (dataTable: DataTable): Promise<DataTable> => {
      const now = new Date().toISOString();
      const dataTableWithTimestamps: DataTable = {
        ...dataTable,
        created_at: dataTable.created_at || now,
        updated_at: dataTable.updated_at || now,
      };
      await this.putToStore("collections", dataTableWithTimestamps);
      return dataTableWithTimestamps;
    },

    update: async (
      id: string,
      updates: Partial<DataTable>,
    ): Promise<DataTable> => {
      const existing = await this.collections.getById(id);
      if (!existing) {
        throw new Error(`DataTable ${id} not found`);
      }
      const updated: DataTable = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      await this.putToStore("collections", updated);
      return updated;
    },

    delete: async (id: string): Promise<void> => {
      await this.deleteFromStore("collections", id);
    },

    getById: async (id: string): Promise<DataTable | null> => {
      return this.getFromStore<DataTable>("collections", id);
    },

    getByProject: async (projectId: string): Promise<DataTable[]> => {
      return this.getAllByIndex<DataTable>(
        "collections",
        "project_id",
        projectId,
      );
    },

    getByName: async (name: string): Promise<DataTable | null> => {
      const results = await this.getAllByIndex<DataTable>(
        "collections",
        "name",
        name,
      );
      return results[0] || null;
    },

    getAll: async (): Promise<DataTable[]> => {
      return this.getAllFromStore<DataTable>("collections");
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

  // === ADR-131 Phase 7 — Root collection stores ===

  events = {
    insert: async (
      record: SerializedEventRecord,
    ): Promise<SerializedEventRecord> => {
      await this.putToStore("events", record);
      return record;
    },

    update: async (
      id: string,
      patch: Partial<SerializedEventRecord>,
    ): Promise<SerializedEventRecord> => {
      const existing = await this.events.getById(id);
      if (!existing) throw new Error(`Event ${id} not found`);
      const updated: SerializedEventRecord = {
        ...existing,
        ...patch,
        id: existing.id,
        type: "event",
      };
      await this.putToStore("events", updated);
      return updated;
    },

    delete: async (id: string): Promise<void> => {
      await this.deleteFromStore("events", id);
    },

    getById: async (id: string): Promise<SerializedEventRecord | null> => {
      return this.getFromStore<SerializedEventRecord>("events", id);
    },

    getByProject: async (
      projectId: string,
    ): Promise<SerializedEventRecord[]> => {
      return this.getAllByIndex<SerializedEventRecord>(
        "events",
        "project_id",
        projectId,
      );
    },

    getByTarget: async (target: string): Promise<SerializedEventRecord[]> => {
      return this.getAllByIndex<SerializedEventRecord>(
        "events",
        "target",
        target,
      );
    },

    getAll: async (): Promise<SerializedEventRecord[]> => {
      return this.getAllFromStore<SerializedEventRecord>("events");
    },
  };

  // ADR-131 Phase 7-revert (2026-05-13): `data` store 제거 — 기존 `collections`
  // / `api_endpoints` 와 중복 개념. DB_VERSION 17 에서 deleteObjectStore.

  actions = {
    insert: async (
      record: SerializedActionRecord,
    ): Promise<SerializedActionRecord> => {
      await this.putToStore("actions", record);
      return record;
    },

    update: async (
      id: string,
      patch: Partial<SerializedActionRecord>,
    ): Promise<SerializedActionRecord> => {
      const existing = await this.actions.getById(id);
      if (!existing) throw new Error(`Action ${id} not found`);
      const updated: SerializedActionRecord = {
        ...existing,
        ...patch,
        id: existing.id,
        type: "action",
      };
      await this.putToStore("actions", updated);
      return updated;
    },

    delete: async (id: string): Promise<void> => {
      await this.deleteFromStore("actions", id);
    },

    getById: async (id: string): Promise<SerializedActionRecord | null> => {
      return this.getFromStore<SerializedActionRecord>("actions", id);
    },

    getByProject: async (
      projectId: string,
    ): Promise<SerializedActionRecord[]> => {
      return this.getAllByIndex<SerializedActionRecord>(
        "actions",
        "project_id",
        projectId,
      );
    },

    getAll: async (): Promise<SerializedActionRecord[]> => {
      return this.getAllFromStore<SerializedActionRecord>("actions");
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
}

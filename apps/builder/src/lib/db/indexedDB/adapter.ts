/**
 * IndexedDB Adapter Implementation
 *
 * 브라우저의 IndexedDB를 사용한 로컬 데이터베이스 구현
 * - 빠른 로컬 저장 (1-5ms)
 * - 오프라인 지원
 * - DatabaseAdapter 인터페이스 구현
 */

import type { DatabaseAdapter, Project } from "../types";
import type { CollectionRuntimeRow } from "@composition/shared";
import type {
  DataTable,
  ApiEndpoint,
  Variable,
} from "../../../types/builder/data.types";
import { LRUCache } from "./LRUCache";
import { ASSETS_STORE, ASSET_GC_STORE } from "../../assets/assetSchema";
import {
  CACHE_BYTES_LIMIT,
  openCacheDatabase,
} from "../../storage/storageProtection";

const DB_NAME = "composition";
const DB_VERSION = 25; // 2026-10-05 (ADR-248 후속): 구 canonical 문서 store 4개 삭제.

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
        // 다른 탭이 새 버전으로 업그레이드하려 해도 편집 중인 이 탭의 연결은 닫지 않는다 —
        // 닫으면 이후 백그라운드 저장이 조용히 실패한다 (HC1). 업그레이드하는 탭이
        // onblocked 로 기다리며 알린다. 읽기 전용 자산 reader 는 즉시 닫는다 (assetReader).
        this.db.onversionchange = () => {
          console.warn(
            "[IndexedDB] 다른 탭이 새 DB 버전을 기다립니다 — 이 탭을 새로고침하면 진행됩니다.",
          );
        };
        resolve();
      };

      request.onblocked = () => {
        console.warn(
          "[IndexedDB] 다른 탭이 이전 DB 버전을 열고 있어 업그레이드가 대기 중입니다 — 다른 builder 탭을 닫거나 새로고침하세요.",
        );
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Projects store
        if (!db.objectStoreNames.contains("projects")) {
          db.createObjectStore("projects", { keyPath: "id" });
          console.log("[IndexedDB] Created store: projects");
        }

        for (const legacyStore of [
          "pages",
          "elements",
          "layouts",
          "metadata",
          "history",
          "design_" + "variables",
          // ADR-248: 구 canonical 문서 (단일 row · head/parts · 백업 ring). 문서는 catalog DB
          // (`CATALOG_DB_NAME`) 에 저장되고 구 포맷은 열지 않는다 — 개발 단계라 이전 없음.
          "documents",
          "document_heads",
          "document_parts",
          "documents_backup",
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

        // ADR-218 (DB_VERSION 22): collection_runtime store — runtimeData(API 응답)
        // 캐시 영속. collections 레코드와 분리 (대안 B) 라 정의 레코드 크기 불변,
        // History 밖. `sourceRev` 지문으로 hydration 유효성 판정, collection 삭제 시
        // 같이 정리 (고아 0). keyPath = collectionId (collection 1:1).
        if (!db.objectStoreNames.contains("collection_runtime")) {
          const runtimeStore = db.createObjectStore("collection_runtime", {
            keyPath: "collectionId",
          });
          runtimeStore.createIndex("project_id", "project_id", {
            unique: false,
          });
          console.log("[IndexedDB] Created store: collection_runtime");
        }

        // ADR-235 (DB_VERSION 23): 해시 자산 저장소. `assets` = 원본 바이트 (keyPath hash),
        // `asset_gc` = 참조 epoch · 세션 pin · 후보 (breakdown §3.1). 참조 공개 · pin 해제 ·
        // 삭제는 두 store 를 함께 포함하는 readwrite 트랜잭션 하나로 직렬화된다.
        if (!db.objectStoreNames.contains(ASSETS_STORE)) {
          db.createObjectStore(ASSETS_STORE, { keyPath: "hash" });
          console.log("[IndexedDB] Created store: assets");
        }
        if (!db.objectStoreNames.contains(ASSET_GC_STORE)) {
          db.createObjectStore(ASSET_GC_STORE, { keyPath: "hash" });
          console.log("[IndexedDB] Created store: asset_gc");
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

        // DB_VERSION 16 에서 단명 생성된 `data` store 를 17 에서 drop.
        // 사용자 framing — `collections` / `api_endpoints` 와 중복 개념.
        if (db.objectStoreNames.contains("data")) {
          db.deleteObjectStore("data");
          console.log(
            "[IndexedDB] Deleted store: data (ADR-131 Phase 7-revert)",
          );
        }

        // ADR-248 (DB_VERSION 24): `events` / `actions` 는 구 문서 root 의 fan-out mirror 였다
        // (ADR-131 Phase 7). 새 모델의 interaction 은 graph entry 하나에만 기록하므로 두 store 를
        // 만들지 않고, 있던 것은 지운다 — 구 문서 store 안의 원본은 그대로 남는다.
        for (const mirror of ["events", "actions"]) {
          if (db.objectStoreNames.contains(mirror)) {
            db.deleteObjectStore(mirror);
            console.log(`[IndexedDB] Deleted store: ${mirror} (ADR-248)`);
          }
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

  // === Collection Runtime Cache (ADR-218) ===
  // runtimeData(API 응답) 캐시 — collections 정의와 분리 영속, History 밖.
  // ADR-235 Phase 5 — Storage Buckets 지원 시 `persisted: false` bucket 의 캐시 DB (브라우저가
  //   원본과 따로 비운다), 미지원이면 원본 DB 의 같은 store + 용량 상한.
  private cacheMoved = false;

  /** 이번 연산의 캐시 DB — bucket 이면 새 연결 (연산 뒤 닫는다), 아니면 원본 DB 연결 */
  private async runtimeCacheDb(): Promise<{ db: IDBDatabase; close: boolean }> {
    const bucketDb = await openCacheDatabase();
    if (!bucketDb) return { db: this.ensureDB(), close: false };
    if (!this.cacheMoved) {
      this.cacheMoved = true;
      // bucket 으로 옮긴 뒤 원본 DB 의 옛 캐시는 비운다 (캐시라 이관하지 않는다)
      await this.clearStore(this.ensureDB(), "collection_runtime").catch(
        () => {},
      );
    }
    return { db: bucketDb, close: true };
  }

  private clearStore(db: IDBDatabase, storeName: string): Promise<void> {
    if (!db.objectStoreNames.contains(storeName)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private runtimeRequest<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    return this.runtimeCacheDb().then(
      ({ db, close }) =>
        new Promise<T>((resolve, reject) => {
          const tx = db.transaction("collection_runtime", mode);
          const request = run(tx.objectStore("collection_runtime"));
          tx.oncomplete = () => {
            if (close) db.close();
            resolve(request.result);
          };
          tx.onerror = () => {
            if (close) db.close();
            reject(tx.error ?? request.error);
          };
        }),
    );
  }

  /** 캐시 용량 상한 — 넘으면 오래된 행부터 지운다 (CACHE_BYTES_LIMIT) */
  private async trimRuntimeCache(): Promise<void> {
    const rows = await this.runtimeRequest(
      "readonly",
      (store) => store.getAll() as IDBRequest<CollectionRuntimeRow[]>,
    );
    let total = rows.reduce((sum, row) => sum + JSON.stringify(row).length, 0);
    if (total <= CACHE_BYTES_LIMIT) return;
    const oldest = [...rows].sort((a, b) =>
      String(a.updated_at ?? "").localeCompare(String(b.updated_at ?? "")),
    );
    for (const row of oldest) {
      if (total <= CACHE_BYTES_LIMIT) break;
      await this.runtimeRequest("readwrite", (store) =>
        store.delete(row.collectionId),
      );
      total -= JSON.stringify(row).length;
    }
  }

  /** 버려도 되는 캐시 전부 비우기 — quota 재시도 · 사용률 선제 정리 */
  async clearCaches(): Promise<void> {
    await this.clearStore(this.ensureDB(), "collection_runtime").catch(
      () => {},
    );
    const bucketDb = await openCacheDatabase();
    if (bucketDb) {
      await this.clearStore(bucketDb, "collection_runtime").finally(() =>
        bucketDb.close(),
      );
    }
  }

  collection_runtime = {
    get: async (collectionId: string): Promise<CollectionRuntimeRow | null> => {
      const row = await this.runtimeRequest(
        "readonly",
        (store) =>
          store.get(collectionId) as IDBRequest<
            CollectionRuntimeRow | undefined
          >,
      );
      return row ?? null;
    },

    put: async (row: CollectionRuntimeRow): Promise<void> => {
      await this.runtimeRequest("readwrite", (store) =>
        store.put({
          ...row,
          updated_at: row.updated_at || new Date().toISOString(),
        }),
      );
      await this.trimRuntimeCache();
    },

    delete: async (collectionId: string): Promise<void> => {
      await this.runtimeRequest("readwrite", (store) =>
        store.delete(collectionId),
      );
    },

    getByProject: async (
      projectId: string,
    ): Promise<CollectionRuntimeRow[]> => {
      return this.runtimeRequest(
        "readonly",
        (store) =>
          store.index("project_id").getAll(projectId) as IDBRequest<
            CollectionRuntimeRow[]
          >,
      );
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

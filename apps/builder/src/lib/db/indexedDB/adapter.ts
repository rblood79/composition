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
  HistoryEntry,
  SyncMetadata,
  CanonicalDocumentRecord,
} from "../types";
import type { Element, Page } from "../../../types/core/store.types";
import type {
  DesignToken,
  DesignTheme,
  DesignVariable,
} from "../../../types/theme";
import type { CompositionDocument } from "@composition/shared";
import type { Layout } from "../../../types/builder/layout.types";
import type {
  DataTable,
  ApiEndpoint,
  Variable,
  Transformer,
} from "../../../types/builder/data.types";
import { LRUCache } from "./LRUCache";

const DB_NAME = "composition";
const DB_VERSION = 13; // Page/layout order uses canonical CompositionDocument.children[] only.

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

  for (const storeName of ["documents", "pages", "layouts", "elements"]) {
    stripLegacyOrderPayloadsFromStore(transaction, storeName);
  }
}

export class IndexedDBAdapter implements DatabaseAdapter {
  private db: IDBDatabase | null = null;

  // LRU Caches for frequently accessed data
  private elementCache = new LRUCache<Element>(1000);
  private pageCache = new LRUCache<Page>(100);
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

        // Pages store
        if (!db.objectStoreNames.contains("pages")) {
          const pagesStore = db.createObjectStore("pages", { keyPath: "id" });
          pagesStore.createIndex("project_id", "project_id", { unique: false });
          console.log("[IndexedDB] Created store: pages");
        } else {
          const transaction = (event.target as IDBOpenDBRequest).transaction;
          if (transaction) {
            const pagesStore = transaction.objectStore("pages");
            if (pagesStore.indexNames.contains("order_num")) {
              pagesStore.deleteIndex("order_num");
              console.log("[IndexedDB] Removed index: pages.order_num");
            }
          }
        }

        // Elements store (가장 중요!)
        if (!db.objectStoreNames.contains("elements")) {
          const elementsStore = db.createObjectStore("elements", {
            keyPath: "id",
          });
          elementsStore.createIndex("page_id", "page_id", { unique: false });
          elementsStore.createIndex("parent_id", "parent_id", {
            unique: false,
          });
          console.log("[IndexedDB] Created store: elements");
        } else {
          const transaction = (event.target as IDBOpenDBRequest).transaction;
          if (transaction) {
            const elementsStore = transaction.objectStore("elements");
            if (elementsStore.indexNames.contains("order_num")) {
              elementsStore.deleteIndex("order_num");
              console.log("[IndexedDB] Removed index: elements.order_num");
            }
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

        // History store
        if (!db.objectStoreNames.contains("history")) {
          const historyStore = db.createObjectStore("history", {
            keyPath: "id",
          });
          historyStore.createIndex("page_id", "page_id", { unique: false });
          historyStore.createIndex("created_at", "created_at", {
            unique: false,
          });
          console.log("[IndexedDB] Created store: history");
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

        // Metadata store (sync 상태 저장)
        if (!db.objectStoreNames.contains("metadata")) {
          db.createObjectStore("metadata", { keyPath: "project_id" });
          console.log("[IndexedDB] Created store: metadata");
        }

        // ✅ 버전 4: Layouts store (Layout/Slot System)
        // ✅ 버전 6: slug 인덱스 추가 (Nested Routes)
        if (!db.objectStoreNames.contains("layouts")) {
          const layoutsStore = db.createObjectStore("layouts", {
            keyPath: "id",
          });
          layoutsStore.createIndex("project_id", "project_id", {
            unique: false,
          });
          layoutsStore.createIndex("name", "name", { unique: false });
          layoutsStore.createIndex("slug", "slug", { unique: false });
          console.log("[IndexedDB] Created store: layouts with slug index");
        } else {
          // ✅ 버전 6: 기존 layouts 스토어에 slug 인덱스 추가
          const transaction = (event.target as IDBOpenDBRequest).transaction;
          if (transaction) {
            const layoutsStore = transaction.objectStore("layouts");
            if (layoutsStore.indexNames.contains("order_num")) {
              layoutsStore.deleteIndex("order_num");
              console.log("[IndexedDB] Removed index: layouts.order_num");
            }
            if (!layoutsStore.indexNames.contains("slug")) {
              layoutsStore.createIndex("slug", "slug", { unique: false });
              console.log("[IndexedDB] Added index: layouts.slug");
            }
          }
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
      this.elementCache.clear();
      this.pageCache.clear();
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

  // === Pages ===

  pages = {
    insert: async (page: Page): Promise<Page> => {
      const result = await this.putToStore("pages", page);
      this.pageCache.set(page.id, result);
      return result;
    },

    insertWithBody: async (
      page: Page,
      bodyElement: Element,
    ): Promise<{ bodyElement: Element; page: Page }> => {
      const db = this.ensureDB();

      return new Promise((resolve, reject) => {
        const tx = db.transaction(["pages", "elements"], "readwrite");
        const pagesStore = tx.objectStore("pages");
        const elementsStore = tx.objectStore("elements");

        pagesStore.put(page);
        elementsStore.put(bodyElement);

        tx.oncomplete = () => {
          this.pageCache.set(page.id, page);
          this.elementCache.set(bodyElement.id, bodyElement);
          resolve({ page, bodyElement });
        };

        tx.onerror = () => {
          reject(tx.error);
        };
      });
    },

    insertMany: async (pages: Page[]): Promise<Page[]> => {
      if (pages.length === 0) {
        return [];
      }

      const db = this.ensureDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("pages", "readwrite");
        const store = tx.objectStore("pages");

        // Queue all operations - single transaction commit
        pages.forEach((page) => {
          store.put(page);
        });

        // Resolve when entire transaction completes
        tx.oncomplete = () => {
          // Cache all inserted pages
          this.pageCache.setMany(
            pages.map((page) => ({ key: page.id, value: page })),
          );

          if (process.env.NODE_ENV === "development") {
            console.log(
              `✅ [IndexedDB] pages.insertMany completed: ${pages.length} pages (cached)`,
            );
          }
          resolve(pages);
        };

        tx.onerror = () => {
          console.error(
            "❌ [IndexedDB] pages.insertMany transaction failed:",
            tx.error,
          );
          reject(tx.error);
        };
      });
    },

    update: async (id: string, data: Partial<Page>): Promise<Page> => {
      let existing = this.pageCache.get(id);

      if (!existing) {
        existing = await this.getFromStore<Page>("pages", id);
      }

      if (!existing) {
        throw new Error(`Page not found: ${id}`);
      }

      const updated = {
        ...existing,
        ...data,
        updated_at: new Date().toISOString(),
      };
      const result = await this.putToStore("pages", updated);
      this.pageCache.set(id, result);
      return result;
    },

    delete: async (id: string): Promise<void> => {
      await this.deleteFromStore("pages", id);
      this.pageCache.delete(id);
    },

    deleteWithElements: async (
      pageId: string,
      elementIds: string[],
    ): Promise<void> => {
      const db = this.ensureDB();

      return new Promise((resolve, reject) => {
        const tx = db.transaction(["pages", "elements"], "readwrite");
        const pagesStore = tx.objectStore("pages");
        const elementsStore = tx.objectStore("elements");

        pagesStore.delete(pageId);
        elementIds.forEach((elementId) => {
          elementsStore.delete(elementId);
        });

        tx.oncomplete = () => {
          this.pageCache.delete(pageId);
          this.elementCache.deleteMany(elementIds);
          resolve();
        };

        tx.onerror = () => {
          reject(tx.error);
        };
      });
    },

    getById: async (id: string): Promise<Page | null> => {
      const cached = this.pageCache.get(id);

      if (cached) {
        return cached;
      }

      const page = await this.getFromStore<Page>("pages", id);

      if (page) {
        this.pageCache.set(id, page);
      }

      return page;
    },

    getByProject: async (projectId: string): Promise<Page[]> => {
      return this.getAllByIndex<Page>("pages", "project_id", projectId);
    },

    getAll: async (): Promise<Page[]> => {
      return this.getAllFromStore<Page>("pages");
    },
  };

  // === Elements (가장 중요!) ===

  elements = {
    insert: async (element: Element): Promise<Element> => {
      const result = await this.putToStore("elements", element);
      // Cache the inserted element
      this.elementCache.set(element.id, result);
      return result;
    },

    insertMany: async (elements: Element[]): Promise<Element[]> => {
      if (elements.length === 0) {
        return [];
      }

      const db = this.ensureDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("elements", "readwrite");
        const store = tx.objectStore("elements");

        // Queue all operations - single transaction commit
        elements.forEach((element) => {
          store.put(element);
        });

        // Resolve when entire transaction completes
        tx.oncomplete = () => {
          // Cache all inserted elements
          this.elementCache.setMany(
            elements.map((el) => ({ key: el.id, value: el })),
          );

          resolve(elements);
        };

        tx.onerror = () => {
          console.error(
            "❌ [IndexedDB] insertMany transaction failed:",
            tx.error,
          );
          reject(tx.error);
        };
      });
    },

    put: async (element: Element): Promise<Element> => {
      const result = await this.putToStore("elements", element);
      this.elementCache.set(element.id, result);
      return result;
    },

    update: async (id: string, data: Partial<Element>): Promise<Element> => {
      // Try cache first
      let existing = this.elementCache.get(id);

      if (!existing) {
        // Cache miss - read from IndexedDB
        existing = await this.getFromStore<Element>("elements", id);
      }

      if (!existing) {
        throw new Error(`Element not found: ${id}`);
      }

      const updated = {
        ...existing,
        ...data,
        updated_at: new Date().toISOString(),
      };
      const result = await this.putToStore("elements", updated);

      // Update cache
      this.elementCache.set(id, result);

      return result;
    },

    updateMany: async (
      updates: Array<{ id: string; data: Partial<Element> }>,
    ): Promise<Element[]> => {
      if (updates.length === 0) {
        return [];
      }

      const db = this.ensureDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("elements", "readwrite");
        const store = tx.objectStore("elements");

        const results: Element[] = [];

        // Queue all get+put operations
        updates.forEach(({ id, data }) => {
          const getRequest = store.get(id);

          getRequest.onsuccess = () => {
            const existing = getRequest.result;
            if (existing) {
              const updated = {
                ...existing,
                ...data,
                updated_at: new Date().toISOString(),
              };
              store.put(updated);
              results.push(updated);
            }
          };
        });

        // Resolve when entire transaction completes
        tx.oncomplete = () => {
          // Update cache with all updated elements
          this.elementCache.setMany(
            results.map((el) => ({ key: el.id, value: el })),
          );

          if (process.env.NODE_ENV === "development") {
            console.log(
              `✅ [IndexedDB] updateMany completed: ${results.length} elements (cached)`,
            );
          }
          resolve(results);
        };

        tx.onerror = () => {
          console.error(
            "❌ [IndexedDB] updateMany transaction failed:",
            tx.error,
          );
          reject(tx.error);
        };
      });
    },

    delete: async (id: string): Promise<void> => {
      await this.deleteFromStore("elements", id);
      // Remove from cache
      this.elementCache.delete(id);
    },

    deleteMany: async (ids: string[]): Promise<void> => {
      if (ids.length === 0) {
        return;
      }

      const db = this.ensureDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("elements", "readwrite");
        const store = tx.objectStore("elements");

        // Queue all delete operations - single transaction commit
        ids.forEach((id) => {
          store.delete(id);
        });

        // Resolve when entire transaction completes
        tx.oncomplete = () => {
          // Remove from cache
          this.elementCache.deleteMany(ids);

          resolve();
        };

        tx.onerror = () => {
          console.error(
            "❌ [IndexedDB] deleteMany transaction failed:",
            tx.error,
          );
          reject(tx.error);
        };
      });
    },

    getById: async (id: string): Promise<Element | null> => {
      // Try cache first
      const cached = this.elementCache.get(id);

      if (cached) {
        return cached;
      }

      // Cache miss - read from IndexedDB
      const element = await this.getFromStore<Element>("elements", id);

      if (element) {
        // Cache for future access
        this.elementCache.set(id, element);
      }

      return element;
    },

    getByPage: async (pageId: string): Promise<Element[]> => {
      const rows = await this.getAllByIndex<Element>(
        "elements",
        "page_id",
        pageId,
      );
      return rows;
    },

    getChildren: async (parentId: string): Promise<Element[]> => {
      const rows = await this.getAllByIndex<Element>(
        "elements",
        "parent_id",
        parentId,
      );
      return rows;
    },

    getDescendants: async (parentId: string): Promise<Element[]> => {
      // canonical (composition-1.0+): parent_id BFS
      const result: Element[] = [];
      const queue: string[] = [parentId];
      const seen = new Set<string>([parentId]);
      while (queue.length > 0) {
        const pid = queue.shift() as string;
        const children = await this.getAllByIndex<Element>(
          "elements",
          "parent_id",
          pid,
        );
        for (const child of children) {
          if (seen.has(child.id)) continue;
          seen.add(child.id);
          result.push(child);
          queue.push(child.id);
        }
      }
      return result;
    },

    getAll: async (): Promise<Element[]> => {
      const rows = await this.getAllFromStore<Element>("elements");
      return rows;
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

  // === History ===

  history = {
    insert: async (entry: HistoryEntry): Promise<HistoryEntry> => {
      return this.putToStore("history", entry);
    },

    getByPage: async (pageId: string, limit = 50): Promise<HistoryEntry[]> => {
      const db = this.ensureDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("history", "readonly");
        const store = tx.objectStore("history");
        const index = store.index("page_id");
        const request = index.getAll(pageId);

        request.onsuccess = () => {
          const results = request.result
            .sort(
              (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime(),
            )
            .slice(0, limit);
          resolve(results);
        };
        request.onerror = () => reject(request.error);
      });
    },

    deleteOldEntries: async (
      pageId: string,
      keepCount: number,
    ): Promise<void> => {
      const entries = await this.history.getByPage(pageId, 1000);
      const toDelete = entries.slice(keepCount);

      const db = this.ensureDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("history", "readwrite");
        const store = tx.objectStore("history");

        let completed = 0;
        toDelete.forEach((entry) => {
          const request = store.delete(entry.id);
          request.onsuccess = () => {
            completed++;
            if (completed === toDelete.length) {
              resolve();
            }
          };
          request.onerror = () => reject(request.error);
        });

        if (toDelete.length === 0) {
          resolve();
        }
      });
    },

    clear: async (pageId: string): Promise<void> => {
      const entries = await this.history.getByPage(pageId, 1000);

      const db = this.ensureDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("history", "readwrite");
        const store = tx.objectStore("history");

        let completed = 0;
        entries.forEach((entry) => {
          const request = store.delete(entry.id);
          request.onsuccess = () => {
            completed++;
            if (completed === entries.length) {
              resolve();
            }
          };
          request.onerror = () => reject(request.error);
        });

        if (entries.length === 0) {
          resolve();
        }
      });
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

  // === Design Variables (G.2 Variable Reference System) ===

  designVariables = {
    insert: async (variable: DesignVariable): Promise<DesignVariable> => {
      const now = new Date().toISOString();
      const variableWithTimestamps: DesignVariable = {
        ...variable,
        created_at: variable.created_at || now,
        updated_at: variable.updated_at || now,
      };
      await this.putToStore("design_variables", variableWithTimestamps);
      return variableWithTimestamps;
    },

    insertMany: async (
      variables: DesignVariable[],
    ): Promise<DesignVariable[]> => {
      if (variables.length === 0) {
        return [];
      }
      const db = this.ensureDB();
      const now = new Date().toISOString();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("design_variables", "readwrite");
        const store = tx.objectStore("design_variables");

        const variablesWithTimestamps = variables.map((v) => ({
          ...v,
          created_at: v.created_at || now,
          updated_at: v.updated_at || now,
        }));

        variablesWithTimestamps.forEach((variable) => {
          store.put(variable);
        });

        tx.oncomplete = () => resolve(variablesWithTimestamps);
        tx.onerror = () => reject(tx.error);
      });
    },

    update: async (
      id: string,
      updates: Partial<DesignVariable>,
    ): Promise<DesignVariable> => {
      const existing = await this.designVariables.getById(id);
      if (!existing) {
        throw new Error(`DesignVariable ${id} not found`);
      }
      const updated: DesignVariable = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      await this.putToStore("design_variables", updated);
      return updated;
    },

    delete: async (id: string): Promise<void> => {
      await this.deleteFromStore("design_variables", id);
    },

    getById: async (id: string): Promise<DesignVariable | null> => {
      return this.getFromStore<DesignVariable>("design_variables", id);
    },

    getByProject: async (projectId: string): Promise<DesignVariable[]> => {
      return this.getAllByIndex<DesignVariable>(
        "design_variables",
        "project_id",
        projectId,
      );
    },

    getByName: async (
      projectId: string,
      name: string,
    ): Promise<DesignVariable | null> => {
      const variables = await this.designVariables.getByProject(projectId);
      return variables.find((v) => v.name === name) || null;
    },

    getAll: async (): Promise<DesignVariable[]> => {
      return this.getAllFromStore<DesignVariable>("design_variables");
    },
  };

  // === Layouts (Layout/Slot System) ===

  layouts = {
    insert: async (layout: Layout): Promise<Layout> => {
      const now = new Date().toISOString();
      const layoutWithTimestamps: Layout = {
        ...layout,
        created_at: layout.created_at || now,
        updated_at: layout.updated_at || now,
      };
      await this.putToStore("layouts", layoutWithTimestamps);
      return layoutWithTimestamps;
    },

    update: async (id: string, updates: Partial<Layout>): Promise<Layout> => {
      const existing = await this.layouts.getById(id);
      if (!existing) {
        throw new Error(`Layout ${id} not found`);
      }
      const updated: Layout = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      await this.putToStore("layouts", updated);
      return updated;
    },

    delete: async (id: string): Promise<void> => {
      await this.deleteFromStore("layouts", id);
    },

    getById: async (id: string): Promise<Layout | null> => {
      return this.getFromStore<Layout>("layouts", id);
    },

    getByProject: async (projectId: string): Promise<Layout[]> => {
      return this.getAllByIndex<Layout>("layouts", "project_id", projectId);
    },

    getAll: async (): Promise<Layout[]> => {
      return this.getAllFromStore<Layout>("layouts");
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

  // === Metadata ===

  metadata = {
    get: async (): Promise<SyncMetadata | null> => {
      const all = await this.getAllFromStore<SyncMetadata>("metadata");
      return all[0] || null;
    },

    set: async (data: SyncMetadata): Promise<void> => {
      await this.putToStore("metadata", data);
    },

    update: async (data: Partial<SyncMetadata>): Promise<void> => {
      const existing = await this.metadata.get();
      if (!existing) {
        throw new Error("Metadata not found. Call set() first.");
      }
      const updated = { ...existing, ...data };
      await this.putToStore("metadata", updated);
    },
  };

  // === Cache Management ===

  cache = {
    getStats: () => {
      return {
        elements: this.elementCache.getStats(),
        pages: this.pageCache.getStats(),
        projects: this.projectCache.getStats(),
      };
    },

    clear: () => {
      this.elementCache.clear();
      this.pageCache.clear();
      this.projectCache.clear();
      console.log("[IndexedDB] All caches cleared");
    },

    resetStats: () => {
      this.elementCache.resetStats();
      this.pageCache.resetStats();
      this.projectCache.resetStats();
      console.log("[IndexedDB] Cache statistics reset");
    },
  };

  // === Batch Operations ===

  batch = {
    export: async () => {
      const [project, documents, designTokens, metadata] = await Promise.all([
        this.projects.getAll().then((projects) => projects[0] || null),
        this.documents.getAll(),
        this.designTokens.getAll(),
        this.metadata.get(),
      ]);

      return {
        project,
        document: project
          ? (documents.find((doc) => doc.project_id === project.id)?.document ??
            null)
          : (documents[0]?.document ?? null),
        designTokens,
        metadata,
      };
    },

    import: async (data: {
      project?: Project;
      document?: CompositionDocument;
      designTokens?: DesignToken[];
      metadata?: SyncMetadata;
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

      if (data.metadata) {
        await this.metadata.set(data.metadata);
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
          "pages",
          "elements",
          "design_tokens",
          "design_themes",
          "history",
          "metadata",
          "layouts",
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

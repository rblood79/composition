/**
 * @fileoverview Canonical Document Store (Zustand) — ADR-116 Phase 1 (G2)
 *
 * `CanonicalDocumentActions` (packages/shared) 의 Zustand 구현체.
 *
 * **Phase 1 land scope (R1 보수)**:
 * - In-memory mutation skeleton (history/undo/persistence 미통합).
 * - 활성 document 모델: `currentProjectId` + `Map<projectId, doc>`.
 * - mutation 호출은 caller 가 history entry 를 push 하지 않아도 됨 — Phase 2/3
 *   시점에 canonical patch → history record 통합 결정 (R1 잔존).
 * - elementsMap legacy store 와 양방향 sync 없음 — Phase 2 hot path cutover
 *   (G3) 와 함께 통합.
 *
 * **Direct cutover 결합점**:
 * - route/project hydrate 는 canonical primary wrapper 가 document 를 직접 set.
 * - hot path read 는 active canonical document 를 직접 구독.
 * - legacy payload 는 export/adapter mirror 경계에서만 생성.
 */

import { create } from "zustand";
import type {
  CanonicalDocumentActions,
  CanonicalNode,
  CompositionExtension,
  CompositionExtendedNode,
  CompositionDocument,
  DescendantOverride,
  RefNode,
} from "@composition/shared";
import {
  appendDescendantChild as appendDescendantChildToDocument,
  getCanonicalChildren,
  insertCanonicalChild,
  moveCanonicalChild,
  moveDescendantChild as moveDescendantChildInDocument,
  removeCanonicalChild,
} from "@composition/shared";

// ─────────────────────────────────────────────
// Store state
// ─────────────────────────────────────────────

interface CanonicalDocumentState {
  /**
   * projectId → canonical document map.
   *
   * Map 자체를 immutable 으로 교체 (clone-on-write) — Zustand 가 reference
   * equality 로 selector 변경을 감지하도록.
   */
  documents: Map<string, CompositionDocument>;

  /**
   * 활성 projectId — mutation method 가 작용하는 document.
   * `null` 일 때 mutation 호출은 no-op + dev warn.
   */
  currentProjectId: string | null;

  /**
   * mutation 카운터. Phase 2 selector cache 무효화용.
   * 모든 mutation 성공 시 +1.
   */
  documentVersion: number;
}

type CanonicalDocumentStore = CanonicalDocumentState & CanonicalDocumentActions;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** 노드 트리에서 nodeId 와 일치하는 첫 노드 + 부모 + 부모 children 내 index */
interface FindResult {
  node: CanonicalNode;
  /** root 직계인 경우 `null` */
  parent: CanonicalNode | null;
  index: number;
  /** root 의 직계인 경우 `null`, 아니면 `parent.children` */
  childrenArray: CanonicalNode[];
}

function findNodeById(
  doc: CompositionDocument,
  nodeId: string,
): FindResult | null {
  if (!doc.children) return null;

  // root level scan
  for (let i = 0; i < doc.children.length; i++) {
    const child = doc.children[i];
    if (child.id === nodeId) {
      return {
        node: child,
        parent: null,
        index: i,
        childrenArray: doc.children,
      };
    }
    const nested = findNodeByIdInSubtree(child, nodeId);
    if (nested) return nested;
  }

  return null;
}

function findNodeByIdInSubtree(
  parent: CanonicalNode,
  nodeId: string,
): FindResult | null {
  if (!parent.children) return null;

  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child.id === nodeId) {
      return {
        node: child,
        parent,
        index: i,
        childrenArray: parent.children,
      };
    }
    const nested = findNodeByIdInSubtree(child, nodeId);
    if (nested) return nested;
  }

  return null;
}

/** structural clone — Zustand selector reference 변경 보장. */
function cloneDocument(doc: CompositionDocument): CompositionDocument {
  return {
    ...doc,
    children: doc.children.map(cloneNode),
  };
}

function cloneNode(node: CanonicalNode): CanonicalNode {
  const clone: CanonicalNode = {
    ...node,
    children: node.children?.map(cloneNode),
    props: node.props ? { ...node.props } : undefined,
    metadata: node.metadata ? { ...node.metadata } : undefined,
  };
  const extension = getCompositionExtension(node);
  if (extension) {
    (clone as CompositionExtendedNode)["x-composition"] =
      cloneCompositionExtension(extension);
  }
  return clone;
}

/** dev warn helper — production 에서는 silent no-op 보장. */
function devWarn(message: string, context?: Record<string, unknown>): void {
  if (
    typeof process !== "undefined" &&
    process.env?.NODE_ENV !== "production"
  ) {
    console.warn(`[canonicalDocumentStore] ${message}`, context ?? "");
  }
}

/** props 에 저장 금지된 key (G7 Extension Boundary 사전 enforcement) */
const PROPS_FORBIDDEN_KEYS = new Set(["events", "actions", "dataBinding"]);
const EXTENSION_KEYS = new Set(["events", "actions", "dataBinding", "editor"]);

function getCompositionExtension(
  node: CanonicalNode,
): CompositionExtension | undefined {
  return (node as CompositionExtendedNode)["x-composition"];
}

function cloneCompositionExtension(
  extension: CompositionExtension,
): CompositionExtension {
  const clone: CompositionExtension = {};
  if (extension.events) {
    clone.events = extension.events.map((event) => ({ ...event }));
  }
  if (extension.actions) {
    clone.actions = extension.actions.map((action) => ({ ...action }));
  }
  if (extension.dataBinding) {
    clone.dataBinding = {
      ...extension.dataBinding,
      config: { ...extension.dataBinding.config },
    };
  }
  if (extension.editor) {
    clone.editor = { ...extension.editor };
  }
  return clone;
}

function isSerializableExtensionValue(
  value: unknown,
  seen = new WeakSet<object>(),
): boolean {
  if (value === null) return true;

  switch (typeof value) {
    case "string":
    case "boolean":
      return true;
    case "number":
      return Number.isFinite(value);
    case "object": {
      if (seen.has(value)) return false;
      seen.add(value);

      if (Array.isArray(value)) {
        return value.every((entry) =>
          isSerializableExtensionValue(entry, seen),
        );
      }

      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        return false;
      }

      return Object.values(value as Record<string, unknown>).every((entry) => {
        if (entry === undefined) return false;
        return isSerializableExtensionValue(entry, seen);
      });
    }
    default:
      return false;
  }
}

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────

export const useCanonicalDocumentStore = create<CanonicalDocumentStore>(
  (set, get) => ({
    // ── State ──
    documents: new Map(),
    currentProjectId: null,
    documentVersion: 0,

    // ── Actions ──

    getDocument: (projectId) => {
      return get().documents.get(projectId);
    },

    setDocument: (projectId, doc) => {
      set((state) => {
        const next = new Map(state.documents);
        next.set(projectId, doc);
        return {
          documents: next,
          documentVersion: state.documentVersion + 1,
        };
      });
    },

    setCurrentProject: (projectId) => {
      set({ currentProjectId: projectId });
    },

    updateNode: (nodeId, patch) => {
      set((state) => {
        const projectId = state.currentProjectId;
        if (!projectId) {
          devWarn("updateNode called without active project", { nodeId });
          return state;
        }
        const doc = state.documents.get(projectId);
        if (!doc) {
          devWarn("updateNode: active project has no document", {
            projectId,
            nodeId,
          });
          return state;
        }

        const nextDoc = cloneDocument(doc);
        const found = findNodeById(nextDoc, nodeId);
        if (!found) {
          devWarn("updateNode: node not found", { nodeId });
          return state;
        }

        // structural invariant: id / type 변경은 silently 무시.
        const sanitizedPatch = { ...patch };
        delete sanitizedPatch.id;
        delete sanitizedPatch.type;
        delete sanitizedPatch.props; // updateNodeProps 사용 권장 — 본 patch 에서 제외

        const merged: CanonicalNode = { ...found.node, ...sanitizedPatch };
        found.childrenArray[found.index] = merged;

        const nextMap = new Map(state.documents);
        nextMap.set(projectId, nextDoc);
        return {
          documents: nextMap,
          documentVersion: state.documentVersion + 1,
        };
      });
    },

    updateNodeProps: (nodeId, patch) => {
      set((state) => {
        const projectId = state.currentProjectId;
        if (!projectId) {
          devWarn("updateNodeProps called without active project", { nodeId });
          return state;
        }
        const doc = state.documents.get(projectId);
        if (!doc) {
          devWarn("updateNodeProps: active project has no document", {
            projectId,
            nodeId,
          });
          return state;
        }

        const nextDoc = cloneDocument(doc);
        const found = findNodeById(nextDoc, nodeId);
        if (!found) {
          devWarn("updateNodeProps: node not found", { nodeId });
          return state;
        }

        const nextProps: Record<string, unknown> = {
          ...(found.node.props ?? {}),
        };

        for (const [key, value] of Object.entries(patch)) {
          if (PROPS_FORBIDDEN_KEYS.has(key)) {
            devWarn(
              `updateNodeProps: '${key}' belongs to x-composition extension, not props (skipped)`,
              { nodeId, key },
            );
            continue;
          }
          if (value === undefined) {
            delete nextProps[key];
          } else {
            nextProps[key] = value;
          }
        }

        const updated: CanonicalNode = {
          ...found.node,
          props: Object.keys(nextProps).length > 0 ? nextProps : undefined,
        };
        found.childrenArray[found.index] = updated;

        const nextMap = new Map(state.documents);
        nextMap.set(projectId, nextDoc);
        return {
          documents: nextMap,
          documentVersion: state.documentVersion + 1,
        };
      });
    },

    updateNodeExtension: (nodeId, patch) => {
      set((state) => {
        const projectId = state.currentProjectId;
        if (!projectId) {
          devWarn("updateNodeExtension called without active project", {
            nodeId,
          });
          return state;
        }
        const doc = state.documents.get(projectId);
        if (!doc) {
          devWarn("updateNodeExtension: active project has no document", {
            projectId,
            nodeId,
          });
          return state;
        }

        const nextDoc = cloneDocument(doc);
        const found = findNodeById(nextDoc, nodeId);
        if (!found) {
          devWarn("updateNodeExtension: node not found", { nodeId });
          return state;
        }

        const nextExtension: Record<string, unknown> = {
          ...(getCompositionExtension(found.node) ?? {}),
        };
        let changed = false;

        for (const [key, value] of Object.entries(patch)) {
          if (!EXTENSION_KEYS.has(key)) {
            devWarn("updateNodeExtension: unknown extension key skipped", {
              nodeId,
              key,
            });
            continue;
          }

          if (value === undefined) {
            if (Object.prototype.hasOwnProperty.call(nextExtension, key)) {
              delete nextExtension[key];
              changed = true;
            }
            continue;
          }

          if (!isSerializableExtensionValue(value)) {
            devWarn(
              `updateNodeExtension: '${key}' must be serializable (skipped)`,
              { nodeId, key },
            );
            continue;
          }

          nextExtension[key] = value;
          changed = true;
        }

        if (!changed) return state;

        const updated = { ...found.node } as CompositionExtendedNode;
        if (Object.keys(nextExtension).length > 0) {
          updated["x-composition"] =
            nextExtension as Partial<CompositionExtension>;
        } else {
          delete updated["x-composition"];
        }
        found.childrenArray[found.index] = updated;

        const nextMap = new Map(state.documents);
        nextMap.set(projectId, nextDoc);
        return {
          documents: nextMap,
          documentVersion: state.documentVersion + 1,
        };
      });
    },

    insertNode: (parentPath, node, index) => {
      set((state) => {
        const projectId = state.currentProjectId;
        if (!projectId) {
          devWarn("insertNode called without active project", {
            parentPath,
            nodeId: node.id,
          });
          return state;
        }
        const doc = state.documents.get(projectId);
        if (!doc) {
          devWarn("insertNode: active project has no document", {
            projectId,
            parentPath,
          });
          return state;
        }

        if (!getCanonicalChildren(doc, parentPath)) {
          devWarn("insertNode: parent not found", { parentPath });
          return state;
        }

        const result = insertCanonicalChild(
          doc,
          parentPath,
          cloneNode(node),
          index,
        );
        if (!result.changed) {
          devWarn("insertNode: child already exists", {
            parentPath,
            nodeId: node.id,
          });
          return state;
        }

        const nextMap = new Map(state.documents);
        nextMap.set(projectId, result.document);
        return {
          documents: nextMap,
          documentVersion: state.documentVersion + 1,
        };
      });
    },

    getNodeChildren: (parentPath) => {
      const state = get();
      const projectId = state.currentProjectId;
      if (!projectId) return null;
      const doc = state.documents.get(projectId);
      if (!doc) return null;
      return getCanonicalChildren(doc, parentPath);
    },

    moveNode: (nodePath, targetParentPath, index) => {
      set((state) => {
        const projectId = state.currentProjectId;
        if (!projectId) {
          devWarn("moveNode called without active project", {
            nodePath,
            targetParentPath,
          });
          return state;
        }
        const doc = state.documents.get(projectId);
        if (!doc) {
          devWarn("moveNode: active project has no document", {
            projectId,
            nodePath,
          });
          return state;
        }
        if (!getCanonicalChildren(doc, targetParentPath)) {
          devWarn("moveNode: target parent not found", {
            nodePath,
            targetParentPath,
          });
          return state;
        }

        const result = moveCanonicalChild(
          doc,
          nodePath,
          targetParentPath,
          index,
        );
        if (!result.changed) {
          devWarn("moveNode: node not found or invalid move", {
            nodePath,
            targetParentPath,
            index,
          });
          return state;
        }

        const nextMap = new Map(state.documents);
        nextMap.set(projectId, result.document);
        return {
          documents: nextMap,
          documentVersion: state.documentVersion + 1,
        };
      });
    },

    removeNode: (nodePath) => {
      set((state) => {
        const projectId = state.currentProjectId;
        if (!projectId) {
          devWarn("removeNode called without active project", { nodePath });
          return state;
        }
        const doc = state.documents.get(projectId);
        if (!doc) {
          devWarn("removeNode: active project has no document", {
            projectId,
            nodePath,
          });
          return state;
        }

        const result = removeCanonicalChild(doc, nodePath);
        if (!result.removed) {
          devWarn("removeNode: node not found", { nodePath });
          return state;
        }

        const nextMap = new Map(state.documents);
        nextMap.set(projectId, result.document);
        return {
          documents: nextMap,
          documentVersion: state.documentVersion + 1,
        };
      });
    },

    appendDescendantChild: (refPath, descendantPath, child) => {
      set((state) => {
        const projectId = state.currentProjectId;
        if (!projectId) {
          devWarn("appendDescendantChild called without active project", {
            refPath,
            descendantPath,
          });
          return state;
        }
        const doc = state.documents.get(projectId);
        if (!doc) {
          devWarn("appendDescendantChild: active project has no document", {
            projectId,
            refPath,
          });
          return state;
        }

        const result = appendDescendantChildToDocument(
          doc,
          refPath,
          descendantPath,
          cloneNode(child),
        );
        if (!result.changed) {
          devWarn(
            "appendDescendantChild: ref not found, duplicate child, or non-children descendant",
            {
              refPath,
              descendantPath,
              childId: child.id,
            },
          );
          return state;
        }

        const nextMap = new Map(state.documents);
        nextMap.set(projectId, result.document);
        return {
          documents: nextMap,
          documentVersion: state.documentVersion + 1,
        };
      });
    },

    moveDescendantChild: (refPath, descendantPath, childPath, index) => {
      set((state) => {
        const projectId = state.currentProjectId;
        if (!projectId) {
          devWarn("moveDescendantChild called without active project", {
            refPath,
            descendantPath,
            childPath,
          });
          return state;
        }
        const doc = state.documents.get(projectId);
        if (!doc) {
          devWarn("moveDescendantChild: active project has no document", {
            projectId,
            refPath,
          });
          return state;
        }

        const result = moveDescendantChildInDocument(
          doc,
          refPath,
          descendantPath,
          childPath,
          index,
        );
        if (!result.changed) {
          devWarn("moveDescendantChild: child not found or unchanged", {
            refPath,
            descendantPath,
            childPath,
            index,
          });
          return state;
        }

        const nextMap = new Map(state.documents);
        nextMap.set(projectId, result.document);
        return {
          documents: nextMap,
          documentVersion: state.documentVersion + 1,
        };
      });
    },

    updateDescendant: (refPath, descendantPath, value) => {
      set((state) => {
        const projectId = state.currentProjectId;
        if (!projectId) {
          devWarn("updateDescendant called without active project", {
            refPath,
            descendantPath,
          });
          return state;
        }
        const doc = state.documents.get(projectId);
        if (!doc) {
          devWarn("updateDescendant: active project has no document", {
            projectId,
            refPath,
          });
          return state;
        }

        const nextDoc = cloneDocument(doc);
        const found = findNodeById(nextDoc, refPath);
        if (!found) {
          devWarn("updateDescendant: ref node not found", { refPath });
          return state;
        }

        if (found.node.type !== "ref") {
          devWarn("updateDescendant: target is not a RefNode", {
            refPath,
            actualType: found.node.type,
          });
          return state;
        }

        const refNode = found.node as RefNode;
        const nextDescendants: Record<string, DescendantOverride> = {
          ...(refNode.descendants ?? {}),
        };
        nextDescendants[descendantPath] = value;

        const updated: RefNode = {
          ...refNode,
          descendants: nextDescendants,
        };
        found.childrenArray[found.index] = updated;

        const nextMap = new Map(state.documents);
        nextMap.set(projectId, nextDoc);
        return {
          documents: nextMap,
          documentVersion: state.documentVersion + 1,
        };
      });
    },
  }),
);

// ─────────────────────────────────────────────
// Selectors / utilities
// ─────────────────────────────────────────────

/**
 * 활성 document 의 nodeId 노드를 반환 (없으면 null).
 * Phase 2 hot path cutover 시점의 useSyncExternalStore selector 후보.
 */
export function selectCanonicalNode(nodeId: string): CanonicalNode | null {
  const state = useCanonicalDocumentStore.getState();
  if (!state.currentProjectId) return null;
  const doc = state.documents.get(state.currentProjectId);
  if (!doc) return null;
  const found = findNodeById(doc, nodeId);
  return found?.node ?? null;
}

/** 활성 document 자체를 반환. cold path 전용 (Phase 2 cutover 후). */
export function selectActiveCanonicalDocument(): CompositionDocument | null {
  const state = useCanonicalDocumentStore.getState();
  if (!state.currentProjectId) return null;
  return state.documents.get(state.currentProjectId) ?? null;
}

// ─────────────────────────────────────────────
// Dev-only window 노출 — ADR-116 Phase 2 G3 Step 1b 검증용
// ─────────────────────────────────────────────
//
// dev console 에서 canonical store hydration 검증 가능:
//   window.__canonical_STORE__.getState().documents.size       // 1
//   window.__canonical_STORE__.getState().currentProjectId     // proj-id
//   window.__canonical_STORE__.getState().documentVersion      // mutation 시 증가
//   [...window.__canonical_STORE__.getState().documents.values()][0]  // 활성 doc
//
// production bundle 영향 0 — `import.meta.env.DEV` 가드.

declare global {
  interface Window {
    __canonical_STORE__?: typeof useCanonicalDocumentStore;
  }
}

if (typeof window !== "undefined" && import.meta.env.DEV) {
  window.__canonical_STORE__ = useCanonicalDocumentStore;
}

import type {
  CanonicalNode,
  CompositionDocument,
  DescendantOverride,
  RefNode,
} from "@composition/shared";
import {
  insertCanonicalChild,
  moveCanonicalChild,
  removeCanonicalChild,
} from "@composition/shared";

import {
  createCanonicalHistoryNodeFromElement,
  getCanonicalHistoryNodeSnapshot,
} from "@/adapters/canonical/canonicalMutations";
import { getFrameElementMirrorId } from "@/adapters/canonical/frameMirror";
import type { Element } from "@/types/core/store.types";
import {
  getCanonicalRefOverrideEntries,
  visitCanonicalDocumentElements,
} from "../canonical/canonicalElementsView";
import { useCanonicalDocumentStore } from "../canonical/canonicalDocumentStore";

export type CanonicalHistoryNodeEvent =
  | {
      type: "insert";
      node: CanonicalNode;
      parentId: string | null;
      index: number;
    }
  | {
      type: "remove";
      node: CanonicalNode;
      parentId: string | null;
      index: number;
    }
  | {
      type: "move";
      nodeId: string;
      fromParentId: string | null;
      fromIndex: number;
      toParentId: string | null;
      toIndex: number;
    }
  | {
      type: "update";
      nodeId: string;
      prevProps: Record<string, unknown>;
      nextProps: Record<string, unknown>;
    };

export type CanonicalHistoryEventIds = {
  upsertIds: string[];
  deleteIds: string[];
};

type NodeLocation = {
  node: CanonicalNode;
  parentId: string | null;
  index: number;
};

function isCanonicalNode(value: unknown): value is CanonicalNode {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { id?: unknown; type?: unknown };
  return typeof candidate.id === "string" && typeof candidate.type === "string";
}

function isChildrenOverride(
  value: DescendantOverride,
): value is DescendantOverride & { children: CanonicalNode[] } {
  return Array.isArray((value as { children?: unknown }).children);
}

function cloneNode(node: CanonicalNode): CanonicalNode {
  if (typeof structuredClone === "function") {
    return structuredClone(node) as CanonicalNode;
  }
  return JSON.parse(JSON.stringify(node)) as CanonicalNode;
}

function siblingIndexForElement(element: Element, siblings: Element[]): number {
  const parentId = getCanonicalEventParentId(element);
  return siblings
    .filter((candidate) => getCanonicalEventParentId(candidate) === parentId)
    .findIndex((candidate) => candidate.id === element.id);
}

function getCanonicalEventParentId(element: Element): string | null {
  if (element.parent_id) return element.parent_id;
  if (element.page_id) return element.page_id;
  const frameId = getFrameElementMirrorId(element);
  if (frameId) return `layout-${frameId}`;
  return null;
}

function collectNodeIds(
  node: CanonicalNode,
  ids = new Set<string>(),
): Set<string> {
  ids.add(node.id);
  node.children?.forEach((child) => collectNodeIds(child, ids));
  if (node.type === "ref") {
    getCanonicalRefOverrideEntries(node).forEach(([, override]) => {
      if (isCanonicalNode(override)) {
        collectNodeIds(override, ids);
      } else if (isChildrenOverride(override)) {
        override.children.forEach((child) => collectNodeIds(child, ids));
      }
    });
  }
  return ids;
}

function findLocationInNodes(
  nodes: CanonicalNode[],
  nodeId: string,
  parentId: string | null,
): NodeLocation | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node.id === nodeId) {
      return { node, parentId, index };
    }

    const childLocation = findLocationInNodes(
      node.children ?? [],
      nodeId,
      node.id,
    );
    if (childLocation) return childLocation;

    if (node.type !== "ref") continue;
    const descendantLocation = findLocationInDescendants(
      node as RefNode,
      nodeId,
    );
    if (descendantLocation) return descendantLocation;
  }
  return null;
}

function findLocationInDescendants(
  refNode: RefNode,
  nodeId: string,
): NodeLocation | null {
  for (const [, override] of getCanonicalRefOverrideEntries(refNode)) {
    if (isCanonicalNode(override)) {
      const location = findLocationInNodes([override], nodeId, null);
      if (location) return location;
      continue;
    }
    if (!isChildrenOverride(override)) continue;
    const location = findLocationInNodes(override.children, nodeId, refNode.id);
    if (location) return location;
  }
  return null;
}

function findLocation(
  doc: CompositionDocument,
  nodeId: string,
): NodeLocation | null {
  return findLocationInNodes(doc.children, nodeId, null);
}

function insertNode(
  doc: CompositionDocument,
  parentId: string | null,
  index: number,
  node: CanonicalNode,
): CompositionDocument {
  const removed = removeCanonicalChild(doc, node.id);
  const result = insertCanonicalChild(removed.document, parentId, node, index);
  return result.changed ? result.document : doc;
}

function removeNode(
  doc: CompositionDocument,
  nodeId: string,
): CompositionDocument {
  const result = removeCanonicalChild(doc, nodeId);
  return result.changed ? result.document : doc;
}

function moveNode(
  doc: CompositionDocument,
  nodeId: string,
  parentId: string | null,
  index: number,
): CompositionDocument {
  const result = moveCanonicalChild(doc, nodeId, parentId, index);
  return result.changed ? result.document : doc;
}

function replaceNodeProps(
  nodes: CanonicalNode[],
  nodeId: string,
  nextProps: Record<string, unknown>,
): { nodes: CanonicalNode[]; changed: boolean } {
  let changed = false;
  const result = nodes.map((node) => {
    if (node.id === nodeId) {
      changed = true;
      return { ...node, props: { ...nextProps } } as CanonicalNode;
    }
    if (node.children && node.children.length > 0) {
      const childResult = replaceNodeProps(node.children, nodeId, nextProps);
      if (childResult.changed) {
        changed = true;
        return { ...node, children: childResult.nodes } as CanonicalNode;
      }
    }
    return node;
  });
  return { nodes: result, changed };
}

function applyNodePropsUpdate(
  doc: CompositionDocument,
  nodeId: string,
  nextProps: Record<string, unknown>,
): CompositionDocument {
  const result = replaceNodeProps(doc.children, nodeId, nextProps);
  if (!result.changed) return doc;
  return { ...doc, children: result.nodes };
}

function collectHistoryResultElements(doc: CompositionDocument): Element[] {
  const elements: Element[] = [];
  visitCanonicalDocumentElements(doc, (element) => {
    elements.push(element);
  });
  return elements;
}

export function applyCanonicalHistoryEventsToDocument(
  doc: CompositionDocument,
  events: CanonicalHistoryNodeEvent[],
  direction: "undo" | "redo",
): CompositionDocument {
  const orderedEvents = direction === "redo" ? events : [...events].reverse();
  return orderedEvents.reduce((currentDoc, event) => {
    if (event.type === "insert") {
      return direction === "redo"
        ? insertNode(currentDoc, event.parentId, event.index, event.node)
        : removeNode(currentDoc, event.node.id);
    }
    if (event.type === "remove") {
      return direction === "redo"
        ? removeNode(currentDoc, event.node.id)
        : insertNode(currentDoc, event.parentId, event.index, event.node);
    }
    if (event.type === "update") {
      const props = direction === "redo" ? event.nextProps : event.prevProps;
      return applyNodePropsUpdate(currentDoc, event.nodeId, props);
    }
    return direction === "redo"
      ? moveNode(currentDoc, event.nodeId, event.toParentId, event.toIndex)
      : moveNode(currentDoc, event.nodeId, event.fromParentId, event.fromIndex);
  }, doc);
}

export function applyCanonicalHistoryEventsToActiveDocument(
  events: CanonicalHistoryNodeEvent[] | undefined,
  direction: "undo" | "redo",
): Element[] | null {
  if (!events || events.length === 0) return null;
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return null;
  const doc = canonical.documents.get(projectId);
  if (!doc) return null;

  const nextDoc = applyCanonicalHistoryEventsToDocument(doc, events, direction);
  canonical.setDocument(projectId, nextDoc);
  return collectHistoryResultElements(nextDoc);
}

export function getCanonicalHistoryEventIds(
  events: CanonicalHistoryNodeEvent[] | undefined,
  direction: "undo" | "redo",
): CanonicalHistoryEventIds {
  const upsertIds = new Set<string>();
  const deleteIds = new Set<string>();

  for (const event of events ?? []) {
    if (event.type === "move") {
      upsertIds.add(event.nodeId);
      continue;
    }
    if (event.type === "update") {
      upsertIds.add(event.nodeId);
      continue;
    }

    const ids = collectNodeIds(event.node);
    const shouldDelete =
      (event.type === "insert" && direction === "undo") ||
      (event.type === "remove" && direction === "redo");
    for (const id of ids) {
      if (shouldDelete) {
        deleteIds.add(id);
      } else {
        upsertIds.add(id);
      }
    }
  }

  return {
    upsertIds: [...upsertIds],
    deleteIds: [...deleteIds],
  };
}

export function buildCanonicalUpdateEvent(
  nodeId: string,
  prevProps: Record<string, unknown>,
  nextProps: Record<string, unknown>,
): CanonicalHistoryNodeEvent {
  return {
    type: "update",
    nodeId,
    prevProps: { ...prevProps },
    nextProps: { ...nextProps },
  };
}

export function buildCanonicalInsertEvents(
  elements: Element[],
): CanonicalHistoryNodeEvent[] {
  return elements.map((element) => {
    const doc = useCanonicalDocumentStore
      .getState()
      .documents.get(
        useCanonicalDocumentStore.getState().currentProjectId ?? "",
      );
    const location = doc ? findLocation(doc, element.id) : null;
    return {
      type: "insert",
      node: location?.node
        ? cloneNode(location.node)
        : createCanonicalHistoryNodeFromElement(element),
      parentId: location?.parentId ?? getCanonicalEventParentId(element),
      index: location?.index ?? siblingIndexForElement(element, elements),
    };
  });
}

export function buildCanonicalRemoveEvents(
  rootElements: Element[],
  allRemovedElements: Element[] = rootElements,
): CanonicalHistoryNodeEvent[] {
  const removedIds = new Set(allRemovedElements.map((element) => element.id));
  return rootElements
    .filter(
      (element) => !element.parent_id || !removedIds.has(element.parent_id),
    )
    .map((element) => {
      const doc = useCanonicalDocumentStore
        .getState()
        .documents.get(
          useCanonicalDocumentStore.getState().currentProjectId ?? "",
        );
      const location = doc ? findLocation(doc, element.id) : null;
      return {
        type: "remove",
        node: location?.node
          ? cloneNode(location.node)
          : getCanonicalHistoryNodeSnapshot(element),
        parentId: location?.parentId ?? getCanonicalEventParentId(element),
        index: location?.index ?? siblingIndexForElement(element, rootElements),
      };
    });
}

export function buildCanonicalGroupEvents(
  groupElement: Element,
  previousChildren: Element[],
  nextChildren: Element[],
): CanonicalHistoryNodeEvent[] {
  const insertEvent = buildCanonicalInsertEvents([groupElement])[0];
  const previousById = new Map(
    previousChildren.map((element) => [element.id, element]),
  );
  const moveEvents = nextChildren.flatMap((nextChild) => {
    const previousChild = previousById.get(nextChild.id);
    if (!previousChild) return [];
    return {
      type: "move" as const,
      nodeId: nextChild.id,
      fromParentId: getCanonicalEventParentId(previousChild),
      fromIndex: siblingIndexForElement(previousChild, previousChildren),
      toParentId: getCanonicalEventParentId(nextChild),
      toIndex: siblingIndexForElement(nextChild, nextChildren),
    };
  });
  return [insertEvent, ...moveEvents];
}

export function buildCanonicalUngroupEvents(
  groupElement: Element,
  previousChildren: Element[],
  nextChildren: Element[],
): CanonicalHistoryNodeEvent[] {
  const nextById = new Map(
    nextChildren.map((element) => [element.id, element]),
  );
  const moveEvents = previousChildren.flatMap((previousChild) => {
    const nextChild = nextById.get(previousChild.id);
    if (!nextChild) return [];
    return {
      type: "move" as const,
      nodeId: previousChild.id,
      fromParentId: getCanonicalEventParentId(previousChild),
      fromIndex: siblingIndexForElement(previousChild, previousChildren),
      toParentId: getCanonicalEventParentId(nextChild),
      toIndex: siblingIndexForElement(nextChild, nextChildren),
    };
  });
  const removeEvent = buildCanonicalRemoveEvents([groupElement])[0];
  return [...moveEvents, removeEvent];
}

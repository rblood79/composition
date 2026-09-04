/**
 * **ADR-124 — v1 entry → v2 canonical event adapter (IndexedDB 경계 전용)**.
 *
 * v1 IndexedDB 에 저장된 legacy snapshot field 를 canonical event sequence 로
 * 변환한다. undo/redo/goTo 는 `canonicalEvents` 만 소비하며 이 adapter 를
 * 호출하지 않는다.
 *
 * `diff`/`diffs` 는 apply 시점 elements+direction context 가 있어야 full-props
 * update 로 펼칠 수 있다. IDB load 에는 그 context 가 없으므로 변환 불가
 * element-axis entry 는 `keepConvertibleHistoryEntries` 로 스택에서 제거한다
 * (조용한 undo no-op + index 소모 방지).
 *
 * 변환 규칙:
 * - 이미 `canonicalEvents` 보유 → identity 후 legacy snapshot strip
 * - `diff`/`diffs` + context → full-props `CanonicalUpdateEvent`(s)
 * - `prevProps`/`props` / `batchUpdates` → update events
 * - `prevElements`/`elements` (batch) → 동일 id·props-only 면 update,
 *   아니면 replace (fills/responsive/parent/order 포함)
 * - `element`/`childElements` (add/remove) → insert/remove
 * - `group`/`ungroup` + element/elements → group/ungroup events
 * - 변환 성공 시 deprecated legacy snapshot keys strip
 * - 변환 불가 / 빈 entry → `canonicalEvents: []` (IDB 경계에서 drop)
 *
 * @see docs/adr/124-canonical-only-history-schema.md
 */

import type { ComponentElementProps } from "../../../types/core/store.types";
import type { SerializableElementDiff } from "../utils/elementDiff";
import type { HistoryEntry } from "../history";
import { createCanonicalHistoryNodeFromElement } from "@/adapters/canonical/canonicalMutations";
import type { CanonicalNode } from "@composition/shared";
import {
  NON_PROPS_CANONICAL_HISTORY_FIELDS,
  buildCanonicalGroupEvents,
  buildCanonicalInsertEvents,
  buildCanonicalRemoveEvents,
  buildCanonicalUngroupEvents,
  buildCanonicalUpdateEvent,
  findLocation,
  type CanonicalHistoryNodeEvent,
} from "./canonicalHistoryEvents";
import { selectActiveCanonicalDocument } from "../canonical/canonicalDocumentStore";

/** IndexedDB v1 history payload 에 실제 저장된 legacy element snapshot shape. */
type LegacyHistoryElementSnapshot = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  parent_id?: string | null;
  page_id?: string | null;
};

/**
 * HistoryEntry.data 에 더 이상 두지 않는 v1 snapshot 필드.
 * IndexedDB/raw entry 와 unit fixture 만 이 shape 로 읽는다.
 */
export type LegacyV1SnapshotData = {
  element?: LegacyHistoryElementSnapshot;
  prevElement?: LegacyHistoryElementSnapshot;
  props?: ComponentElementProps;
  prevProps?: ComponentElementProps;
  parentId?: string;
  prevParentId?: string;
  childElements?: LegacyHistoryElementSnapshot[];
  elements?: LegacyHistoryElementSnapshot[];
  prevElements?: LegacyHistoryElementSnapshot[];
  batchUpdates?: Array<{
    elementId: string;
    prevProps: ComponentElementProps;
    newProps: ComponentElementProps;
  }>;
};

/** HistoryEntry.data 에서 migration 성공 후 제거하는 legacy snapshot keys. */
const LEGACY_SNAPSHOT_DATA_KEYS = [
  "element",
  "prevElement",
  "props",
  "prevProps",
  "parentId",
  "prevParentId",
  "childElements",
  "elements",
  "prevElements",
  "batchUpdates",
] as const satisfies ReadonlyArray<keyof LegacyV1SnapshotData>;

function legacySnapshot(entry: HistoryEntry): LegacyV1SnapshotData {
  return entry.data as HistoryEntry["data"] & LegacyV1SnapshotData;
}

/** apply 시점 context — diff 를 full props 로 펼칠 때 필요. */
export type MigrateV1Context = {
  elements?: LegacyHistoryElementSnapshot[];
  direction?: "undo" | "redo";
};

function asElementArray(value: unknown): LegacyHistoryElementSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is LegacyHistoryElementSnapshot =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as LegacyHistoryElementSnapshot).id === "string" &&
      typeof (item as LegacyHistoryElementSnapshot).type === "string",
  );
}

function asElement(value: unknown): LegacyHistoryElementSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const element = value as LegacyHistoryElementSnapshot;
  if (typeof element.id !== "string" || typeof element.type !== "string") {
    return null;
  }
  return element;
}

function elementParentKey(
  element: LegacyHistoryElementSnapshot,
): string | null {
  return element.parent_id ?? element.page_id ?? null;
}

function siblingIndexInList(
  element: LegacyHistoryElementSnapshot,
  siblings: LegacyHistoryElementSnapshot[],
): number {
  const parentId = elementParentKey(element);
  return siblings
    .filter((candidate) => elementParentKey(candidate) === parentId)
    .findIndex((candidate) => candidate.id === element.id);
}

function nonPropsDiffer(
  prev: LegacyHistoryElementSnapshot,
  next: LegacyHistoryElementSnapshot,
): boolean {
  const prevFields = prev as unknown as Record<string, unknown>;
  const nextFields = next as unknown as Record<string, unknown>;
  for (const field of NON_PROPS_CANONICAL_HISTORY_FIELDS) {
    if (
      JSON.stringify(prevFields[field]) !== JSON.stringify(nextFields[field])
    ) {
      return true;
    }
  }
  return false;
}

function nonPropsOrLocationChanged(
  prev: LegacyHistoryElementSnapshot,
  next: LegacyHistoryElementSnapshot,
  prevElements: LegacyHistoryElementSnapshot[],
  nextElements: LegacyHistoryElementSnapshot[],
): boolean {
  if (nonPropsDiffer(prev, next)) return true;
  if (elementParentKey(prev) !== elementParentKey(next)) return true;
  return (
    siblingIndexInList(prev, prevElements) !==
    siblingIndexInList(next, nextElements)
  );
}

function propsEqual(
  prev: LegacyHistoryElementSnapshot,
  next: LegacyHistoryElementSnapshot,
): boolean {
  return JSON.stringify(prev.props ?? {}) === JSON.stringify(next.props ?? {});
}

/**
 * live doc 의 children 을 Element 스냅샷 노드에 이식.
 *
 * `createCanonicalHistoryNodeFromElement` 는 children 을 비우므로, replace
 * apply 시 subtree 가 지워지지 않도록 현재 문서 children 을 붙인다.
 * fills/responsive 등 스냅샷 필드는 Element 쪽에서 온다 (live after 금지).
 */
function nodeFromLegacyElementSnapshot(
  element: LegacyHistoryElementSnapshot,
): CanonicalNode {
  const node = createCanonicalHistoryNodeFromElement(element);
  const doc = selectActiveCanonicalDocument();
  if (!doc) return node;
  const live = findLocation(doc, element.id);
  if (
    live?.node &&
    "children" in live.node &&
    Array.isArray(live.node.children)
  ) {
    const cloned =
      typeof structuredClone === "function"
        ? structuredClone(live.node.children)
        : (JSON.parse(JSON.stringify(live.node.children)) as CanonicalNode[]);
    return { ...node, children: cloned };
  }
  return node;
}

/**
 * batch prevElements/elements → move 또는 snapshot-aware replace.
 *
 * `buildCanonicalReplaceEvents` 는 pre-mutation / prevCaptures 전제라
 * migration(apply 후) 에서 쓰면 prev 가 live after 로 오염된다 — 여기서는
 * Element 스냅샷으로 노드를 만들고 children 만 live 에서 이식한다.
 */
function buildBatchReplaceEventsFromEntry(
  entry: HistoryEntry,
): CanonicalHistoryNodeEvent[] {
  if (entry.type !== "batch") return [];
  const snapshot = legacySnapshot(entry);
  const prevElements = asElementArray(snapshot.prevElements);
  const nextElements = asElementArray(snapshot.elements);
  if (prevElements.length === 0 || nextElements.length === 0) return [];

  const prevById = new Map(
    prevElements.map((element) => [element.id, element]),
  );
  const nextById = new Map(
    nextElements.map((element) => [element.id, element]),
  );
  const sharedIds = [...nextById.keys()].filter((id) => prevById.has(id));
  const events: CanonicalHistoryNodeEvent[] = [];

  // 동일 id 집합 + props 만 변경이면 update — remove+insert replace 는 같은
  // id undo 에서 순서가 꼬인다 (historyCallSiteRoundtrip HC#2).
  if (
    sharedIds.length === nextElements.length &&
    sharedIds.length === prevElements.length &&
    sharedIds.every((id) => {
      const prev = prevById.get(id)!;
      const next = nextById.get(id)!;
      return !nonPropsOrLocationChanged(prev, next, prevElements, nextElements);
    })
  ) {
    return sharedIds.map((id) => {
      const prev = prevById.get(id)!;
      const next = nextById.get(id)!;
      return buildCanonicalUpdateEvent(
        id,
        (prev.props ?? {}) as Record<string, unknown>,
        (next.props ?? {}) as Record<string, unknown>,
      );
    });
  }

  for (const id of sharedIds) {
    const prev = prevById.get(id)!;
    const next = nextById.get(id)!;
    const fromParentId = elementParentKey(prev);
    const toParentId = elementParentKey(next);
    const fromIndex = siblingIndexInList(prev, prevElements);
    const toIndex = siblingIndexInList(next, nextElements);
    const locationChanged =
      fromParentId !== toParentId || fromIndex !== toIndex;

    // parent/order 만 바뀌면 move — subtree 보존
    if (
      locationChanged &&
      !nonPropsDiffer(prev, next) &&
      propsEqual(prev, next)
    ) {
      events.push({
        type: "move",
        nodeId: id,
        fromParentId,
        fromIndex: Math.max(fromIndex, 0),
        toParentId,
        toIndex: Math.max(toIndex, 0),
      });
      continue;
    }

    const prevNode = nodeFromLegacyElementSnapshot(prev);
    const nextNode = nodeFromLegacyElementSnapshot(next);
    events.push(
      {
        type: "remove",
        node: prevNode,
        parentId: fromParentId,
        index: Math.max(fromIndex, 0),
      },
      {
        type: "insert",
        node: nextNode,
        parentId: toParentId,
        index: Math.max(toIndex, 0),
      },
    );
  }

  // id 집합이 다른 batch — 사라진 노드 remove, 새 노드 insert
  for (const prev of prevElements) {
    if (nextById.has(prev.id)) continue;
    events.push(...buildCanonicalRemoveEvents([prev], prevElements));
  }
  const inserted = nextElements.filter((element) => !prevById.has(element.id));
  if (inserted.length > 0) {
    events.push(...buildCanonicalInsertEvents(inserted));
  }

  return events;
}

/**
 * `SerializableElementDiff` 에서 prevProps / nextProps 를 추출.
 *
 * - `diff.props.changed` → 변경된 키의 prev/next
 * - `diff.props.added` → next 만 (prev 는 undefined)
 * - `diff.props.removed` → prev 만 (next 는 undefined)
 *
 * **주의**: 반환값은 부분 props 다. `buildCanonicalUpdateEvent` 에 그대로
 * 넣으면 `replaceNodeProps` 가 나머지를 지운다 — apply 경로에서는
 * `expandDiffToFullProps` 를 쓴다.
 */
function extractPropsFromDiff(diff: SerializableElementDiff): {
  prevProps: Record<string, unknown>;
  nextProps: Record<string, unknown>;
} {
  const prevProps: Record<string, unknown> = {};
  const nextProps: Record<string, unknown> = {};

  if (!diff.props) return { prevProps, nextProps };

  for (const [key, { prev, next }] of diff.props.changed) {
    prevProps[key] = prev;
    nextProps[key] = next;
  }
  for (const [key, value] of diff.props.added) {
    nextProps[key] = value;
  }
  for (const [key, value] of diff.props.removed) {
    prevProps[key] = value;
  }

  return { prevProps, nextProps };
}

/**
 * 현재 props + direction 으로 diff 를 full prev/next props 로 펼친다.
 *
 * undo 시 current ≈ after, redo 시 current ≈ before.
 */
export function expandDiffToFullProps(
  currentProps: Record<string, unknown>,
  diff: SerializableElementDiff,
  direction: "undo" | "redo",
): { prevProps: Record<string, unknown>; nextProps: Record<string, unknown> } {
  const base = { ...currentProps };
  const prevProps = { ...base };
  const nextProps = { ...base };
  if (!diff.props) return { prevProps, nextProps };

  if (direction === "undo") {
    // current = after → next 는 현재, prev 는 reverse patch
    for (const [key, { prev }] of diff.props.changed) {
      prevProps[key] = prev;
    }
    for (const [key] of diff.props.added) {
      delete prevProps[key];
    }
    for (const [key, value] of diff.props.removed) {
      prevProps[key] = value;
    }
  } else {
    // current = before → prev 는 현재, next 는 forward patch
    for (const [key, { next }] of diff.props.changed) {
      nextProps[key] = next;
    }
    for (const [key, value] of diff.props.added) {
      nextProps[key] = value;
    }
    for (const [key] of diff.props.removed) {
      delete nextProps[key];
    }
  }

  return { prevProps, nextProps };
}

function findElementProps(
  elements: LegacyHistoryElementSnapshot[] | undefined,
  elementId: string,
): Record<string, unknown> | null {
  if (!elements) return null;
  const found = elements.find((element) => element.id === elementId);
  if (!found) return null;
  return { ...(found.props ?? {}) };
}

/**
 * migration 성공 entry 의 legacy snapshot payload 제거.
 *
 * `canonicalEvents.length > 0` 일 때만 deprecated snapshot keys 를 지운다.
 * `diff` / `diffs` / `groupData` / 비-element 축 event 는 유지.
 * historyActions 는 migrate 후 canonical 경로만 사용하므로 strip 이 안전하다.
 */
export function stripLegacyHistoryPayload(entry: HistoryEntry): HistoryEntry {
  if (!entry.data.canonicalEvents || entry.data.canonicalEvents.length === 0) {
    return entry;
  }

  let changed = false;
  const nextData: HistoryEntry["data"] = { ...entry.data };
  for (const key of LEGACY_SNAPSHOT_DATA_KEYS) {
    if ((nextData as Record<string, unknown>)[key] !== undefined) {
      delete (nextData as Record<string, unknown>)[key];
      changed = true;
    }
  }

  return changed ? { ...entry, data: nextData } : entry;
}

function buildStructuralEventsFromEntry(
  entry: HistoryEntry,
): CanonicalHistoryNodeEvent[] {
  const snapshot = legacySnapshot(entry);
  const root = asElement(snapshot.element);
  const children = asElementArray(snapshot.childElements);
  const allElements = root ? [root, ...children] : children;

  if (entry.type === "add" && allElements.length > 0) {
    return buildCanonicalInsertEvents(allElements);
  }

  if (entry.type === "remove" && allElements.length > 0) {
    const roots = root ? [root] : children;
    return buildCanonicalRemoveEvents(roots, allElements);
  }

  return [];
}

function buildGroupUngroupEventsFromEntry(
  entry: HistoryEntry,
): CanonicalHistoryNodeEvent[] {
  const snapshot = legacySnapshot(entry);
  const groupElement = asElement(snapshot.element);
  const snapshotChildren = asElementArray(snapshot.elements);
  if (!groupElement || snapshotChildren.length === 0) return [];

  if (entry.type === "group") {
    // elements = 그룹 편입 전 (원래 parent). next = 그룹을 parent 로.
    const previousChildren = snapshotChildren;
    const nextChildren = previousChildren.map((child) => ({
      ...child,
      parent_id: groupElement.id,
    }));
    return buildCanonicalGroupEvents(
      groupElement,
      previousChildren,
      nextChildren,
    );
  }

  if (entry.type === "ungroup") {
    // elements = ungroup 후 (복원 parent). previous = 그룹 안.
    const nextChildren = snapshotChildren;
    const previousChildren = nextChildren.map((child) => ({
      ...child,
      parent_id: groupElement.id,
    }));
    return buildCanonicalUngroupEvents(
      groupElement,
      previousChildren,
      nextChildren,
    );
  }

  return [];
}

function buildDiffUpdateEvents(
  entry: HistoryEntry,
  context?: MigrateV1Context,
): CanonicalHistoryNodeEvent[] {
  if (!context?.elements || !context.direction) return [];

  if (entry.type === "update" && entry.data.diff) {
    const current = findElementProps(context.elements, entry.elementId);
    if (!current) return [];
    const { prevProps, nextProps } = expandDiffToFullProps(
      current,
      entry.data.diff,
      context.direction,
    );
    return [buildCanonicalUpdateEvent(entry.elementId, prevProps, nextProps)];
  }

  if (entry.type === "batch" && entry.data.diffs?.length) {
    const events: CanonicalHistoryNodeEvent[] = [];
    for (const diff of entry.data.diffs) {
      const current = findElementProps(context.elements, diff.elementId);
      if (!current) continue;
      const { prevProps, nextProps } = expandDiffToFullProps(
        current,
        diff,
        context.direction,
      );
      events.push(
        buildCanonicalUpdateEvent(diff.elementId, prevProps, nextProps),
      );
    }
    return events;
  }

  return [];
}

/**
 * 단일 entry 를 v1 → v2 canonical event 로 변환.
 *
 * **identity preserve**: 이미 canonicalEvents 보유한 entry 는 strip 만 적용.
 * **best-effort**: 변환 불가 시 `canonicalEvents: []` (apply 는 상태 유지).
 * **diff**: context(elements+direction) 없이 partial update 를 만들지 않는다.
 */
export function migrateV1EntryToV2(
  entry: HistoryEntry,
  context?: MigrateV1Context,
): HistoryEntry {
  // 이미 canonical 변환된 entry → strip 만 (legacy payload 제거)
  if (entry.data.canonicalEvents && entry.data.canonicalEvents.length > 0) {
    return stripLegacyHistoryPayload(entry);
  }

  const canonicalEvents: CanonicalHistoryNodeEvent[] = [];
  const snapshot = legacySnapshot(entry);

  // type=update + legacy prevProps snapshot → CanonicalUpdateEvent
  // (full snapshot 가정 — diff 보다 우선)
  if (entry.type === "update" && snapshot.prevProps && snapshot.props) {
    canonicalEvents.push(
      buildCanonicalUpdateEvent(
        entry.elementId,
        snapshot.prevProps as Record<string, unknown>,
        snapshot.props as Record<string, unknown>,
      ),
    );
  }

  // type=batch + legacy batchUpdates snapshot → CanonicalUpdateEvent[]
  if (
    canonicalEvents.length === 0 &&
    entry.type === "batch" &&
    snapshot.batchUpdates
  ) {
    for (const update of snapshot.batchUpdates) {
      canonicalEvents.push(
        buildCanonicalUpdateEvent(
          update.elementId,
          update.prevProps as Record<string, unknown>,
          update.newProps as Record<string, unknown>,
        ),
      );
    }
  }

  // diff/diffs — apply context 있을 때만 full props 로 변환
  if (canonicalEvents.length === 0) {
    canonicalEvents.push(...buildDiffUpdateEvents(entry, context));
  }

  // type=batch + prevElements/elements → update 또는 replace
  if (canonicalEvents.length === 0) {
    canonicalEvents.push(...buildBatchReplaceEventsFromEntry(entry));
  }

  // group/ungroup + element/elements
  if (canonicalEvents.length === 0) {
    canonicalEvents.push(...buildGroupUngroupEventsFromEntry(entry));
  }

  // add/remove + element/childElements → insert/remove events
  if (canonicalEvents.length === 0) {
    canonicalEvents.push(...buildStructuralEventsFromEntry(entry));
  }

  const migrated: HistoryEntry = {
    ...entry,
    data: {
      ...entry.data,
      canonicalEvents,
    },
  };

  return stripLegacyHistoryPayload(migrated);
}

/**
 * entry 배열 일괄 변환 (IndexedDB load / upgrade 경로용).
 * load 시점에는 elements/direction context 가 없어 diff-only entry 는
 * `canonicalEvents: []` 로 남는다 — 호출부는 `keepConvertibleHistoryEntries`
 * 로 element-axis 빈 entry 를 스택에서 제거해야 한다.
 */
export function migrateV1EntriesToV2(entries: HistoryEntry[]): HistoryEntry[] {
  return entries.map((entry) => migrateV1EntryToV2(entry));
}

const ELEMENT_AXIS_HISTORY_TYPES = new Set<HistoryEntry["type"]>([
  "add",
  "update",
  "remove",
  "move",
  "batch",
  "group",
  "ungroup",
]);

/** element 축 entry 가 undo/redo 에 쓸 canonicalEvents 를 가졌는가. */
export function isConvertibleElementHistoryEntry(entry: HistoryEntry): boolean {
  if (!ELEMENT_AXIS_HISTORY_TYPES.has(entry.type)) return true;
  return (entry.data.canonicalEvents?.length ?? 0) > 0;
}

/**
 * migrate 후에도 canonicalEvents 가 비어 있는 element-axis entry 를 제거.
 * page-* / snapshot-restore 는 자체 payload 로 적용되므로 유지.
 */
export function keepConvertibleHistoryEntries(
  entries: HistoryEntry[],
): HistoryEntry[] {
  return entries.filter(isConvertibleElementHistoryEntry);
}

/**
 * **ADR-124 Phase 5 prerequisite** — props 추출 helper export (unit test 용).
 */
export { extractPropsFromDiff };

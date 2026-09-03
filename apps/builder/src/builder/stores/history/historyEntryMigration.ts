/**
 * **ADR-124 Phase 3 — v1 entry → v2 canonical event adapter**.
 *
 * v1 IndexedDB 에 저장된 legacy snapshot field (`element` / `prevElement` /
 * `props` / `prevProps` / `childElements` / `elements` / `prevElements` /
 * `batchUpdates`) 를 보유한 entry 를 canonical event sequence 로 변환한다.
 *
 * 본 adapter 는 in-memory fallback path 와 IndexedDB v1→v2 onupgradeneeded
 * migration 양쪽에서 재사용된다.
 *
 * 변환 규칙:
 * - 이미 `canonicalEvents` 보유 → identity 후 legacy snapshot strip
 * - `diff` (type=update) → `CanonicalUpdateEvent` 1개
 * - `diffs` (type=batch) → `CanonicalUpdateEvent[]`
 * - `prevProps` (legacy update snapshot) → `CanonicalUpdateEvent`
 * - `batchUpdates` (legacy batch snapshot) → `CanonicalUpdateEvent[]`
 * - `prevElements`/`elements` (legacy batch snapshot) → replace events
 * - `element`/`childElements` (legacy add/remove) → insert/remove events
 *   (parentId/index 는 Element.parent_id + sibling order best-effort)
 * - 변환 성공 시 deprecated legacy snapshot keys strip
 * - 변환 불가 / 빈 entry → `canonicalEvents: []` (legacy fallback 유지)
 *
 * @see docs/adr/124-canonical-only-history-schema.md
 * @see docs/adr/design/124-canonical-only-history-schema-breakdown.md §Phase 3 + §Phase 5
 */

import type { ComponentElementProps } from "../../../types/core/store.types";
import type { Element } from "../../../types/core/store.types";
import type { SerializableElementDiff } from "../utils/elementDiff";
import type { HistoryEntry } from "../history";
import {
  buildCanonicalInsertEvents,
  buildCanonicalRemoveEvents,
  buildCanonicalReplaceEvents,
  buildCanonicalUpdateEvent,
  type CanonicalHistoryNodeEvent,
} from "./canonicalHistoryEvents";

/** HistoryEntry.data 에서 migration 성공 후 제거하는 legacy snapshot keys. */
const LEGACY_SNAPSHOT_DATA_KEYS = [
  "element",
  "prevElement",
  "props",
  "prevProps",
  "childElements",
  "elements",
  "prevElements",
  "batchUpdates",
] as const;

function asElementArray(value: unknown): Element[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Element =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as Element).id === "string" &&
      typeof (item as Element).type === "string",
  );
}

function asElement(value: unknown): Element | null {
  if (!value || typeof value !== "object") return null;
  const element = value as Element;
  if (typeof element.id !== "string" || typeof element.type !== "string") {
    return null;
  }
  return element;
}

/**
 * `SerializableElementDiff` 에서 prevProps / nextProps 를 추출.
 *
 * - `diff.props.changed` → 변경된 키의 prev/next
 * - `diff.props.added` → next 만 (prev 는 undefined)
 * - `diff.props.removed` → prev 만 (next 는 undefined)
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
 * migration 성공 entry 의 legacy snapshot payload 제거.
 *
 * **지금은 no-op 에 가깝게 유지**: historyActions legacy fallback 이 아직
 * `element`/`childElements`/`prevElements`/`elements` 를 읽는다.
 * `applyCanonicalHistoryEventsToActiveDocument` 가 project 미적재로 null 을
 * 반환하면 fallback 으로 내려가는데, strip 하면 undo/redo 가 조용히 no-op 이 된다.
 * raw legacy read 계측이 0 임을 실측한 뒤 이 함수 본문을 활성화한다.
 */
export function stripLegacyHistoryPayload(entry: HistoryEntry): HistoryEntry {
  if (!entry.data.canonicalEvents || entry.data.canonicalEvents.length === 0) {
    return entry;
  }

  // Phase gate: payload 보존 (fallback 안전). strip 활성화는 raw-read=0 이후.
  void LEGACY_SNAPSHOT_DATA_KEYS;
  return entry;
}

function buildStructuralEventsFromEntry(
  entry: HistoryEntry,
): CanonicalHistoryNodeEvent[] {
  const root = asElement(entry.data.element);
  const children = asElementArray(entry.data.childElements);
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

function buildBatchReplaceEventsFromEntry(
  entry: HistoryEntry,
): CanonicalHistoryNodeEvent[] {
  if (entry.type !== "batch") return [];
  const prevElements = asElementArray(entry.data.prevElements);
  const nextElements = asElementArray(entry.data.elements);
  if (prevElements.length === 0 || nextElements.length === 0) return [];
  return buildCanonicalReplaceEvents(prevElements, nextElements);
}

/**
 * 단일 entry 를 v1 → v2 canonical event 로 변환.
 *
 * **identity preserve**: 이미 canonicalEvents 보유한 entry 는 strip 만 적용.
 * **best-effort**: 변환 불가 시 `canonicalEvents: []` (legacy fallback 유지).
 */
export function migrateV1EntryToV2(entry: HistoryEntry): HistoryEntry {
  // 이미 canonical 변환된 entry → strip 만 (legacy payload 제거)
  if (entry.data.canonicalEvents && entry.data.canonicalEvents.length > 0) {
    return stripLegacyHistoryPayload(entry);
  }

  const canonicalEvents: CanonicalHistoryNodeEvent[] = [];

  // type=update + diff → CanonicalUpdateEvent 1개
  if (entry.type === "update" && entry.data.diff) {
    const { prevProps, nextProps } = extractPropsFromDiff(entry.data.diff);
    canonicalEvents.push(
      buildCanonicalUpdateEvent(entry.elementId, prevProps, nextProps),
    );
  }

  // type=update + legacy prevProps snapshot → CanonicalUpdateEvent
  if (
    canonicalEvents.length === 0 &&
    entry.type === "update" &&
    entry.data.prevProps &&
    entry.data.props
  ) {
    canonicalEvents.push(
      buildCanonicalUpdateEvent(
        entry.elementId,
        entry.data.prevProps as Record<string, unknown>,
        entry.data.props as Record<string, unknown>,
      ),
    );
  }

  // type=batch + diffs → CanonicalUpdateEvent[]
  if (entry.type === "batch" && entry.data.diffs) {
    for (const diff of entry.data.diffs) {
      const { prevProps, nextProps } = extractPropsFromDiff(diff);
      canonicalEvents.push(
        buildCanonicalUpdateEvent(diff.elementId, prevProps, nextProps),
      );
    }
  }

  // type=batch + legacy batchUpdates snapshot → CanonicalUpdateEvent[]
  if (
    canonicalEvents.length === 0 &&
    entry.type === "batch" &&
    entry.data.batchUpdates
  ) {
    for (const update of entry.data.batchUpdates) {
      canonicalEvents.push(
        buildCanonicalUpdateEvent(
          update.elementId,
          update.prevProps as Record<string, unknown>,
          update.newProps as Record<string, unknown>,
        ),
      );
    }
  }

  // type=batch + prevElements/elements → replace events
  if (canonicalEvents.length === 0) {
    canonicalEvents.push(...buildBatchReplaceEventsFromEntry(entry));
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
 * entry 배열 일괄 변환 (session-restore / IDB load 경로용).
 */
export function migrateV1EntriesToV2(entries: HistoryEntry[]): HistoryEntry[] {
  return entries.map(migrateV1EntryToV2);
}

/**
 * **ADR-124 Phase 5 prerequisite** — props 추출 helper export (unit test 용).
 */
export { extractPropsFromDiff };

// ComponentElementProps 가 unused 되지 않도록 type-only re-export.
export type { ComponentElementProps };

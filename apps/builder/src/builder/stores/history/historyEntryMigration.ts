/**
 * **ADR-124 Phase 3 — v1 entry → v2 canonical event adapter**.
 *
 * v1 IndexedDB 에 저장된 legacy snapshot field (`element` / `prevElement` /
 * `props` / `prevProps` / `childElements` / `elements` / `prevElements` /
 * `batchUpdates`) 를 보유한 entry 를 canonical event sequence 로 변환한다.
 *
 * 본 adapter 는 in-memory fallback path 와 (Phase 5 시점) IndexedDB v1→v2
 * onupgradeneeded migration 양쪽에서 재사용된다.
 *
 * 변환 정책:
 * - 이미 `canonicalEvents` 보유 → identity (그대로 반환)
 * - `diff` (type=update) → `CanonicalUpdateEvent` 1개 생성
 * - `diffs` (type=batch) → `CanonicalUpdateEvent[]` 생성
 * - `prevProps` (legacy update snapshot) → `CanonicalUpdateEvent` 생성
 * - `batchUpdates` (legacy batch snapshot) → `CanonicalUpdateEvent[]` 생성
 * - `element`/`childElements` (legacy add/remove snapshot) → 변환 시도 없이
 *   `canonicalEvents: []` graceful degradation. **이유**: structural insert/remove
 *   event 는 정확한 parentId/index 가 필요하나 v1 snapshot 에 미보존. undo/redo
 *   에서 no-op 으로 처리 (사용자에게는 "이전 변경" 이력만 노출, 적용 시 무동작).
 * - 변환 불가 / 빈 entry → `canonicalEvents: []` graceful degradation.
 *
 * @see docs/adr/124-canonical-only-history-schema.md
 * @see docs/adr/design/124-canonical-only-history-schema-breakdown.md §Phase 3 + §Phase 5
 */

import type { ComponentElementProps } from "../../../types/core/store.types";
import type { SerializableElementDiff } from "../utils/elementDiff";
import type { HistoryEntry } from "../history";
import {
  buildCanonicalUpdateEvent,
  type CanonicalHistoryNodeEvent,
} from "./canonicalHistoryEvents";

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
 * 단일 entry 를 v1 → v2 canonical event 로 변환.
 *
 * **identity preserve**: 이미 canonicalEvents 보유한 entry 는 그대로 반환.
 * **best-effort**: 변환 불가 시 `canonicalEvents: []` (no-op graceful degradation).
 */
export function migrateV1EntryToV2(entry: HistoryEntry): HistoryEntry {
  // 이미 canonical 변환된 entry → identity
  if (entry.data.canonicalEvents && entry.data.canonicalEvents.length > 0) {
    return entry;
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
  // (canonicalEvents 가 비어 있을 때만 fallback 으로 적용)
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

  // add/remove + element/childElements snapshot:
  // structural event 의 정확한 parentId/index 보존이 v1 schema 에서 불가 →
  // canonicalEvents: [] graceful degradation. undo/redo no-op 처리.

  return {
    ...entry,
    data: {
      ...entry.data,
      canonicalEvents,
    },
  };
}

/**
 * entry 배열 일괄 변환 (session-restore 경로용).
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

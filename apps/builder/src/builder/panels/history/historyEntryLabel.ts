/**
 * History 패널 entry label 생성 — canonicalEvents 우선.
 *
 * 우선순위:
 * 1. `entry.data.canonicalEvents` — insert/remove 는 event 에 담긴 node 에서,
 *    update/move 는 현재 canonical document 조회로 이름 해석
 * 2. v1 legacy snapshot (`data.element`/`prevElement`) — 구 IndexedDB entry
 *    호환 (ADR-124 Phase 5 legacy field 삭제 시 이 분기만 제거)
 * 3. `entry.elementId` — sentinel(`batch_diff`/`drag-reorder`) 은 노출 금지
 */

import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import type { HistoryEntry } from "../../stores/history";
import {
  findLocation,
  type CanonicalHistoryNodeEvent,
} from "../../stores/history/canonicalHistoryEvents";

const SENTINEL_ELEMENT_IDS = new Set(["batch_diff", "drag-reorder"]);

function truncateId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function nodeDisplayName(node: CanonicalNode): string | null {
  const metadata = node.metadata as Record<string, unknown> | undefined;
  const customId = metadata?.customId;
  if (typeof customId === "string" && customId.length > 0) return customId;
  if (typeof node.name === "string" && node.name.length > 0) return node.name;
  const sourceType = metadata?.sourceElementType;
  if (typeof sourceType === "string" && sourceType.length > 0) {
    return sourceType;
  }
  return typeof node.type === "string" && node.type.length > 0
    ? node.type
    : null;
}

function subjectFromEvent(
  event: CanonicalHistoryNodeEvent,
  doc: CompositionDocument | null,
): string | null {
  if (event.type === "insert" || event.type === "remove") {
    return nodeDisplayName(event.node);
  }
  const location = doc ? findLocation(doc, event.nodeId) : null;
  if (location) return nodeDisplayName(location.node);
  return `${truncateId(event.nodeId)} (삭제됨)`;
}

function subjectFromLegacySnapshot(entry: HistoryEntry): string | null {
  const element = entry.data.element ?? entry.data.prevElement;
  if (element?.customId) return element.customId;
  if (element?.type) return element.type;
  return null;
}

function subjectFromElementId(entry: HistoryEntry): string | null {
  if (!entry.elementId) return null;
  if (SENTINEL_ELEMENT_IDS.has(entry.elementId)) return null;
  return truncateId(entry.elementId);
}

function resolveSubject(
  entry: HistoryEntry,
  doc: CompositionDocument | null,
): string | null {
  const events = entry.data.canonicalEvents;
  if (events && events.length > 0) {
    return subjectFromEvent(events[0], doc);
  }
  return subjectFromLegacySnapshot(entry) ?? subjectFromElementId(entry);
}

function countBatchTargets(entry: HistoryEntry): number {
  const events = entry.data.canonicalEvents;
  if (events && events.length > 0) {
    const nodeIds = new Set<string>();
    for (const event of events) {
      if (event.type === "update" || event.type === "move") {
        nodeIds.add(event.nodeId);
      } else {
        nodeIds.add(event.node.id);
      }
    }
    return nodeIds.size;
  }
  return entry.elementIds?.length ?? entry.data.diffs?.length ?? 0;
}

export function getHistoryEntryLabel(
  entry: HistoryEntry,
  doc: CompositionDocument | null,
): string {
  const subject = resolveSubject(entry, doc);
  const suffix = subject ? ` ${subject}` : "";

  switch (entry.type) {
    case "add":
      return `추가${suffix}`;
    case "remove":
      return `삭제${suffix}`;
    case "update":
      return `수정${suffix}`;
    case "move":
      return `이동${suffix}`;
    case "batch":
      return `일괄 수정 (${countBatchTargets(entry)})`;
    case "group": {
      const count =
        entry.data.groupData?.childIds?.length ?? entry.elementIds?.length ?? 0;
      return `그룹 (${count})`;
    }
    case "ungroup": {
      const count =
        entry.data.groupData?.childIds?.length ?? entry.elementIds?.length ?? 0;
      return `그룹 해제 (${count})`;
    }
    case "page-position": {
      const count = new Set(
        entry.data.pagePositionEvent?.entries.map((item) => item.pageId) ?? [],
      ).size;
      return count > 1 ? `페이지 이동 (${count})` : "페이지 이동";
    }
    case "snapshot-restore": {
      // ADR-180 — snapshotName 은 entry 에 담긴 사본이라 스냅샷 삭제 후에도
      // 라벨 유지 (R5)
      const name = entry.data.snapshotRestoreEvent?.snapshotName;
      return name ? `스냅샷 복원 — ${name}` : "스냅샷 복원";
    }
    default:
      return "변경";
  }
}

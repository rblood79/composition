/**
 * History 패널 entry label 생성 — canonicalEvents 우선.
 *
 * 우선순위:
 * 1. `entry.data.canonicalEvents` — insert/remove 는 event 에 담긴 node 에서,
 *    update/move 는 현재 canonical document 조회로 이름 해석
 * 2. `entry.elementId` — sentinel(`batch_diff`/`drag-reorder`) 은 노출 금지
 */

import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import type { HistoryEntry } from "../../stores/history";
import { dataChangeEventLabel, type TranslateFn } from "./dataChangeEventLabel";

export type { TranslateFn };
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
  t: TranslateFn,
): string | null {
  if (event.type === "insert" || event.type === "remove") {
    return nodeDisplayName(event.node);
  }
  const location = doc ? findLocation(doc, event.nodeId) : null;
  if (location) return nodeDisplayName(location.node);
  return t("history.entryDeletedSubject", { id: truncateId(event.nodeId) });
}

function subjectFromElementId(entry: HistoryEntry): string | null {
  if (!entry.elementId) return null;
  if (SENTINEL_ELEMENT_IDS.has(entry.elementId)) return null;
  return truncateId(entry.elementId);
}

function resolveSubject(
  entry: HistoryEntry,
  doc: CompositionDocument | null,
  t: TranslateFn,
): string | null {
  const events = entry.data.canonicalEvents;
  if (events && events.length > 0) {
    return subjectFromEvent(events[0], doc, t);
  }
  return subjectFromElementId(entry);
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

/**
 * ADR-152 Phase 1c — `data` entry 라벨. op 1개면 종류별, 여럿이면 개수. 필드 key ·
 * 컬렉션 이름은 entry 에 담긴 사본 (이후 rename 돼도 그때의 이름) — 컬렉션 이름은
 * op 에 없는 경우 (`set_cell` 등) 생략한다.
 */
function dataChangeLabel(entry: HistoryEntry, t: TranslateFn): string {
  return dataChangeEventLabel(entry.data.dataChangeEvent, t);
}

export function getHistoryEntryLabel(
  entry: HistoryEntry,
  doc: CompositionDocument | null,
  t: TranslateFn,
): string {
  const subject = resolveSubject(entry, doc, t);
  const suffix = subject ? ` ${subject}` : "";

  switch (entry.type) {
    case "add":
      return t("history.entryAdd", { suffix });
    case "remove":
      return t("history.entryRemove", { suffix });
    case "update":
      return t("history.entryUpdate", { suffix });
    case "move":
      return t("history.entryMove", { suffix });
    case "batch":
      return t("history.entryBatch", { count: countBatchTargets(entry) });
    case "group": {
      const count =
        entry.data.groupData?.childIds?.length ?? entry.elementIds?.length ?? 0;
      return t("history.entryGroup", { count });
    }
    case "ungroup": {
      const count =
        entry.data.groupData?.childIds?.length ?? entry.elementIds?.length ?? 0;
      return t("history.entryUngroup", { count });
    }
    case "page-title": {
      const event = entry.data.pageTitleEvent;
      return event?.after
        ? t("history.entryPageTitleNamed", { title: event.after })
        : t("history.entryPageTitle");
    }
    case "page-position": {
      const count = new Set(
        entry.data.pagePositionEvent?.entries.map((item) => item.pageId) ??
          entry.data.pagePlacementEvent?.entries.map((item) => item.pageId) ??
          [],
      ).size;
      return count > 1
        ? t("history.entryPageMoveCount", { count })
        : t("history.entryPageMove");
    }
    case "page-guide": {
      // ADR-181 — 목록 전체 교체라 before/after 길이 차로 생성/삭제를 가른다.
      // 같은 길이면 이동 (한 entry 안에 생성과 삭제가 섞이지 않는다 — 조작
      // 단위가 가이드 1개이고 batch 는 같은 종류만 묶는다).
      const entries = entry.data.pageGuideEvent?.entries ?? [];
      let before = 0;
      let after = 0;
      for (const item of entries) {
        before += item.before.length;
        after += item.after.length;
      }
      if (after > before) {
        const count = after - before;
        return count > 1
          ? t("history.entryGuideAddCount", { count })
          : t("history.entryGuideAdd");
      }
      if (after < before) {
        const count = before - after;
        return count > 1
          ? t("history.entryGuideRemoveCount", { count })
          : t("history.entryGuideRemove");
      }
      return t("history.entryGuideMove");
    }
    case "theme": {
      // ADR-227 — 조작 종류 + 이름 (entry 사본)
      const event = entry.data.themeEvent;
      const name = event?.themeName ?? "";
      switch (event?.kind) {
        case "add":
        case "duplicate":
          return t("history.entryThemeAdd", { name });
        case "remove":
          return t("history.entryThemeRemove", { name });
        case "rename":
          return t("history.entryThemeRename", { name });
        case "activate":
          return t("history.entryThemeActivate", { name });
        default:
          return t("history.entryThemeEdit", { name });
      }
    }
    case "snapshot-restore": {
      // ADR-180 — snapshotName 은 entry 에 담긴 사본이라 스냅샷 삭제 후에도
      // 라벨 유지 (R5)
      const name = entry.data.snapshotRestoreEvent?.snapshotName;
      return name
        ? t("history.entrySnapshotRestoreNamed", { name })
        : t("history.entrySnapshotRestore");
    }
    case "data":
      return dataChangeLabel(entry, t);
    case "page-lifecycle": {
      // ADR-185 G-1 — 페이지 생성/삭제 (제목은 entry 에 담긴 사본)
      const event = entry.data.pageLifecycleEvent;
      const title = event?.page.title;
      const verb =
        event?.action === "delete"
          ? t("history.entryPageDelete")
          : t("history.entryPageAdd");
      return title
        ? t("history.entryPageLifecycleNamed", { verb, title })
        : verb;
    }
    default:
      return t("history.entryDefault");
  }
}

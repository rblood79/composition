import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArchiveRestore,
  Camera,
  Clock,
  File,
  Group,
  History,
  Layers,
  LayoutTemplate,
  Minus,
  Move,
  Pencil,
  Plus,
  Redo,
  RulerDimensionLine,
  Trash2,
  Undo,
  Ungroup,
  type LucideIcon,
} from "lucide-react";
import { PanelHeader, EmptyState } from "../../components";
import { ActionIconButton } from "../../components/ui";
import { Button } from "@composition/shared/components";
import { iconProps, iconSmall } from "../../../utils/ui/uiConstants";
import { historyManager, type HistoryEntry } from "../../stores/history";
import { useStore } from "../../stores";
import { useCanonicalDocumentStore } from "../../stores/canonical/canonicalDocumentStore";
import {
  snapshotManager,
  USER_SNAPSHOT_LIMIT,
  type HistorySnapshot,
} from "../../stores/history/snapshots";
import { restoreSnapshot } from "../../stores/history/snapshotRestore";
import { getHistoryEntryLabel } from "./historyEntryLabel";
import "./HistoryPanel.css";

type HistoryListItem = {
  id: string;
  index: number;
  label: string;
  type?: HistoryEntry["type"];
  timestamp?: number;
  isStart?: boolean;
};

// entry 타입 → 아이콘 (Photoshop History 패널의 도구 아이콘 어법)
const ENTRY_TYPE_ICONS: Record<HistoryEntry["type"], LucideIcon> = {
  add: Plus,
  remove: Minus,
  update: Pencil,
  move: Move,
  batch: Layers,
  group: Group,
  ungroup: Ungroup,
  "page-position": LayoutTemplate,
  // ADR-181 — 눈금자 토글(SettingsPanel)과 같은 아이콘: 가이드는 눈금자에서
  // 만들고 눈금자로 되돌려 지우므로 같은 기능군으로 읽혀야 한다
  "page-guide": RulerDimensionLine,
  "snapshot-restore": ArchiveRestore,
};

// 더블클릭 rename 과 단일클릭 복원의 분리 지연 — 이 안에 두 번째 클릭이 오면
// 복원 대신 rename 진입 (복원은 문서 전체 교체라 오발 비용이 크다)
const RESTORE_CLICK_DELAY_MS = 250;

function entryIcon(item: HistoryListItem): LucideIcon {
  if (item.isStart) return File;
  return (item.type && ENTRY_TYPE_ICONS[item.type]) || Pencil;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatSize(chars: number): string {
  if (chars >= 1024 * 1024) return `${(chars / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(chars / 1024))}KB`;
}

/**
 * HistoryPanel - 히스토리 패널
 *
 * Photoshop History 패널처럼 스냅샷 + 변경 내역을 리스트로 보여줍니다.
 * 비활성 gating 은 PanelContainer 의 <Activity mode="hidden"> 이 담당 (ADR-155).
 */
export function HistoryPanel() {
  return <HistoryPanelContent />;
}

function HistoryPanelContent() {
  const goToHistoryIndex = useStore((state) => state.goToHistoryIndex);
  const historyOperationInProgress = useStore(
    (state) => state.historyOperationInProgress,
  );
  const undo = useStore((state) => state.undo);
  const redo = useStore((state) => state.redo);

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [historyInfo, setHistoryInfo] = useState(
    historyManager.getCurrentPageHistory(),
  );
  const projectId = useCanonicalDocumentStore(
    (state) => state.currentProjectId,
  );
  const activeDoc = useCanonicalDocumentStore((state) =>
    state.currentProjectId
      ? (state.documents.get(state.currentProjectId) ?? null)
      : null,
  );

  useEffect(() => {
    const updateHistory = () => {
      const info = historyManager.getCurrentPageHistory();
      setEntries(historyManager.getCurrentPageEntries());
      setHistoryInfo(info);
    };

    updateHistory();
    const unsubscribe = historyManager.subscribe(updateHistory);
    return unsubscribe;
  }, []);

  // ============================================
  // 스냅샷 (ADR-180 Phase 3)
  // ============================================

  const [snapshots, setSnapshots] = useState<HistorySnapshot[]>([]);
  const [restoring, setRestoring] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const renameCancelRef = useRef(false);
  const restoreTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!projectId) {
      setSnapshots([]);
      return;
    }
    const updateSnapshots = () => {
      setSnapshots([...snapshotManager.getSnapshots(projectId)]);
    };
    updateSnapshots();
    const unsubscribe = snapshotManager.subscribe(updateSnapshots);
    // IndexedDB hydrate (프로젝트당 1회) — 완료 시 notify → updateSnapshots
    void snapshotManager.loadProject(projectId);
    return unsubscribe;
  }, [projectId]);

  useEffect(
    () => () => {
      if (restoreTimerRef.current !== null) {
        window.clearTimeout(restoreTimerRef.current);
      }
    },
    [],
  );

  const userSnapshots = useMemo(
    () => snapshots.filter((snapshot) => snapshot.kind === "user"),
    [snapshots],
  );
  const canCreateSnapshot = userSnapshots.length < USER_SNAPSHOT_LIMIT;

  // 현재 히스토리 위치가 snapshot-restore entry 자체면 문서 == 해당 스냅샷
  const activeSnapshotId = useMemo(() => {
    const current = entries[historyInfo.currentIndex];
    return current?.data.snapshotRestoreEvent?.afterSnapshotId ?? null;
  }, [entries, historyInfo.currentIndex]);

  const handleCreateSnapshot = useCallback(async () => {
    if (!projectId) return;
    const doc = useCanonicalDocumentStore.getState().documents.get(projectId);
    if (!doc) return;
    try {
      await snapshotManager.createSnapshot({ projectId, doc, kind: "user" });
    } catch (error) {
      // 상한 도달 — 버튼 disabled 로 선차단되므로 방어적 처리만
      console.warn("[HistoryPanel] 스냅샷 생성 차단:", error);
    }
  }, [projectId]);

  const handleRestoreSnapshot = useCallback(
    async (snapshotId: string) => {
      if (restoring || historyOperationInProgress) return;
      setRestoring(true);
      try {
        await restoreSnapshot(useStore.getState, snapshotId);
      } finally {
        setRestoring(false);
      }
    },
    [restoring, historyOperationInProgress],
  );

  const scheduleRestore = useCallback(
    (snapshotId: string) => {
      if (restoreTimerRef.current !== null) {
        window.clearTimeout(restoreTimerRef.current);
      }
      restoreTimerRef.current = window.setTimeout(() => {
        restoreTimerRef.current = null;
        void handleRestoreSnapshot(snapshotId);
      }, RESTORE_CLICK_DELAY_MS);
    },
    [handleRestoreSnapshot],
  );

  const beginRename = useCallback((snapshotId: string) => {
    if (restoreTimerRef.current !== null) {
      window.clearTimeout(restoreTimerRef.current);
      restoreTimerRef.current = null;
    }
    renameCancelRef.current = false;
    setRenamingId(snapshotId);
  }, []);

  const commitRename = useCallback(
    (snapshotId: string, value: string) => {
      setRenamingId(null);
      if (renameCancelRef.current) {
        renameCancelRef.current = false;
        return;
      }
      if (!projectId) return;
      void snapshotManager.renameSnapshot(projectId, snapshotId, value);
    },
    [projectId],
  );

  const handleDeleteSnapshot = useCallback(
    (snapshot: HistorySnapshot) => {
      if (!projectId) return;
      if (confirm(`스냅샷 "${snapshot.name}"을(를) 삭제할까요?`)) {
        void snapshotManager.deleteSnapshot(projectId, snapshot.id);
      }
    },
    [projectId],
  );

  // ============================================
  // 편집 히스토리
  // ============================================

  const handleUndo = useCallback(async () => {
    if (!historyInfo.canUndo) return;
    await undo();
  }, [historyInfo.canUndo, undo]);

  const handleRedo = useCallback(async () => {
    if (!historyInfo.canRedo) return;
    await redo();
  }, [historyInfo.canRedo, redo]);

  const handleClear = useCallback(() => {
    const currentPageId = useStore.getState().currentPageId;
    if (!currentPageId) return;
    if (confirm("현재 페이지 히스토리를 모두 삭제할까요?")) {
      historyManager.clearPageHistory(currentPageId);
    }
  }, []);

  const handleJumpToIndex = useCallback(
    async (targetIndex: number) => {
      if (historyOperationInProgress) return;

      const info = historyManager.getCurrentPageHistory();
      const currentIndex = info.currentIndex;

      if (targetIndex === currentIndex) return;

      // 한 번에 목표 인덱스로 이동 (중간 렌더링 없이)
      await goToHistoryIndex(targetIndex);
    },
    [historyOperationInProgress, goToHistoryIndex],
  );

  const displayEntries = useMemo<HistoryListItem[]>(() => {
    const mapped: HistoryListItem[] = entries.map((entry, index) => ({
      id: entry.id,
      index,
      label: getHistoryEntryLabel(entry, activeDoc),
      type: entry.type,
      timestamp: entry.timestamp,
    }));

    const ordered = mapped.reverse();

    if (entries.length > 0) {
      ordered.push({
        id: "history-start",
        index: -1,
        label: "시작 상태",
        timestamp: undefined,
        isStart: true,
      });
    }

    return ordered;
  }, [entries, activeDoc]);

  return (
    <div className="panel history-panel">
      <PanelHeader
        icon={<History size={iconProps.size} />}
        title="히스토리"
        actions={
          <div className="history-actions">
            <span className="history-count">
              {Math.max(historyInfo.currentIndex + 1, 0)}/
              {historyInfo.totalEntries}
            </span>
            <ActionIconButton
              onPress={handleUndo}
              isDisabled={!historyInfo.canUndo || historyOperationInProgress}
              aria-label="Undo"
              shortcutId="undo"
              tooltipPlacement="bottom"
            >
              <Undo size={iconProps.size} />
            </ActionIconButton>
            <ActionIconButton
              onPress={handleRedo}
              isDisabled={!historyInfo.canRedo || historyOperationInProgress}
              aria-label="Redo"
              shortcutId="redo"
              tooltipPlacement="bottom"
            >
              <Redo size={iconProps.size} />
            </ActionIconButton>
            <ActionIconButton
              onPress={handleClear}
              isDisabled={historyOperationInProgress}
              aria-label="Clear history"
              tooltip="히스토리 초기화"
            >
              <Trash2 size={iconProps.size} />
            </ActionIconButton>
          </div>
        }
      />

      <div className="panel-contents history-contents">
        {projectId && (
          <div className="history-snapshot-section">
            <div className="history-snapshot-header">
              <span className="history-snapshot-title">스냅샷</span>
              <span className="history-count">
                {userSnapshots.length}/{USER_SNAPSHOT_LIMIT}
              </span>
              <ActionIconButton
                onPress={handleCreateSnapshot}
                isDisabled={!canCreateSnapshot || restoring}
                aria-label="스냅샷 생성"
                tooltip={
                  canCreateSnapshot
                    ? "현재 문서 스냅샷 생성"
                    : "상한 도달 — 기존 스냅샷을 삭제한 후 생성할 수 있습니다"
                }
              >
                <Camera size={iconProps.size} />
              </ActionIconButton>
            </div>
            {userSnapshots.length > 0 && (
              <div className="history-snapshot-list">
                {userSnapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="history-snapshot-item"
                    data-active={snapshot.id === activeSnapshotId}
                    onDoubleClick={() => beginRename(snapshot.id)}
                  >
                    {renamingId === snapshot.id ? (
                      <input
                        className="history-snapshot-rename"
                        defaultValue={snapshot.name}
                        autoFocus
                        onFocus={(event) => event.currentTarget.select()}
                        onBlur={(event) =>
                          commitRename(snapshot.id, event.currentTarget.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.currentTarget.blur();
                          } else if (event.key === "Escape") {
                            renameCancelRef.current = true;
                            event.currentTarget.blur();
                          }
                        }}
                      />
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onPress={() => scheduleRestore(snapshot.id)}
                          isDisabled={restoring || historyOperationInProgress}
                          className="history-item-btn history-snapshot-btn"
                        >
                          <span className="history-item-icon">
                            <Camera size={iconSmall.size} />
                          </span>
                          <span className="history-item-main">
                            <span className="history-label">
                              {snapshot.name}
                            </span>
                            <span className="history-meta">
                              <Clock size={iconSmall.size} />
                              {formatTimestamp(snapshot.createdAt)} ·{" "}
                              {formatSize(snapshot.estimatedSize)}
                            </span>
                          </span>
                        </Button>
                        <span className="history-snapshot-delete">
                          <ActionIconButton
                            onPress={() => handleDeleteSnapshot(snapshot)}
                            isDisabled={restoring}
                            aria-label={`스냅샷 삭제: ${snapshot.name}`}
                            tooltip="삭제"
                          >
                            <Trash2 size={iconSmall.size} />
                          </ActionIconButton>
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {displayEntries.length === 0 ? (
          <EmptyState
            icon={<History size={48} />}
            message="히스토리가 없습니다"
            description="요소를 추가하거나 수정하면 기록이 표시됩니다"
          />
        ) : (
          <div className="history-list">
            {displayEntries.map((item) => {
              const isActive = item.index === historyInfo.currentIndex;
              const isStart = item.isStart;
              const timestamp = !isStart ? item.timestamp : undefined;
              // 미래 state (redo 가능 구간) — 새 편집 시 폐기됨을 흐림으로 예고
              const isFuture =
                !isStart && item.index > historyInfo.currentIndex;
              const Icon = entryIcon(item);

              return (
                <div
                  key={item.id}
                  className="history-item"
                  data-active={isActive}
                  data-start={isStart}
                  data-future={isFuture}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => handleJumpToIndex(item.index)}
                    isDisabled={historyOperationInProgress}
                    className="history-item-btn"
                  >
                    <span className="history-item-icon">
                      <Icon size={iconSmall.size} />
                    </span>
                    <span className="history-item-main">
                      <span className="history-label">{item.label}</span>
                      {!isStart && timestamp !== undefined && (
                        <span className="history-meta">
                          <Clock size={iconSmall.size} />
                          {formatTimestamp(timestamp)}
                        </span>
                      )}
                    </span>
                    {!isStart && (
                      <span className="history-index">{item.index + 1}</span>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

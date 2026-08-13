import { useCallback, useEffect, useMemo, useState } from "react";
import {
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
};

function entryIcon(item: HistoryListItem): LucideIcon {
  if (item.isStart) return File;
  return (item.type && ENTRY_TYPE_ICONS[item.type]) || Pencil;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * HistoryPanel - 히스토리 패널
 *
 * Photoshop History 패널처럼 변경 내역을 리스트로 보여줍니다.
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

  if (displayEntries.length === 0) {
    return (
      <div className="panel history-panel">
        <PanelHeader
          icon={<History size={iconProps.size} />}
          title="히스토리"
        />
        <EmptyState
          icon={<History size={48} />}
          message="히스토리가 없습니다"
          description="요소를 추가하거나 수정하면 기록이 표시됩니다"
        />
      </div>
    );
  }

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
        <div className="history-list">
          {displayEntries.map((item) => {
            const isActive = item.index === historyInfo.currentIndex;
            const isStart = item.isStart;
            const timestamp = !isStart ? item.timestamp : undefined;
            // 미래 state (redo 가능 구간) — 새 편집 시 폐기됨을 흐림으로 예고
            const isFuture = !isStart && item.index > historyInfo.currentIndex;
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
      </div>
    </div>
  );
}

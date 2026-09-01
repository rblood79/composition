/**
 * SelectionMemory - 선택 기록 컴포넌트
 *
 * Phase 9: Advanced Features - Selection Memory
 * 이전 선택 기록 및 복원
 */

import { useState, useEffect } from "react";
import { Button } from "@composition/shared/components";
import { History, Clock, RotateCcw } from "lucide-react";
import {
  iconProps,
  iconEditProps,
  iconSmall,
} from "../../../utils/ui/uiConstants";
import {
  selectionMemory,
  formatTimestamp,
  type SelectionHistoryEntry,
} from "../../utils/selectionMemory";
import { EmptyState } from "../feedback/EmptyState";

import "./SelectionMemory.css";
import { ACTION_ICONS } from "../../config/actionIcons";

/** 컨텍스트 메뉴·다중 선택 툴바와 같은 삭제 아이콘 정본 (`config/actionIcons.ts`). */
const DeleteIcon = ACTION_ICONS.delete;

export interface SelectionMemoryProps {
  /** Current page ID */
  currentPageId: string | null;
  /** Restore selection callback */
  onRestore: (elementIds: string[]) => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * Selection Memory 컴포넌트
 *
 * @example
 * ```tsx
 * <SelectionMemory
 *   currentPageId={currentPageId}
 *   onRestore={(ids) => setSelectedElements(ids)}
 * />
 * ```
 */
export function SelectionMemory({
  currentPageId,
  onRestore,
  className = "",
}: SelectionMemoryProps) {
  const [history, setHistory] = useState<SelectionHistoryEntry[]>([]);

  // Subscribe to history changes
  useEffect(() => {
    const updateHistory = () => {
      setHistory(selectionMemory.getHistory());
    };

    // Initial load
    updateHistory();

    // Subscribe to changes
    const unsubscribe = selectionMemory.subscribe(updateHistory);

    return unsubscribe;
  }, []);

  // Filter history by current page
  const pageHistory = history.filter(
    (entry) => !currentPageId || entry.pageId === currentPageId,
  );

  // Handle restore click
  const handleRestore = (entry: SelectionHistoryEntry) => {
    console.log(`[SelectionMemory] Restoring selection: ${entry.label}`);
    onRestore(entry.elementIds);
  };

  // Handle delete click
  const handleDelete = (entryId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    selectionMemory.removeEntry(entryId);
  };

  // Handle clear all
  const handleClearAll = () => {
    if (confirm("Clear all selection history?")) {
      selectionMemory.clearHistory();
    }
  };

  if (pageHistory.length === 0) {
    return (
      <div className={`selection-memory empty ${className}`.trim()}>
        <EmptyState
          icon={<History size={32} />}
          message="No selection history"
          description="Previous selections will appear here for quick access"
        />
      </div>
    );
  }

  return (
    <div className={`selection-memory ${className}`.trim()}>
      <div className="memory-header">
        <History
          color={iconProps.color}
          size={iconProps.size}
          strokeWidth={iconProps.strokeWidth}
        />
        <h3>Selection History</h3>
        <span className="history-count">{pageHistory.length}</span>
        {pageHistory.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onPress={handleClearAll}
            aria-label="Clear all history"
            className="clear-all-btn"
          >
            <DeleteIcon size={iconEditProps.size} />
          </Button>
        )}
      </div>

      <div className="history-list">
        {pageHistory.map((entry) => (
          <div key={entry.id} className="history-item">
            <Button
              variant="ghost"
              size="sm"
              onPress={() => handleRestore(entry)}
              className="history-item-btn"
            >
              <RotateCcw
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
              <div className="history-info">
                <span className="history-label">{entry.label}</span>
                <span className="history-time">
                  <Clock size={iconSmall.size} />
                  {formatTimestamp(entry.timestamp)}
                </span>
              </div>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onPress={(e) =>
                handleDelete(entry.id, e as unknown as React.MouseEvent)
              }
              aria-label="Delete history entry"
              className="delete-btn"
            >
              <DeleteIcon size={iconEditProps.size} />
            </Button>
          </div>
        ))}
      </div>

      <div className="memory-footer">
        <p className="footer-hint">
          💡 Last {Math.min(pageHistory.length, 5)} selections saved
        </p>
      </div>
    </div>
  );
}

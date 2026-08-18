/**
 * ComponentMemoryList Component
 *
 * 컴포넌트별 메모리 사용량 목록
 * - 상위 메모리 사용 요소 표시
 * - 정렬 옵션 (메모리, 자식수, 깊이)
 */

import { useState } from "react";
import { Box, RefreshCw } from "lucide-react";
import {
  useComponentMemory,
  type ComponentMemoryInfo,
} from "../hooks/useComponentMemory";
import { formatBytes } from "../hooks/useMemoryStats";
import { iconSmall, iconLarge } from "../../../../utils/ui/uiConstants";
import { ActionIconButton, PropertySelect } from "../../../components";

interface ComponentMemoryListProps {
  enabled?: boolean;
}

type SortBy = "memory" | "children" | "depth";

const SORT_OPTIONS = [
  { value: "memory", label: "Memory" },
  { value: "children", label: "Children" },
  { value: "depth", label: "Depth" },
] as const;

function getMemoryLevel(percentage: number): "high" | "medium" | "low" {
  if (percentage >= 15) return "high";
  if (percentage >= 5) return "medium";
  return "low";
}

export function ComponentMemoryList({
  enabled = true,
}: ComponentMemoryListProps) {
  const [sortBy, setSortBy] = useState<SortBy>("memory");
  const { componentMemory, totalMemory, refresh } = useComponentMemory({
    enabled,
    sortBy,
    limit: 15,
  });

  return (
    <div className="component-memory-list">
      <div className="component-memory-controls">
        <PropertySelect
          className="component-memory-sort"
          label="Sort by"
          value={sortBy}
          options={SORT_OPTIONS}
          onChange={(value) => setSortBy(value as SortBy)}
        />
        <ActionIconButton
          className="component-memory-refresh"
          onPress={refresh}
          aria-label="Refresh component memory"
          tooltip="Refresh component memory"
        >
          <RefreshCw size={iconSmall.size} />
        </ActionIconButton>
      </div>

      {/* Total */}
      <div className="component-memory-total">
        <span className="total-label">Total Elements Memory:</span>
        <span className="total-value">{formatBytes(totalMemory)}</span>
      </div>

      <div
        className="list-group list-group--stack component-memory-items"
        role="list"
      >
        {componentMemory.map((info) => (
          <ComponentMemoryItem key={info.elementId} info={info} />
        ))}
        {componentMemory.length === 0 && (
          <div className="component-memory-empty">
            <Box size={iconLarge.size} />
            <p>No components to analyze</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface ComponentMemoryItemProps {
  info: ComponentMemoryInfo;
}

function ComponentMemoryItem({ info }: ComponentMemoryItemProps) {
  const level = getMemoryLevel(info.percentage);

  return (
    <div
      className="list-item component-memory-item"
      data-level={level}
      role="listitem"
    >
      <div className="list-item-icon" aria-hidden="true">
        <Box size={iconSmall.size} />
      </div>
      <div className="list-item-content">
        <div className="list-item-name">
          {info.type}
          {info.customId && (
            <span className="component-customid">#{info.customId}</span>
          )}
        </div>
        <div className="list-item-meta">
          {formatBytes(info.memoryBytes)} · {info.childCount} children · depth{" "}
          {info.depth}
        </div>
        <div className="component-memory-bar" aria-hidden="true">
          <div
            className="component-memory-bar-fill"
            style={{ width: `${Math.min(100, info.percentage)}%` }}
          />
        </div>
      </div>
      <span className="list-item-badge component-memory-share">
        {info.percentage.toFixed(1)}%
      </span>
    </div>
  );
}

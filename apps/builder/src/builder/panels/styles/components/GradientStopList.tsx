/**
 * GradientStopList - 그래디언트 스톱 목록
 *
 * Gradient Phase 2 + Phase 3 ScrubInput 적용
 * - 각 행: [색상 스와치] [ScrubInput position %] [삭제 버튼]
 * - 스톱 추가/삭제/위치 변경
 *
 * @since 2026-02-10 Gradient Phase 2
 * @updated 2026-02-11 Phase 3 — ScrubInput 적용
 */

import { memo, useCallback } from "react";
import { X } from "lucide-react";
import type { GradientStop } from "../../../../types/builder/fill.types";
import { iconSmall } from "../../../../utils/ui/uiConstants";
import { ScrubInput } from "./ScrubInput";

import "./GradientStopList.css";
import { ACTION_ICONS } from "../../../config/actionIcons";

/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const AddIcon = ACTION_ICONS.add;

interface GradientStopListProps {
  stops: GradientStop[];
  activeStopIndex: number;
  onStopSelect: (index: number) => void;
  onStopPositionChange: (index: number, position: number) => void;
  onStopAdd: () => void;
  onStopRemove: (index: number) => void;
}

export const GradientStopList = memo(function GradientStopList({
  stops,
  activeStopIndex,
  onStopSelect,
  onStopPositionChange,
  onStopAdd,
  onStopRemove,
}: GradientStopListProps) {
  const canDelete = stops.length > 2;

  return (
    <div className="gradient-stop-list">
      {stops.map((stop, index) => (
        <StopRow
          key={index}
          index={index}
          stop={stop}
          isActive={index === activeStopIndex}
          canDelete={canDelete}
          onSelect={onStopSelect}
          onPositionChange={onStopPositionChange}
          onRemove={onStopRemove}
        />
      ))}
      <button
        type="button"
        className="gradient-stop-list__add-btn"
        onClick={onStopAdd}
      >
        <AddIcon size={12} strokeWidth={2} />
        Add Stop
      </button>
    </div>
  );
});

/** 개별 스톱 행 — ScrubInput 콜백 안정화를 위해 분리 */
const StopRow = memo(function StopRow({
  index,
  stop,
  isActive,
  canDelete,
  onSelect,
  onPositionChange,
  onRemove,
}: {
  index: number;
  stop: GradientStop;
  isActive: boolean;
  canDelete: boolean;
  onSelect: (index: number) => void;
  onPositionChange: (index: number, position: number) => void;
  onRemove: (index: number) => void;
}) {
  const handlePositionCommit = useCallback(
    (value: number) => {
      onPositionChange(index, value / 100);
    },
    [index, onPositionChange],
  );

  const handleClick = useCallback(() => {
    onSelect(index);
  }, [index, onSelect]);

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove(index);
    },
    [index, onRemove],
  );

  return (
    <div
      className="gradient-stop-list__row"
      data-active={isActive || undefined}
      onClick={handleClick}
    >
      <div
        className="gradient-stop-list__swatch"
        style={{ backgroundColor: stop.color.slice(0, 7) }}
      />
      <div onClick={(e) => e.stopPropagation()}>
        <ScrubInput
          value={Math.round(stop.position * 100)}
          onCommit={handlePositionCommit}
          min={0}
          max={100}
          suffix="%"
          label={`Stop ${index + 1} position`}
          className="gradient-stop-list__position-scrub"
        />
      </div>
      <span className="gradient-stop-list__spacer" />
      <button
        type="button"
        className="gradient-stop-list__delete"
        disabled={!canDelete}
        onClick={handleRemove}
        aria-label={`Remove stop ${index + 1}`}
      >
        <X
          size={iconSmall.size}
          strokeWidth={iconSmall.strokeWidth}
          color={iconSmall.color}
        />
      </button>
    </div>
  );
});

/**
 * MeshGradientEditor - 메쉬 그래디언트 편집기
 *
 * Phase 4: N×M 그리드 포인트 기반 그래디언트
 * - 그리드 크기 선택 (2×2 ~ 6×6)
 * - 각 포인트 색상 편집 (클릭 → ColorPickerPanel)
 * - 하위 타입 토글 (Linear/Radial/Angular/Mesh)
 *
 * @since 2026-02-11 Phase 4
 */

import { memo, useState, useCallback } from "react";
import type { Key } from "react-aria-components";
import { Select, SelectItem } from "@composition/shared/components";
import type {
  FillItem,
  MeshGradientFillItem,
  MeshPoint,
} from "../../../../types/builder/fill.types";
import { FillType } from "../../../../types/builder/fill.types";
import { ColorPickerPanel } from "./ColorPickerPanel";
import { ScrubInput } from "./ScrubInput";

import "./MeshGradientEditor.css";

type GradientSubType =
  | FillType.LinearGradient
  | FillType.RadialGradient
  | FillType.AngularGradient
  | FillType.MeshGradient;

interface MeshGradientEditorProps {
  fill: MeshGradientFillItem;
  onChange: (updates: Partial<FillItem>) => void;
  onChangeEnd: (updates: Partial<FillItem>) => void;
  onSubTypeChange: (subType: FillType) => void;
}

// ============================================
// Gradient SubType Select 옵션
// ============================================

const GRADIENT_SUB_TYPE_OPTIONS: { id: GradientSubType; name: string }[] = [
  { id: FillType.LinearGradient, name: "Linear" },
  { id: FillType.RadialGradient, name: "Radial" },
  { id: FillType.AngularGradient, name: "Angular" },
  { id: FillType.MeshGradient, name: "Mesh" },
];

// ============================================
// Default grid generation
// ============================================

const DEFAULT_COLORS = [
  "#FF0000FF",
  "#FFFF00FF",
  "#00FF00FF",
  "#FF00FFFF",
  "#888888FF",
  "#00FFFFFF",
  "#0000FFFF",
  "#FF8800FF",
  "#FFFFFFFF",
];

function generateDefaultGrid(rows: number, columns: number): MeshPoint[] {
  const points: MeshPoint[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const idx = r * columns + c;
      points.push({
        position: [c / (columns - 1), r / (rows - 1)],
        color: DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
      });
    }
  }
  return points;
}

// ============================================
// Main component
// ============================================

export const MeshGradientEditor = memo(function MeshGradientEditor({
  fill,
  onChange,
  onChangeEnd,
  onSubTypeChange,
}: MeshGradientEditorProps) {
  const [activePointIndex, setActivePointIndex] = useState(0);

  const { rows, columns, points } = fill;
  const activePoint = points[activePointIndex] ?? points[0];

  // 포인트가 비어 있으면 기본 그리드 생성
  const effectivePoints =
    points.length > 0 ? points : generateDefaultGrid(rows, columns);

  const handleSubTypeChange = useCallback(
    (key: Key | null) => {
      const subType = key as GradientSubType | null;
      if (subType && subType !== FillType.MeshGradient) {
        onSubTypeChange(subType);
      }
    },
    [onSubTypeChange],
  );

  const handleRowsChange = useCallback(
    (value: number) => {
      const newPoints = generateDefaultGrid(value, columns);
      onChangeEnd({
        rows: value,
        points: newPoints,
      } as Partial<MeshGradientFillItem>);
      setActivePointIndex(0);
    },
    [columns, onChangeEnd],
  );

  const handleColumnsChange = useCallback(
    (value: number) => {
      const newPoints = generateDefaultGrid(rows, value);
      onChangeEnd({
        columns: value,
        points: newPoints,
      } as Partial<MeshGradientFillItem>);
      setActivePointIndex(0);
    },
    [rows, onChangeEnd],
  );

  const handlePointColorChange = useCallback(
    (color: string) => {
      const newPoints = effectivePoints.map((p, i) =>
        i === activePointIndex ? { ...p, color } : p,
      );
      onChange({ points: newPoints } as Partial<MeshGradientFillItem>);
    },
    [effectivePoints, activePointIndex, onChange],
  );

  const handlePointColorChangeEnd = useCallback(
    (color: string) => {
      const newPoints = effectivePoints.map((p, i) =>
        i === activePointIndex ? { ...p, color } : p,
      );
      onChangeEnd({ points: newPoints } as Partial<MeshGradientFillItem>);
    },
    [effectivePoints, activePointIndex, onChangeEnd],
  );

  return (
    <div className="mesh-gradient-editor">
      <div className="react-aria-control react-aria-Group">
        <Select
          aria-label="Gradient type"
          size="sm"
          selectedKey={FillType.MeshGradient}
          onSelectionChange={handleSubTypeChange}
          items={GRADIENT_SUB_TYPE_OPTIONS}
          className="gradient-type-select"
        >
          {(item: { id: GradientSubType; name: string }) => (
            <SelectItem>{item.name}</SelectItem>
          )}
        </Select>
      </div>
      {/* Grid size controls */}
      <div className="mesh-gradient-editor__grid-controls">
        <span className="mesh-gradient-editor__label">Grid</span>
        <div className="mesh-gradient-editor__grid-row">
          <ScrubInput
            value={rows}
            onCommit={handleRowsChange}
            min={2}
            max={6}
            label="Rows"
            className="mesh-gradient-editor__scrub"
          />
          <span className="mesh-gradient-editor__x">&times;</span>
          <ScrubInput
            value={columns}
            onCommit={handleColumnsChange}
            min={2}
            max={6}
            label="Columns"
            className="mesh-gradient-editor__scrub"
          />
        </div>
      </div>

      {/* Point grid */}
      <div
        className="mesh-gradient-editor__point-grid"
        style={{
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
      >
        {effectivePoints.map((point, index) => (
          <button
            key={index}
            type="button"
            className="mesh-gradient-editor__point"
            data-active={index === activePointIndex || undefined}
            style={{ backgroundColor: point.color.slice(0, 7) }}
            onClick={() => setActivePointIndex(index)}
            aria-label={`Point ${index + 1}`}
          />
        ))}
      </div>

      {/* Active point color editor */}
      {activePoint && (
        <>
          <div className="mesh-gradient-editor__divider" />
          <ColorPickerPanel
            value={
              activePoint.color ??
              effectivePoints[activePointIndex]?.color ??
              "#000000FF"
            }
            resetKey={`${fill.id}:${activePointIndex}:${rows}x${columns}`}
            onChange={handlePointColorChange}
            onChangeEnd={handlePointColorChangeEnd}
          />
        </>
      )}
    </div>
  );
});

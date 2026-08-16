/**
 * FillLayerRow - 개별 Fill 레이어 행
 *
 * 레이아웃: [toggle] [swatch] [color-input/label] [opacity%] [delete]
 * - 클릭 시 FillDetailPopover 열기
 * - Phase 2: 그래디언트 swatch + 타입 라벨
 *
 * @since 2026-02-10 Color Picker Phase 1
 * @updated 2026-02-10 Gradient Phase 2
 */

import { memo, useCallback, useMemo } from "react";
import {
  Checkbox as AriaCheckbox,
  DialogTrigger,
  Button as AriaButton,
} from "react-aria-components";
import { ColorSwatch } from "@composition/shared/components/ColorSwatch";
import { Popover } from "@composition/shared/components/Popover";
import type {
  FillItem,
  ColorFillItem,
} from "../../../../types/builder/fill.types";
import { FillType } from "../../../../types/builder/fill.types";
import { FillDetailPopover } from "./FillDetailPopover";
import { ScrubInput } from "./ScrubInput";
import { iconSmall } from "../../../../utils/ui/uiConstants";
import {
  buildFillSwatchStyle,
  getFillDisplayLabel,
} from "../utils/fillPresentation";

import "./FillLayerRow.css";
import { ACTION_ICONS } from "../../../config/actionIcons";

/** 컨텍스트 메뉴·다중 선택 툴바와 같은 삭제 아이콘 정본 (`config/actionIcons.ts`). */
const DeleteIcon = ACTION_ICONS.delete;

interface FillLayerRowProps {
  fill: FillItem;
  onToggle: (fillId: string) => void;
  onUpdate: (fillId: string, updates: Partial<FillItem>) => void;
  onUpdatePreview: (fillId: string, updates: Partial<FillItem>) => void;
  onRemove: (fillId: string) => void;
  onTypeChange: (fillId: string, newType: FillType) => void;
}

export const FillLayerRow = memo(function FillLayerRow({
  fill,
  onToggle,
  onUpdate,
  onUpdatePreview,
  onRemove,
  onTypeChange,
}: FillLayerRowProps) {
  const isColor = fill.type === FillType.Color;
  const isGradient =
    fill.type === FillType.LinearGradient ||
    fill.type === FillType.RadialGradient ||
    fill.type === FillType.AngularGradient;
  const isMeshGradient = fill.type === FillType.MeshGradient;

  const colorValue = isColor ? (fill as ColorFillItem).color : "#000000FF";
  const displayLabel = getFillDisplayLabel(fill);
  const opacityPercent = Math.round(fill.opacity * 100);
  const swatchStyle = useMemo(() => buildFillSwatchStyle(fill), [fill]);

  const handleToggle = useCallback(() => {
    onToggle(fill.id);
  }, [fill.id, onToggle]);

  const handleRemove = useCallback(() => {
    onRemove(fill.id);
  }, [fill.id, onRemove]);

  const handleOpacityCommit = useCallback(
    (value: number) => {
      onUpdate(fill.id, { opacity: value / 100 });
    },
    [fill.id, onUpdate],
  );

  const handleColorChange = useCallback(
    (color: string) => {
      if (isColor) {
        onUpdatePreview(fill.id, { color } as Partial<ColorFillItem>);
      }
    },
    [fill.id, isColor, onUpdatePreview],
  );

  const handleColorChangeEnd = useCallback(
    (color: string) => {
      if (isColor) {
        onUpdate(fill.id, { color } as Partial<ColorFillItem>);
      }
    },
    [fill.id, isColor, onUpdate],
  );

  const handleFillUpdate = useCallback(
    (updates: Partial<FillItem>) => {
      onUpdatePreview(fill.id, updates);
    },
    [fill.id, onUpdatePreview],
  );

  const handleFillUpdateEnd = useCallback(
    (updates: Partial<FillItem>) => {
      onUpdate(fill.id, updates);
    },
    [fill.id, onUpdate],
  );

  const handleTypeChange = useCallback(
    (newType: FillType) => {
      onTypeChange(fill.id, newType);
    },
    [fill.id, onTypeChange],
  );

  return (
    <div className="fill-layer-row" data-enabled={fill.enabled || undefined}>
      <AriaCheckbox
        className="fill-layer-row__toggle"
        isSelected={fill.enabled}
        onChange={handleToggle}
        aria-label="Toggle fill"
      >
        <div className="fill-layer-row__checkbox" />
      </AriaCheckbox>

      <DialogTrigger>
        <AriaButton
          className="fill-layer-row__swatch-btn"
          aria-label="Edit fill"
        >
          {isColor && <ColorSwatch color={colorValue} />}
          {isGradient && (
            <div
              className="fill-layer-row__gradient-swatch"
              style={swatchStyle}
            />
          )}
          {isMeshGradient && (
            <div className="fill-layer-row__mesh-swatch" style={swatchStyle} />
          )}
          {fill.type === FillType.Image && (
            <div className="fill-layer-row__image-swatch" style={swatchStyle} />
          )}
        </AriaButton>
        <Popover
          placement="bottom start"
          className="fill-detail-popover-container"
          hideArrow
        >
          <FillDetailPopover
            fill={fill}
            onColorChange={handleColorChange}
            onColorChangeEnd={handleColorChangeEnd}
            onUpdate={handleFillUpdate}
            onUpdateEnd={handleFillUpdateEnd}
            onTypeChange={handleTypeChange}
          />
        </Popover>
      </DialogTrigger>

      <span className="fill-layer-row__hex">{displayLabel}</span>

      <ScrubInput
        value={opacityPercent}
        onCommit={handleOpacityCommit}
        min={0}
        max={100}
        suffix="%"
        label="Fill opacity"
        className="fill-layer-row__opacity-scrub"
      />

      <button
        type="button"
        className="fill-layer-row__delete"
        onClick={handleRemove}
        aria-label="Remove fill"
      >
        <DeleteIcon
          size={iconSmall.size}
          strokeWidth={iconSmall.strokeWidth}
          color={iconSmall.color}
        />
      </button>
    </div>
  );
});

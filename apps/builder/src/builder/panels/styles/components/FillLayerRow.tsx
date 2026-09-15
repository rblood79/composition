/**
 * FillLayerRow - Fill 레이어 목록 행 (Fill 절의 모든 레이어가 이 행 — 첫 레이어 포함)
 *
 * 레이아웃 (인스펙터 행 템플릿 `1fr 1fr 28px` 의 c12 + 28 열):
 *   [swatch 16 · HEX/타입 라벨 (팝오버 trigger)] [opacity %] [제거 (hover)]  |  [눈 토글 28]
 *
 * 첫 레이어는 ADR-187 presentation 경로 (연속 preview) 를 Fill 절이 소유하므로
 * `popover` override 로 받는다. 나머지 레이어는 commit-only.
 * fills 가 비어 있으면 절이 backgroundColor 기반 가상 레이어를 같은 행으로 그린다
 * (`isVirtual` — 토글·제거 없음, 색 커밋 시 실제 fill 로 승격).
 *
 * @since 2026-02-10 Color Picker Phase 1
 * @updated 2026-09-14 panel-ui 02 — 첫 레이어 통합 · 눈 토글 28 열
 */

import { memo, useCallback, useMemo } from "react";
import { DialogTrigger } from "react-aria-components/Dialog";
import { Button as AriaButton } from "react-aria-components/Button";
import { ToggleButton as AriaToggleButton } from "react-aria-components/ToggleButton";
import { Eye, EyeOff } from "lucide-react";
import { ColorSwatch } from "@composition/shared/components/ColorSwatch";
import { Popover } from "@composition/shared/components/Popover";
import type {
  FillItem,
  ColorFillItem,
} from "../../../../types/builder/fill.types";
import { FillType } from "../../../../types/builder/fill.types";
import { FillDetailPopover } from "./FillDetailPopover";
import { ScrubInput } from "./ScrubInput";
import { iconProps } from "../../../../utils/ui/uiConstants";
import {
  buildFillSwatchStyle,
  getFillDisplayLabel,
} from "../utils/fillPresentation";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../../i18n";

import "./FillLayerRow.css";
import { ACTION_ICONS } from "../../../config/actionIcons";

/** 컨텍스트 메뉴·다중 선택 툴바와 같은 삭제 아이콘 정본 (`config/actionIcons.ts`). */
const DeleteIcon = ACTION_ICONS.delete;

/** 첫 레이어 전용 — presentation 경로 (연속 preview + presentation-aware commit). */
export interface FillLayerRowPopoverOverrides {
  readonly presentationOwnsColorFrameScheduling?: boolean;
  readonly onColorPresentationCancel?: (
    reason: "pointer-cancel" | "escape",
  ) => void;
  readonly onColorChange?: (color: string) => void;
  readonly onColorChangeEnd?: (color: string) => void;
  readonly onOpacityChange?: (opacity: number) => void;
  readonly onOpacityChangeEnd?: (opacity: number) => void;
  readonly onUpdate?: (updates: Partial<FillItem>) => void;
  readonly onUpdateEnd?: (updates: Partial<FillItem>) => void;
  readonly onTypeChange?: (newType: FillType) => void;
}

interface FillLayerRowProps {
  fill: FillItem;
  onToggle: (fillId: string) => void;
  onUpdate: (fillId: string, updates: Partial<FillItem>) => void;
  onRemove: (fillId: string) => void;
  onTypeChange: (fillId: string, newType: FillType) => void;
  /** fills 가 비어 있을 때의 가상 레이어 — 토글·제거 없음 (커밋은 `popover` 가 승격) */
  isVirtual?: boolean;
  popover?: FillLayerRowPopoverOverrides;
}

// 첫 fill 전용 presentation owner가 없는 secondary row는 terminal commit-only다.
// raw callback에 canonical updater를 다시 연결하지 않도록 명시적인 no-op을 전달한다.
const ignoreContinuousColorChange = (_color: string): void => {};
const ignoreContinuousOpacityChange = (_opacity: number): void => {};
const ignoreContinuousFillUpdate = (_updates: Partial<FillItem>): void => {};

export const FillLayerRow = memo(function FillLayerRow({
  fill,
  onToggle,
  onUpdate,
  onRemove,
  onTypeChange,
  isVirtual = false,
  popover,
}: FillLayerRowProps) {
  const i18n = useOptionalI18n();
  const localize = (label: string) =>
    i18n
      ? translateKey(i18n.t, semanticLabelKeys[label] ?? label, label)
      : label;
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
      const opacity = value / 100;
      if (popover?.onOpacityChangeEnd) {
        popover.onOpacityChangeEnd(opacity);
        return;
      }
      onUpdate(fill.id, { opacity });
    },
    [fill.id, onUpdate, popover],
  );
  // 행 scrub 도 드래그 중 캔버스에 보인다 (첫 fill = presentation 경로, 팝오버 scrub 과 같음).
  //   presentation 경로가 없는 행 (둘째 이후) 은 commit-only 그대로.
  const onOpacityChange = popover?.onOpacityChange;
  const handleOpacityScrub = useMemo(
    () =>
      onOpacityChange
        ? (value: number) => onOpacityChange(value / 100)
        : undefined,
    [onOpacityChange],
  );

  const handleColorChangeEnd = useCallback(
    (color: string) => {
      if (popover?.onColorChangeEnd) {
        popover.onColorChangeEnd(color);
        return;
      }
      if (isColor) {
        onUpdate(fill.id, { color } as Partial<ColorFillItem>);
      }
    },
    [fill.id, isColor, onUpdate, popover],
  );

  const handleFillUpdateEnd = useCallback(
    (updates: Partial<FillItem>) => {
      if (popover?.onUpdateEnd) {
        popover.onUpdateEnd(updates);
        return;
      }
      onUpdate(fill.id, updates);
    },
    [fill.id, onUpdate, popover],
  );

  const handleTypeChange = useCallback(
    (newType: FillType) => {
      if (popover?.onTypeChange) {
        popover.onTypeChange(newType);
        return;
      }
      onTypeChange(fill.id, newType);
    },
    [fill.id, onTypeChange, popover],
  );

  return (
    <div
      className="fill-layer-row"
      data-enabled={fill.enabled || undefined}
      data-virtual={isVirtual || undefined}
    >
      <div className="fill-layer-row__body">
        <DialogTrigger>
          <AriaButton
            className="fill-layer-row__trigger"
            aria-label={localize("Edit fill")}
          >
            {isColor && <ColorSwatch color={colorValue} />}
            {isGradient && (
              <div
                className="fill-layer-row__gradient-swatch"
                style={swatchStyle}
              />
            )}
            {isMeshGradient && (
              <div
                className="fill-layer-row__mesh-swatch"
                style={swatchStyle}
              />
            )}
            {fill.type === FillType.Image && (
              <div
                className="fill-layer-row__image-swatch"
                style={swatchStyle}
              />
            )}
            <span className="fill-layer-row__hex">{displayLabel}</span>
          </AriaButton>
          <Popover
            placement="bottom start"
            className="fill-detail-popover-container"
            hideArrow
          >
            <FillDetailPopover
              fill={fill}
              presentationOwnsColorFrameScheduling={
                popover?.presentationOwnsColorFrameScheduling
              }
              onColorPresentationCancel={popover?.onColorPresentationCancel}
              onColorChange={
                popover?.onColorChange ?? ignoreContinuousColorChange
              }
              onColorChangeEnd={handleColorChangeEnd}
              onOpacityChange={
                popover?.onOpacityChange ?? ignoreContinuousOpacityChange
              }
              onOpacityChangeEnd={(opacity) =>
                handleOpacityCommit(opacity * 100)
              }
              onUpdate={popover?.onUpdate ?? ignoreContinuousFillUpdate}
              onUpdateEnd={handleFillUpdateEnd}
              onTypeChange={handleTypeChange}
            />
          </Popover>
        </DialogTrigger>

        <ScrubInput
          value={opacityPercent}
          onScrub={handleOpacityScrub}
          onCommit={handleOpacityCommit}
          min={0}
          max={100}
          suffix="%"
          label="Fill opacity"
          className="fill-layer-row__opacity-scrub"
        />
      </div>

      {/* 행 액션 그룹 — 눈 토글 · 삭제를 한 28 그룹 (안쪽 20×20 둘, 2026-09-15 사용자 판정) */}
      <div className="fill-layer-row__actions">
        <AriaToggleButton
          className="fill-layer-row__action fill-layer-row__visibility"
          isSelected={fill.enabled}
          isDisabled={isVirtual}
          onChange={handleToggle}
          aria-label={localize("Toggle fill visibility")}
        >
          {fill.enabled ? (
            <Eye
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          ) : (
            <EyeOff
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          )}
        </AriaToggleButton>
        <AriaButton
          className="fill-layer-row__action fill-layer-row__delete"
          onPress={handleRemove}
          isDisabled={isVirtual}
          aria-label={localize("Remove fill")}
        >
          <DeleteIcon
            size={iconProps.size}
            strokeWidth={iconProps.strokeWidth}
            color={iconProps.color}
          />
        </AriaButton>
      </div>
    </div>
  );
});

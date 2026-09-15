/**
 * FillDetailPopover - Fill 상세 편집 Popover 내용
 *
 * 설계문서 Pencil 앱 스타일:
 * ┌──────────────────────────────┐
 * │  [Color] [Gradient] [Image]  │  ← 대분류 탭 (FillTypeSelector)
 * ├──────────────────────────────┤
 * │  Color 탭: ColorPickerPanel  │
 * │  Gradient 탭: GradientEditor │  ← 내부에 [Linear][Radial][Angular]
 * │  Image 탭: (Phase 3)        │
 * └──────────────────────────────┘
 *
 * @since 2026-02-10 Color Picker Phase 1
 * @updated 2026-02-10 Phase 2 - 3탭 구조 재설계
 */

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type {
  FillItem,
  ColorFillItem,
  ImageFillItem,
  MeshGradientFillItem,
  BlendMode,
} from "../../../../types/builder/fill.types";
import { FillType } from "../../../../types/builder/fill.types";
import { normalizeToHex8 } from "../utils/colorUtils";
import { FillTypeSelector, type FillCategory } from "./FillTypeSelector";
import { ColorPickerPanel } from "./ColorPickerPanel";
import { GradientEditor } from "./GradientEditor";
import { MeshGradientEditor } from "./MeshGradientEditor";
import { ImageFillEditor } from "./ImageFillEditor";
import { PropertySelect } from "../../../components";
import { BLEND_MODE_OPTIONS } from "../constants/styleOptions";
import "./FillDetailPopover.css";

interface FillDetailPopoverProps {
  fill: FillItem;
  presentationOwnsColorFrameScheduling?: boolean;
  onColorPresentationCancel?: (reason: "pointer-cancel" | "escape") => void;
  onColorChange: (color: string) => void;
  onColorChangeEnd: (color: string) => void;
  /** 레이어 불투명도 — 팝오버 안에는 컨트롤이 없다 (레이어 행 scrub 하나뿐, 2026-09-15). 행이 쓴다. */
  onOpacityChange: (opacity: number) => void;
  onOpacityChangeEnd: (opacity: number) => void;
  onUpdate: (updates: Partial<FillItem>) => void;
  onUpdateEnd: (updates: Partial<FillItem>) => void;
  onTypeChange: (newType: FillType) => void;
}

/** FillType → FillCategory 매핑 */
function fillTypeToCategory(type: FillType): FillCategory {
  switch (type) {
    case FillType.Color:
      return "color";
    case FillType.LinearGradient:
    case FillType.RadialGradient:
    case FillType.AngularGradient:
      return "gradient";
    case FillType.Image:
      return "image";
    case FillType.MeshGradient:
      return "gradient";
    default:
      return "color";
  }
}

/** FillCategory → 기본 FillType 매핑 */
function categoryToDefaultFillType(category: FillCategory): FillType {
  switch (category) {
    case "color":
      return FillType.Color;
    case "gradient":
      return FillType.LinearGradient;
    case "image":
      return FillType.Image;
  }
}

export const FillDetailPopover = memo(function FillDetailPopover({
  fill,
  presentationOwnsColorFrameScheduling,
  onColorPresentationCancel,
  onColorChange,
  onColorChangeEnd,
  onUpdate,
  onUpdateEnd,
  onTypeChange,
}: FillDetailPopoverProps) {
  const currentCategory = useMemo(
    () => fillTypeToCategory(fill.type),
    [fill.type],
  );
  const isColor = fill.type === FillType.Color;
  const isMeshGradient = fill.type === FillType.MeshGradient;
  const isGradient = currentCategory === "gradient" && !isMeshGradient;
  const isImage = fill.type === FillType.Image;

  const rawColorValue = isColor ? (fill as ColorFillItem).color : "#000000FF";
  const isVariableBound = rawColorValue.startsWith("$--");
  const colorValue = isVariableBound
    ? "#000000FF"
    : normalizeToHex8(rawColorValue);
  const [committedColorValue, setCommittedColorValue] = useState(colorValue);

  useEffect(() => {
    setCommittedColorValue(colorValue);
  }, [colorValue, fill.id, fill.type]);

  // 대분류 탭 변경 (Color ↔ Gradient ↔ Image)
  const handleCategoryChange = useCallback(
    (category: FillCategory) => {
      const currentCat = fillTypeToCategory(fill.type);
      if (category === currentCat) return;

      // Gradient 내부 하위 타입은 유지하고 대분류만 변경
      const newType = categoryToDefaultFillType(category);
      onTypeChange(newType);
    },
    [fill.type, onTypeChange],
  );

  // Gradient 하위 타입 변경 (Linear ↔ Radial ↔ Angular)
  const handleGradientSubTypeChange = useCallback(
    (subType: FillType) => {
      onTypeChange(subType);
    },
    [onTypeChange],
  );

  const handleColorChangeEndCommitted = useCallback(
    (color: string) => {
      setCommittedColorValue(color);
      onColorChangeEnd(color);
    },
    [onColorChangeEnd],
  );

  // BlendMode 변경
  const handleBlendModeChange = useCallback(
    (mode: BlendMode) => {
      onUpdateEnd({ blendMode: mode } as Partial<FillItem>);
    },
    [onUpdateEnd],
  );

  return (
    <div className="fill-detail-popover section">
      <FillTypeSelector
        value={currentCategory}
        onChange={handleCategoryChange}
      />
      {isColor && (
        <ColorPickerPanel
          value={committedColorValue}
          resetKey={`${fill.id}:${fill.type}`}
          presentationOwnsFrameScheduling={presentationOwnsColorFrameScheduling}
          onPresentationCancel={onColorPresentationCancel}
          onChange={onColorChange}
          onChangeEnd={handleColorChangeEndCommitted}
        />
      )}
      {isGradient && (
        <GradientEditor
          fill={fill as Parameters<typeof GradientEditor>[0]["fill"]}
          presentationOwnsFrameScheduling={presentationOwnsColorFrameScheduling}
          onChange={onUpdate}
          onChangeEnd={onUpdateEnd}
          onSubTypeChange={handleGradientSubTypeChange}
        />
      )}
      {isMeshGradient && (
        <MeshGradientEditor
          fill={fill as MeshGradientFillItem}
          onChange={onUpdate}
          onChangeEnd={onUpdateEnd}
          onSubTypeChange={handleGradientSubTypeChange}
        />
      )}
      {isImage && (
        <ImageFillEditor
          fill={fill as ImageFillItem}
          onUpdate={onUpdate}
          onUpdateEnd={onUpdateEnd}
        />
      )}

      <div className="fill-detail-popover__divider" />
      {/* 푸터 — Blend 하나. 레이어 Opacity 는 레이어 행의 scrub 이 유일한 컨트롤이라 팝오버에서
          뺐다 (같은 값이 두 곳 — 2026-09-15 사용자 판정). 피커의 A 는 색 자체의 알파 (다른 축:
          fillAdapter 가 alpha × opacity 로 합성, 그래디언트는 stop 마다). */}
      <div className="fill-detail-popover__footer">
        {/* 아이콘 prefix 없음 — legend 가 이름을 준다 (panel-ui 17 — 대조 B13) */}
        <PropertySelect
          label="Blend"
          className="blend-mode"
          value={fill.blendMode}
          options={BLEND_MODE_OPTIONS}
          onChange={(value) => handleBlendModeChange(value as BlendMode)}
        />
      </div>
    </div>
  );
});

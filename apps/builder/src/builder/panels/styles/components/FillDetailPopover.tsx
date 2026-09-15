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

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/** 0~1 → "FF" 두 자리 */
function opacityToAlphaHex(opacity: number): string {
  const n = Math.round(Math.min(1, Math.max(0, opacity)) * 255);
  return n.toString(16).padStart(2, "0").toUpperCase();
}

/** "FF" 두 자리 → 0~1 (잘못된 값은 1) */
function alphaHexToOpacity(alphaHex: string): number {
  const n = parseInt(alphaHex, 16);
  return Number.isFinite(n) ? n / 255 : 1;
}

interface FillDetailPopoverProps {
  fill: FillItem;
  presentationOwnsColorFrameScheduling?: boolean;
  onColorPresentationCancel?: (reason: "pointer-cancel" | "escape") => void;
  onColorChange: (color: string) => void;
  onColorChangeEnd: (color: string) => void;
  /** 레이어 불투명도 — 단색 fill 은 피커의 알파 슬라이더 · A 가 이 값을 쓴다 (레이어 행 scrub 과 한 숫자) */
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
  onOpacityChange,
  onOpacityChangeEnd,
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
  // 단색 fill 의 불투명도는 한 숫자 — 피커의 알파 슬라이더 · A 와 레이어 행의 「%」 scrub 이 같은
  //   fill.opacity 를 읽고 쓴다 (Figma 어법, 2026-09-15 사용자 판정 — 종전엔 색 알파 × 레이어
  //   opacity 두 축이 fill 행 · 팝오버 · Effect 세 곳의 opacity 로 보였다). 색은 불투명 (…FF) 저장.
  const colorRgbFF = isVariableBound
    ? "#000000FF"
    : `${normalizeToHex8(rawColorValue).slice(0, 7)}FF`;
  const colorValue = `${colorRgbFF.slice(0, 7)}${opacityToAlphaHex(fill.opacity)}`;
  const [committedColorValue, setCommittedColorValue] = useState(colorValue);

  useEffect(() => {
    setCommittedColorValue(colorValue);
  }, [colorValue, fill.id, fill.type]);

  // 종전 문서의 색 알파 (…80 등) 는 레이어 opacity 로 접는다 (알파 × opacity → opacity, 색 …FF) —
  //   렌더는 fillAdapter 가 둘을 곱해 왔으므로 화면은 그대로. fill 마다 한 번.
  const foldedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isColor || isVariableBound || foldedRef.current === fill.id) return;
    const alpha = alphaHexToOpacity(normalizeToHex8(rawColorValue).slice(7, 9));
    if (alpha >= 1) return;
    foldedRef.current = fill.id;
    onUpdateEnd({
      color: colorRgbFF,
      opacity: Math.round(fill.opacity * alpha * 1000) / 1000,
    } as Partial<FillItem>);
  }, [colorRgbFF, fill.id, fill.opacity, isColor, isVariableBound, onUpdateEnd, rawColorValue]);

  // 피커 값 (hex8) → 색 (rgb) 과 opacity (alpha) 로 갈라 각자의 경로로 (presentation 경로가
  //   color / opacity 로 나뉘어 있다 — useFillActions)
  const splitPicked = useCallback(
    (color: string) => {
      const hex8 = normalizeToHex8(color);
      const rgbFF = `${hex8.slice(0, 7)}FF`;
      const alpha = alphaHexToOpacity(hex8.slice(7, 9));
      return {
        rgbFF,
        alpha,
        rgbChanged: rgbFF.toUpperCase() !== colorRgbFF.toUpperCase(),
        alphaChanged: Math.abs(alpha - fill.opacity) > 1 / 510,
      };
    },
    [colorRgbFF, fill.opacity],
  );
  const handlePickerChange = useCallback(
    (color: string) => {
      const { rgbFF, alpha, rgbChanged, alphaChanged } = splitPicked(color);
      if (rgbChanged) onColorChange(rgbFF);
      if (alphaChanged) onOpacityChange(alpha);
    },
    [onColorChange, onOpacityChange, splitPicked],
  );

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
      setCommittedColorValue(normalizeToHex8(color));
      const { rgbFF, alpha, rgbChanged, alphaChanged } = splitPicked(color);
      if (rgbChanged) onColorChangeEnd(rgbFF);
      if (alphaChanged) onOpacityChangeEnd(alpha);
    },
    [onColorChangeEnd, onOpacityChangeEnd, splitPicked],
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
          onChange={handlePickerChange}
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
      {/* 푸터 — Blend 하나. 레이어 Opacity 는 레이어 행의 scrub 과 피커 알파가 같은 숫자라 별도
          행이 없다 (2026-09-15 사용자 판정). 그래디언트는 stop 마다 알파 (다른 축). */}
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

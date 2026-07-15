/**
 * GradientControls - 그래디언트 타입별 속성 편집 컨트롤
 *
 * 모든 수치 입력은 패널 표준 PropertyUnitInput (Padding/blend 계열, fieldset+
 * legend+아이콘+단위 dropdown) 사용 — deg(rotation) / %(center·radius).
 * - Linear: Rotation (0~360)
 * - Radial: Center X/Y, Radius width/height (%)
 * - Angular: Center X/Y (%), Rotation
 *
 * @since 2026-02-10 Gradient Phase 2
 * @updated 2026-07-16 ScrubInput → PropertyUnitInput 통일 (패널 표준 컴포넌트)
 */

import { memo, useCallback } from "react";
import type {
  FillItem,
  LinearGradientFillItem,
  RadialGradientFillItem,
  AngularGradientFillItem,
} from "../../../../types/builder/fill.types";
import { FillType } from "../../../../types/builder/fill.types";
import { RotateCw, MoveHorizontal, MoveVertical } from "lucide-react";
import { PropertyUnitInput } from "../../../components";

import "./GradientControls.css";

interface GradientControlsProps {
  fill:
    | LinearGradientFillItem
    | RadialGradientFillItem
    | AngularGradientFillItem;
  onChange: (updates: Partial<FillItem>) => void;
}

const LinearControls = memo(function LinearControls({
  fill,
  onChange,
}: {
  fill: LinearGradientFillItem;
  onChange: (updates: Partial<FillItem>) => void;
}) {
  const handleRotation = useCallback(
    (value: string) => {
      const num = parseFloat(value);
      if (!Number.isNaN(num)) {
        onChange({ rotation: num } as Partial<LinearGradientFillItem>);
      }
    },
    [onChange],
  );

  return (
    <PropertyUnitInput
      icon={RotateCw}
      label="Rotation"
      className="gradient-rotation"
      value={`${Math.round(fill.rotation)}deg`}
      units={["deg"]}
      defaultUnit="deg"
      allowKeywords={false}
      onChange={handleRotation}
      min={0}
      max={360}
    />
  );
});

const RadialControls = memo(function RadialControls({
  fill,
  onChange,
}: {
  fill: RadialGradientFillItem;
  onChange: (updates: Partial<FillItem>) => void;
}) {
  const handleCenterX = useCallback(
    (value: string) => {
      const num = parseFloat(value);
      if (!Number.isNaN(num)) {
        onChange({
          center: { ...fill.center, x: num / 100 },
        } as Partial<RadialGradientFillItem>);
      }
    },
    [fill.center, onChange],
  );

  const handleCenterY = useCallback(
    (value: string) => {
      const num = parseFloat(value);
      if (!Number.isNaN(num)) {
        onChange({
          center: { ...fill.center, y: num / 100 },
        } as Partial<RadialGradientFillItem>);
      }
    },
    [fill.center, onChange],
  );

  const handleRadiusW = useCallback(
    (value: string) => {
      const num = parseFloat(value);
      if (!Number.isNaN(num)) {
        onChange({
          radius: { ...fill.radius, width: num / 100 },
        } as Partial<RadialGradientFillItem>);
      }
    },
    [fill.radius, onChange],
  );

  const handleRadiusH = useCallback(
    (value: string) => {
      const num = parseFloat(value);
      if (!Number.isNaN(num)) {
        onChange({
          radius: { ...fill.radius, height: num / 100 },
        } as Partial<RadialGradientFillItem>);
      }
    },
    [fill.radius, onChange],
  );

  return (
    <>
      <PropertyUnitInput
        icon={MoveHorizontal}
        label="Center X"
        className="gradient-center-x"
        value={`${Math.round(fill.center.x * 100)}%`}
        units={["%"]}
        defaultUnit="%"
        allowKeywords={false}
        onChange={handleCenterX}
        min={0}
        max={100}
      />
      <PropertyUnitInput
        icon={MoveVertical}
        label="Center Y"
        className="gradient-center-y"
        value={`${Math.round(fill.center.y * 100)}%`}
        units={["%"]}
        defaultUnit="%"
        allowKeywords={false}
        onChange={handleCenterY}
        min={0}
        max={100}
      />
      <PropertyUnitInput
        icon={MoveHorizontal}
        label="Radius Width"
        className="gradient-radius-w"
        value={`${Math.round(fill.radius.width * 100)}%`}
        units={["%"]}
        defaultUnit="%"
        allowKeywords={false}
        onChange={handleRadiusW}
        min={0}
        max={100}
      />
      <PropertyUnitInput
        icon={MoveVertical}
        label="Radius Height"
        className="gradient-radius-h"
        value={`${Math.round(fill.radius.height * 100)}%`}
        units={["%"]}
        defaultUnit="%"
        allowKeywords={false}
        onChange={handleRadiusH}
        min={0}
        max={100}
      />
    </>
  );
});

const AngularControls = memo(function AngularControls({
  fill,
  onChange,
}: {
  fill: AngularGradientFillItem;
  onChange: (updates: Partial<FillItem>) => void;
}) {
  const handleCenterX = useCallback(
    (value: string) => {
      const num = parseFloat(value);
      if (!Number.isNaN(num)) {
        onChange({
          center: { ...fill.center, x: num / 100 },
        } as Partial<AngularGradientFillItem>);
      }
    },
    [fill.center, onChange],
  );

  const handleCenterY = useCallback(
    (value: string) => {
      const num = parseFloat(value);
      if (!Number.isNaN(num)) {
        onChange({
          center: { ...fill.center, y: num / 100 },
        } as Partial<AngularGradientFillItem>);
      }
    },
    [fill.center, onChange],
  );

  const handleRotation = useCallback(
    (value: string) => {
      const num = parseFloat(value);
      if (!Number.isNaN(num)) {
        onChange({ rotation: num } as Partial<AngularGradientFillItem>);
      }
    },
    [onChange],
  );

  return (
    <>
      <PropertyUnitInput
        icon={MoveHorizontal}
        label="Center X"
        className="gradient-center-x"
        value={`${Math.round(fill.center.x * 100)}%`}
        units={["%"]}
        defaultUnit="%"
        allowKeywords={false}
        onChange={handleCenterX}
        min={0}
        max={100}
      />
      <PropertyUnitInput
        icon={MoveVertical}
        label="Center Y"
        className="gradient-center-y"
        value={`${Math.round(fill.center.y * 100)}%`}
        units={["%"]}
        defaultUnit="%"
        allowKeywords={false}
        onChange={handleCenterY}
        min={0}
        max={100}
      />
      <PropertyUnitInput
        icon={RotateCw}
        label="Rotation"
        className="gradient-rotation"
        value={`${Math.round(fill.rotation)}deg`}
        units={["deg"]}
        defaultUnit="deg"
        allowKeywords={false}
        onChange={handleRotation}
        min={0}
        max={360}
      />
    </>
  );
});

export const GradientControls = memo(function GradientControls({
  fill,
  onChange,
}: GradientControlsProps) {
  return (
    <div className="gradient-controls">
      {fill.type === FillType.LinearGradient && (
        <LinearControls
          fill={fill as LinearGradientFillItem}
          onChange={onChange}
        />
      )}
      {fill.type === FillType.RadialGradient && (
        <RadialControls
          fill={fill as RadialGradientFillItem}
          onChange={onChange}
        />
      )}
      {fill.type === FillType.AngularGradient && (
        <AngularControls
          fill={fill as AngularGradientFillItem}
          onChange={onChange}
        />
      )}
    </div>
  );
});

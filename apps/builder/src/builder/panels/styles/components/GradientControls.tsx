/**
 * GradientControls - 그래디언트 타입별 속성 편집 컨트롤
 *
 * Gradient Phase 2 + Phase 3 ScrubInput 적용
 * - Linear: Rotation (0~360)
 * - Radial: Center X/Y, Radius width/height
 * - Angular: Center X/Y, Rotation
 *
 * @since 2026-02-10 Gradient Phase 2
 * @updated 2026-02-11 Phase 3 — ScrubInput 적용
 */

import { memo, useCallback } from "react";
import type {
  FillItem,
  LinearGradientFillItem,
  RadialGradientFillItem,
  AngularGradientFillItem,
} from "../../../../types/builder/fill.types";
import { FillType } from "../../../../types/builder/fill.types";
import { RotateCw } from "lucide-react";
import { ScrubInput } from "./ScrubInput";
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
    (value: number) => {
      onChange({
        center: { ...fill.center, x: value / 100 },
      } as Partial<RadialGradientFillItem>);
    },
    [fill.center, onChange],
  );

  const handleCenterY = useCallback(
    (value: number) => {
      onChange({
        center: { ...fill.center, y: value / 100 },
      } as Partial<RadialGradientFillItem>);
    },
    [fill.center, onChange],
  );

  const handleRadiusW = useCallback(
    (value: number) => {
      onChange({
        radius: { ...fill.radius, width: value / 100 },
      } as Partial<RadialGradientFillItem>);
    },
    [fill.radius, onChange],
  );

  const handleRadiusH = useCallback(
    (value: number) => {
      onChange({
        radius: { ...fill.radius, height: value / 100 },
      } as Partial<RadialGradientFillItem>);
    },
    [fill.radius, onChange],
  );

  return (
    <>
      <span className="gradient-controls__label">Center</span>
      <div className="gradient-controls__row">
        <ScrubInput
          value={Math.round(fill.center.x * 100)}
          onCommit={handleCenterX}
          min={0}
          max={100}
          suffix="%"
          label="Center X"
          className="gradient-controls__scrub"
        />
        <ScrubInput
          value={Math.round(fill.center.y * 100)}
          onCommit={handleCenterY}
          min={0}
          max={100}
          suffix="%"
          label="Center Y"
          className="gradient-controls__scrub"
        />
      </div>
      <span className="gradient-controls__label">Radius</span>
      <div className="gradient-controls__row">
        <ScrubInput
          value={Math.round(fill.radius.width * 100)}
          onCommit={handleRadiusW}
          min={0}
          max={100}
          suffix="%"
          label="Radius width"
          className="gradient-controls__scrub"
        />
        <ScrubInput
          value={Math.round(fill.radius.height * 100)}
          onCommit={handleRadiusH}
          min={0}
          max={100}
          suffix="%"
          label="Radius height"
          className="gradient-controls__scrub"
        />
      </div>
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
    (value: number) => {
      onChange({
        center: { ...fill.center, x: value / 100 },
      } as Partial<AngularGradientFillItem>);
    },
    [fill.center, onChange],
  );

  const handleCenterY = useCallback(
    (value: number) => {
      onChange({
        center: { ...fill.center, y: value / 100 },
      } as Partial<AngularGradientFillItem>);
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
      <span className="gradient-controls__label">Center</span>
      <div className="gradient-controls__row">
        <ScrubInput
          value={Math.round(fill.center.x * 100)}
          onCommit={handleCenterX}
          min={0}
          max={100}
          suffix="%"
          label="Center X"
          className="gradient-controls__scrub"
        />
        <ScrubInput
          value={Math.round(fill.center.y * 100)}
          onCommit={handleCenterY}
          min={0}
          max={100}
          suffix="%"
          label="Center Y"
          className="gradient-controls__scrub"
        />
      </div>
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

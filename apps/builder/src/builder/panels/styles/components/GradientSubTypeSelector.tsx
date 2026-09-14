/**
 * GradientSubTypeSelector — Gradient 하위형 seg [Linear | Radial | Angular | Mesh]
 *
 * FillTypeSelector (Type 행) 와 같은 어법의 ToggleButtonGroup 한 줄 (28). 종전에는
 * GradientEditor · MeshGradientEditor 가 각자 shared Select (항목 26 · 메뉴 한 단계) 를
 * 들고 있었다 — 하위형은 4개뿐이라 seg 가 한눈에 들어오고 클릭 한 번이다
 * (panel-ui 17, 2026-09-14).
 */

import { memo, useCallback } from "react";
import {
  ToggleButtonGroup,
  ToggleButton,
} from "@composition/shared/components";
import type { Selection } from "react-aria-components/ListBox";
import { FillType } from "../../../../types/builder/fill.types";

export type GradientSubType =
  | FillType.LinearGradient
  | FillType.RadialGradient
  | FillType.AngularGradient
  | FillType.MeshGradient;

const GRADIENT_SUB_TYPE_OPTIONS: ReadonlyArray<{
  readonly id: GradientSubType;
  readonly name: string;
}> = [
  { id: FillType.LinearGradient, name: "Linear" },
  { id: FillType.RadialGradient, name: "Radial" },
  { id: FillType.AngularGradient, name: "Angular" },
  { id: FillType.MeshGradient, name: "Mesh" },
];

interface GradientSubTypeSelectorProps {
  readonly value: GradientSubType;
  readonly onChange: (subType: GradientSubType) => void;
}

export const GradientSubTypeSelector = memo(function GradientSubTypeSelector({
  value,
  onChange,
}: GradientSubTypeSelectorProps) {
  const handleSelectionChange = useCallback(
    (keys: Selection) => {
      if (keys === "all") return;
      const selected = Array.from(keys)[0] as GradientSubType | undefined;
      if (selected && selected !== value) onChange(selected);
    },
    [onChange, value],
  );

  return (
    <div className="gradient-sub-type-selector">
      <ToggleButtonGroup
        aria-label="Gradient type"
        disallowEmptySelection
        indicator
        selectedKeys={[value]}
        onSelectionChange={handleSelectionChange}
      >
        {GRADIENT_SUB_TYPE_OPTIONS.map((option) => (
          <ToggleButton key={option.id} id={option.id}>
            {option.name}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
});

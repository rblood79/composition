/**
 * FillTypeSelector - Fill 대분류 탭 선택기
 *
 * 설계문서 기준: [Color] [Gradient] [Image] 3탭 구조
 * 공유 ToggleButtonGroup (React-Aria) 기반으로 UI 일관성 확보
 *
 * @since 2026-02-10 Color Picker Phase 1
 * @updated 2026-02-11 ToggleButtonGroup 전환
 * @updated 2026-08-14 fieldset.properties-aria + legend 구조로 정합 (ADR-163
 *   패널 표준 — footer 의 Blend(PropertySelect) 와 동일 어법, 사용자 지적)
 */

import { memo, useCallback } from "react";
import {
  ToggleButtonGroup,
  ToggleButton,
} from "@composition/shared/components";
import { Circle, Blend, Image } from "lucide-react";
import type { Selection } from "react-aria-components";
import { iconProps } from "../../../../utils/ui/uiConstants";

/** 대분류 Fill 카테고리 */
export type FillCategory = "color" | "gradient" | "image";

interface FillTypeSelectorProps {
  value: FillCategory;
  onChange: (category: FillCategory) => void;
}

export const FillTypeSelector = memo(function FillTypeSelector({
  value,
  onChange,
}: FillTypeSelectorProps) {
  const handleSelectionChange = useCallback(
    (keys: Selection) => {
      if (keys === "all") return;
      const selected = Array.from(keys)[0] as FillCategory | undefined;
      if (selected) onChange(selected);
    },
    [onChange],
  );

  return (
    <fieldset className="properties-aria fill-type-selector">
      <legend className="fieldset-legend">Type</legend>
      <ToggleButtonGroup
        aria-label="Fill type"
        disallowEmptySelection
        indicator
        selectedKeys={[value]}
        onSelectionChange={handleSelectionChange}
      >
        <ToggleButton id="color" aria-label="Color">
          <Circle
            color={iconProps.color}
            size={iconProps.size}
            strokeWidth={iconProps.strokeWidth}
          />
        </ToggleButton>
        <ToggleButton id="gradient" aria-label="Gradient">
          <Blend
            color={iconProps.color}
            size={iconProps.size}
            strokeWidth={iconProps.strokeWidth}
          />
        </ToggleButton>
        <ToggleButton id="image" aria-label="Image">
          <Image
            color={iconProps.color}
            size={iconProps.size}
            strokeWidth={iconProps.strokeWidth}
          />
        </ToggleButton>
      </ToggleButtonGroup>
    </fieldset>
  );
});

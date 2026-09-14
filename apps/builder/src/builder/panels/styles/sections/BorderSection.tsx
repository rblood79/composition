/**
 * BorderSection — Style 탭 Border 절 (Color · Width · Radius · Style)
 *
 * 종전 Appearance 절 (Background + Border + Opacity + Shadow 한 절) 을 Fill · Border ·
 * Effect 셋으로 나눴다 (panel-ui 02, 2026-09-14). 접힌 섹션의 훅 실행을 방지하기 위해
 * 내용 컴포넌트 분리.
 *
 * 코너별 반경 · 변별 두께는 Skia 채널이 없어 (buildBoxNodeData rrect 하나 · convertToStrokeStyle
 * stroke 하나) ADR "Border 기하 채널" 이 먼저다 — 여기서 열지 않는다.
 */

import { memo } from "react";
import {
  PropertySection,
  PropertyUnitInput,
  PropertyColor,
  PropertySelect,
} from "../../../components";
import {
  BORDER_RADIUS_PRESET_OPTIONS,
  BORDER_WIDTH_PRESET_OPTIONS,
} from "../../../components/property/propertyUnitPresets";
import {
  SquareDashed,
  SquareRoundCorner,
  SquareDashedBottom,
} from "lucide-react";
import { BORDER_PROPS } from "./styleSectionProps";
import { useStyleActions } from "../hooks/useStyleActions";
import { useOptimizedStyleActions } from "../hooks/useOptimizedStyleActions";
import { useStylePresentationActions } from "../hooks/useStylePresentationActions";
import { useAppearanceValues } from "../hooks/useAppearanceValues";
import { useResetStyles, useHasDirtyStyles } from "../hooks/useResetStyles";
import { useStore } from "../../../stores";

const BorderSectionContent = memo(function BorderSectionContent() {
  const { updateStyle } = useStyleActions();
  const { updateStyleImmediate, updateStylePreview } =
    useOptimizedStyleActions();
  const {
    cancelBorderColorPresentation,
    commitBorderColorPresentation,
    isBorderColorPresentationOwned,
    previewBorderColorPresentation,
  } = useStylePresentationActions();
  const selectedId = useStore((s) => s.selectedElementId);
  const styleValues = useAppearanceValues(selectedId);

  if (!styleValues) return null;

  const presentationOwnsBorderColor = isBorderColorPresentationOwned();

  const handleBorderColorPreview = (value: string): void => {
    if (presentationOwnsBorderColor && previewBorderColorPresentation(value)) {
      return;
    }
    updateStylePreview("borderColor", value);
  };

  const handleBorderColorCommit = (value: string): void => {
    if (presentationOwnsBorderColor && commitBorderColorPresentation(value)) {
      return;
    }
    updateStyle("borderColor", value);
  };

  return (
    <div className="style-border">
      <PropertyColor
        label="Color"
        className="border-color"
        value={styleValues.borderColor}
        onChange={handleBorderColorCommit}
        onPreview={handleBorderColorPreview}
        presentationOwnsFrameScheduling={presentationOwnsBorderColor}
        onPresentationCancel={cancelBorderColorPresentation}
        placeholder="#000000"
      />
      <PropertyUnitInput
        icon={SquareDashed}
        label="Border Width"
        className="border-width"
        value={styleValues.borderWidth}
        units={[]}
        allowKeywords={false}
        presets={BORDER_WIDTH_PRESET_OPTIONS}
        presetAriaLabel="Border Width Preset"
        onChange={(value) => updateStyleImmediate("borderWidth", value)}
        onDrag={(value) => updateStylePreview("borderWidth", value)}
        min={0}
        max={100}
      />
      <PropertyUnitInput
        icon={SquareRoundCorner}
        label="Border Radius"
        className="border-radius"
        value={styleValues.borderRadius}
        units={[]}
        allowKeywords={false}
        presets={BORDER_RADIUS_PRESET_OPTIONS}
        presetAriaLabel="Border Radius Preset"
        onChange={(value) => updateStyleImmediate("borderRadius", value)}
        onDrag={(value) => updateStylePreview("borderRadius", value)}
        min={0}
        max={500}
      />
      <PropertySelect
        icon={SquareDashedBottom}
        label="Border Style"
        className="border-style"
        value={styleValues.borderStyle}
        options={[
          { value: "reset", label: "Reset" },
          { value: "none", label: "none" },
          { value: "solid", label: "solid" },
          { value: "dashed", label: "dashed" },
          { value: "dotted", label: "dotted" },
          { value: "double", label: "double" },
          { value: "groove", label: "groove" },
          { value: "ridge", label: "ridge" },
          { value: "inset", label: "inset" },
          { value: "outset", label: "outset" },
        ]}
        onChange={(value) => updateStyle("borderStyle", value)}
      />
    </div>
  );
});

/**
 * BorderSection - 외부 래퍼 (PropertySection 관리)
 */
export const BorderSection = memo(function BorderSection() {
  const resetStyles = useResetStyles();
  const hasDirty = useHasDirtyStyles(BORDER_PROPS);

  return (
    <PropertySection
      id="border"
      title="Border"
      onReset={hasDirty ? () => resetStyles(BORDER_PROPS) : undefined}
    >
      <BorderSectionContent />
    </PropertySection>
  );
});

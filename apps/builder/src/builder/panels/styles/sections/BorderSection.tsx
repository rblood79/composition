/**
 * BorderSection — Style 탭 Border 절
 *
 *   「Width  ──●──── 1 px」  [프리셋 ⋮]
 *   「Radius ──●──── 8 px」  [프리셋 ⋮]
 *   Style  [× — - - ···]     Color [■ 000000]
 *
 * 종전 Appearance 절 (Background + Border + Opacity + Shadow 한 절) 을 Fill · Border ·
 * Effect 셋으로 나눴다 (panel-ui 02, 2026-09-14). Width · Radius 는 슬라이더 행 — 0~24 범위는
 * 드래그가 타이핑보다 빠르고, 값 칸을 클릭하면 직접 입력. 토큰 프리셋 (XS~XL) 은 28 열 메뉴.
 * Style 은 셀렉트 10항목 → seg 4 (none · solid · dashed · dotted) — double/groove/ridge/
 * inset/outset 은 저장값이 있으면 렌더는 그대로 (Skia 8종) 되지만 seg 에 선택이 없다.
 *
 * 코너별 반경 · 변별 두께는 Skia 채널이 없어 (buildBoxNodeData rrect 하나 · convertToStrokeStyle
 * stroke 하나) ADR "Border 기하 채널" 이 먼저다 — 여기서 열지 않는다.
 * 접힌 섹션의 훅 실행을 방지하기 위해 내용 컴포넌트 분리.
 */

import { memo } from "react";
import { Ellipsis, Minus, X } from "lucide-react";
import {
  ToggleButtonGroup,
  ToggleButton,
} from "@composition/shared/components";
import {
  PropertySection,
  PropertyColor,
  PropertyRowMenu,
  PropertySlider,
} from "../../../components";
import {
  BORDER_RADIUS_PRESET_OPTIONS,
  BORDER_WIDTH_PRESET_OPTIONS,
  type PropertyUnitPreset,
} from "../../../components/property/propertyUnitPresets";
import { LineDashed } from "../../../components/icons";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { BORDER_PROPS } from "./styleSectionProps";
import { useStyleActions } from "../hooks/useStyleActions";
import { useOptimizedStyleActions } from "../hooks/useOptimizedStyleActions";
import { useStylePresentationActions } from "../hooks/useStylePresentationActions";
import { useAppearanceValues } from "../hooks/useAppearanceValues";
import { useResetStyles, useHasDirtyStyles } from "../hooks/useResetStyles";
import { useStore } from "../../../stores";
import { resolveCssLengthPx } from "../utils/cssLengthPx";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../../i18n";

/** 슬라이더 범위 — 값 칸 직접 입력은 이 위로도 간다 (썸은 끝에 머문다). */
const WIDTH_SLIDER_MAX = 24;
const RADIUS_SLIDER_MAX = 64;
const INPUT_MAX = 9999;

const BORDER_STYLE_OPTIONS = [
  { id: "none", label: "No border", icon: X },
  { id: "solid", label: "Solid", icon: Minus },
  { id: "dashed", label: "Dashed", icon: LineDashed },
  { id: "dotted", label: "Dotted", icon: Ellipsis },
] as const;

/** 프리셋 (XS~XL, Reset) → 행 메뉴 항목. value "" (Reset) 은 inline 키 삭제. */
function toPresetMenuItems(presets: readonly PropertyUnitPreset[]) {
  return presets.map((preset) => ({
    id: preset.id,
    label:
      preset.id === "reset"
        ? preset.label
        : `${preset.label} · ${resolveCssLengthPx(preset.value) ?? preset.value}`,
  }));
}

const BorderSectionContent = memo(function BorderSectionContent() {
  const i18n = useOptionalI18n();
  const localize = (label: string) =>
    i18n
      ? translateKey(i18n.t, semanticLabelKeys[label] ?? label, label)
      : label;
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

  const widthPx = resolveCssLengthPx(styleValues.borderWidth) ?? 0;
  const radiusPx = resolveCssLengthPx(styleValues.borderRadius) ?? 0;

  const applyPreset = (
    prop: "borderWidth" | "borderRadius",
    presets: readonly PropertyUnitPreset[],
    id: string,
  ): void => {
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    updateStyleImmediate(prop, preset.value);
  };

  return (
    <>
      <div className="style-border-width">
        <PropertySlider
          label="Width"
          className="border-width"
          labelMode="inline"
          editable
          unit="px"
          value={widthPx}
          min={0}
          max={WIDTH_SLIDER_MAX}
          inputMax={INPUT_MAX}
          step={1}
          onChange={(px) => updateStylePreview("borderWidth", `${px}px`)}
          onChangeEnd={(px) => updateStyleImmediate("borderWidth", `${px}px`)}
        />
        <div className="fieldset-actions actions-icon">
          <PropertyRowMenu
            label={localize("Border width presets")}
            items={toPresetMenuItems(BORDER_WIDTH_PRESET_OPTIONS)}
            onAction={(id) =>
              applyPreset("borderWidth", BORDER_WIDTH_PRESET_OPTIONS, id)
            }
          />
        </div>
      </div>

      <div className="style-border-radius">
        <PropertySlider
          label="Radius"
          className="border-radius"
          labelMode="inline"
          editable
          unit="px"
          value={radiusPx}
          min={0}
          max={RADIUS_SLIDER_MAX}
          inputMax={INPUT_MAX}
          step={1}
          onChange={(px) => updateStylePreview("borderRadius", `${px}px`)}
          onChangeEnd={(px) => updateStyleImmediate("borderRadius", `${px}px`)}
        />
        <div className="fieldset-actions actions-icon">
          <PropertyRowMenu
            label={localize("Border radius presets")}
            items={toPresetMenuItems(BORDER_RADIUS_PRESET_OPTIONS)}
            onAction={(id) =>
              applyPreset("borderRadius", BORDER_RADIUS_PRESET_OPTIONS, id)
            }
          />
        </div>
      </div>

      <div className="style-border">
        <fieldset className="properties-aria border-style">
          <legend className="fieldset-legend">{localize("Style")}</legend>
          <ToggleButtonGroup
            aria-label={localize("Border Style")}
            indicator
            selectedKeys={[styleValues.borderStyle]}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as string | undefined;
              // 재클릭 (빈 선택) 은 무시 — 선 스타일은 항상 하나다
              if (value && value !== styleValues.borderStyle) {
                updateStyle("borderStyle", value);
              }
            }}
          >
            {BORDER_STYLE_OPTIONS.map(({ id, label, icon: Icon }) => (
              <ToggleButton key={id} id={id} aria-label={localize(label)}>
                <Icon
                  color={iconProps.color}
                  size={iconProps.size}
                  strokeWidth={iconProps.strokeWidth}
                />
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </fieldset>
        <PropertyColor
          label="Color"
          className="border-color"
          showValue
          value={styleValues.borderColor}
          onChange={handleBorderColorCommit}
          onPreview={handleBorderColorPreview}
          presentationOwnsFrameScheduling={presentationOwnsBorderColor}
          onPresentationCancel={cancelBorderColorPresentation}
          placeholder="#000000"
        />
      </div>
    </>
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

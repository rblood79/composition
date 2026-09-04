/**
 * TypographySection - Typography 스타일 편집 섹션
 *
 * Font, Text styles 편집
 * 접힌 섹션의 훅 실행을 방지하기 위해 내용 컴포넌트 분리.
 */

import { memo, useCallback, useMemo } from "react";
import {
  PropertySection,
  PropertyUnitInput,
  PropertyColor,
  PropertySelect,
} from "../../../components";
import {
  ToggleButton,
  ToggleButtonGroup,
} from "@composition/shared/components";
import { iconProps } from "../../../../utils/ui/uiConstants";
import {
  ALargeSmall,
  AlignCenter,
  AlignHorizontalSpaceAround,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalSpaceAround,
  Baseline,
  Bold,
  CaseLower,
  CaseSensitive,
  CaseUpper,
  Italic,
  RemoveFormatting,
  Strikethrough,
  TextWrap,
  Type,
  Underline,
} from "lucide-react";
import { useStore } from "../../../stores";
import { useStyleActions } from "../hooks/useStyleActions";
import { useOptimizedStyleActions } from "../hooks/useOptimizedStyleActions";
import { useStylePresentationActions } from "../hooks/useStylePresentationActions";
import { useTextMetricsPresentationActions } from "../hooks/useTextMetricsPresentationActions";
import { useTypographyValues } from "../hooks/useTypographyValues";
import { useResetStyles, useHasDirtyStyles } from "../hooks/useResetStyles";
import { getFontWeightOptions } from "../../../fonts/customFonts";
import { FontFamilyPicker } from "../../fonts/FontFamilyPicker";
import { useFontRegistry } from "../../fonts/useFontRegistry";
import { TYPOGRAPHY_PROPS } from "./styleSectionProps";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../../i18n";

const TypographySectionContent = memo(function TypographySectionContent() {
  const i18n = useOptionalI18n();
  const localize = (label: string) =>
    i18n
      ? translateKey(i18n.t, semanticLabelKeys[label] ?? label, label)
      : label;
  const { updateStyle, updateStyles } = useStyleActions();
  const { updateStyleImmediate, updateStylePreview } =
    useOptimizedStyleActions();
  const {
    cancelTextColorPresentation,
    commitTextColorPresentation,
    isTextColorPresentationOwned,
    previewTextColorPresentation,
  } = useStylePresentationActions();
  const {
    commitTextMetricPresentation,
    isTextMetricPresentationOwned,
    previewTextMetricPresentation,
  } = useTextMetricsPresentationActions();
  const selectedId = useStore((s) => s.selectedElementId);
  const styleValues = useTypographyValues(selectedId);
  // 등록된 face 는 Font Weight 옵션 산출에만 쓴다 — 패밀리 목록은 FontFamilyPicker 가 직접 읽는다.
  const { registry } = useFontRegistry();

  // ADR-008: Text Behavior 프리셋 변경 핸들러
  // updateStyles (batch)로 5개 속성을 단일 set()에 적용 → 히스토리 1건 + 레이아웃 1회
  const handleTextBehaviorChange = useCallback(
    (preset: string) => {
      const presets: Record<string, Record<string, string>> = {
        normal: {
          whiteSpace: "",
          wordBreak: "",
          overflowWrap: "",
          textOverflow: "",
          overflow: "",
        },
        nowrap: {
          whiteSpace: "nowrap",
          wordBreak: "",
          overflowWrap: "",
          textOverflow: "",
          overflow: "",
        },
        truncate: {
          whiteSpace: "nowrap",
          wordBreak: "",
          overflowWrap: "",
          textOverflow: "ellipsis",
          overflow: "hidden",
        },
        "break-words": {
          whiteSpace: "",
          wordBreak: "",
          overflowWrap: "break-word",
          textOverflow: "",
          overflow: "",
        },
        "break-all": {
          whiteSpace: "",
          wordBreak: "break-all",
          overflowWrap: "",
          textOverflow: "",
          overflow: "",
        },
        "keep-all": {
          whiteSpace: "",
          wordBreak: "keep-all",
          overflowWrap: "break-word",
          textOverflow: "",
          overflow: "",
        },
        preserve: {
          whiteSpace: "pre-wrap",
          wordBreak: "",
          overflowWrap: "",
          textOverflow: "",
          overflow: "",
        },
      };
      const values = presets[preset];
      if (!values) return; // 'custom' → no-op
      updateStyles(values);
    },
    [updateStyles],
  );

  const fontWeightOptions = useMemo(
    () => getFontWeightOptions(styleValues?.fontFamily || "", registry.faces),
    [styleValues?.fontFamily, registry.faces],
  );

  const presentationOwnsTextColor = isTextColorPresentationOwned();
  const presentationOwnsTextMetric = isTextMetricPresentationOwned("fontSize");

  const handleTextColorPreview = useCallback(
    (value: string): void => {
      if (presentationOwnsTextColor && previewTextColorPresentation(value)) {
        return;
      }
      updateStylePreview("color", value);
    },
    [
      presentationOwnsTextColor,
      previewTextColorPresentation,
      updateStylePreview,
    ],
  );

  const handleTextColorCommit = useCallback(
    (value: string): void => {
      if (presentationOwnsTextColor && commitTextColorPresentation(value)) {
        return;
      }
      updateStyle("color", value);
    },
    [commitTextColorPresentation, presentationOwnsTextColor, updateStyle],
  );

  const handleTextMetricPreview = useCallback(
    (value: string): void => {
      if (
        presentationOwnsTextMetric &&
        previewTextMetricPresentation("fontSize", value)
      ) {
        return;
      }
      updateStylePreview("fontSize", value);
    },
    [
      presentationOwnsTextMetric,
      previewTextMetricPresentation,
      updateStylePreview,
    ],
  );

  const handleTextMetricCommit = useCallback(
    (value: string): void => {
      if (
        presentationOwnsTextMetric &&
        commitTextMetricPresentation("fontSize", value)
      ) {
        return;
      }
      updateStyleImmediate("fontSize", value);
    },
    [
      commitTextMetricPresentation,
      presentationOwnsTextMetric,
      updateStyleImmediate,
    ],
  );

  if (!styleValues) return null;

  return (
    <>
      <FontFamilyPicker
        value={styleValues.fontFamily}
        onChange={(value) => updateStyle("fontFamily", value)}
      />

      <PropertyColor
        label="Color"
        className="color"
        value={styleValues.color}
        onChange={handleTextColorCommit}
        onPreview={handleTextColorPreview}
        presentationOwnsFrameScheduling={presentationOwnsTextColor}
        onPresentationCancel={cancelTextColorPresentation}
        placeholder="#000000"
      />

      <PropertyUnitInput
        icon={ALargeSmall}
        label="Font Size"
        className="font-size"
        value={styleValues.fontSize}
        units={["reset", "px"]}
        defaultUnit="px"
        onChange={handleTextMetricCommit}
        onDrag={handleTextMetricPreview}
        min={8}
        max={200}
      />
      <PropertyUnitInput
        icon={AlignVerticalSpaceAround}
        label="Line Height"
        className="line-height"
        value={styleValues.lineHeight}
        units={["reset", "px"]}
        onChange={(value) => updateStyleImmediate("lineHeight", value)}
        onDrag={(value) => updateStylePreview("lineHeight", value)}
        min={0}
        max={10}
        allowKeywords
      />

      <PropertySelect
        icon={Bold}
        label="Font Weight"
        className="font-weight"
        value={styleValues.fontWeight}
        options={fontWeightOptions}
        onChange={(value) => {
          if (
            isTextMetricPresentationOwned("fontWeight") &&
            commitTextMetricPresentation("fontWeight", value)
          ) {
            return;
          }
          updateStyle("fontWeight", value);
        }}
      />
      <PropertyUnitInput
        icon={AlignHorizontalSpaceAround}
        label="Letter Spacing"
        className="letter-spacing"
        value={styleValues.letterSpacing}
        units={["reset", "px"]}
        onChange={(value) => updateStyleImmediate("letterSpacing", value)}
        onDrag={(value) => updateStylePreview("letterSpacing", value)}
        min={-10}
        max={10}
        allowKeywords
      />

      <fieldset className="properties-aria text-align">
        <legend className="fieldset-legend">{localize("Text Align")}</legend>
        <ToggleButtonGroup
          aria-label={localize("Text alignment")}
          indicator
          selectedKeys={[styleValues.textAlign]}
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0] as string;
            if (value) updateStyle("textAlign", value);
          }}
        >
          <ToggleButton id="left">
            <AlignLeft
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ToggleButton>
          <ToggleButton id="center">
            <AlignCenter
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ToggleButton>
          <ToggleButton id="right">
            <AlignRight
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ToggleButton>
        </ToggleButtonGroup>
      </fieldset>

      <fieldset className="properties-aria vertical-align">
        <legend className="fieldset-legend">
          {localize("Vertical Align")}
        </legend>
        <ToggleButtonGroup
          aria-label={localize("Vertical alignment")}
          indicator
          selectedKeys={[styleValues.verticalAlign]}
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0] as string;
            if (value) updateStyle("verticalAlign", value);
          }}
        >
          <ToggleButton id="top">
            <AlignVerticalJustifyStart
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ToggleButton>
          <ToggleButton id="middle">
            <AlignVerticalJustifyCenter
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ToggleButton>
          <ToggleButton id="bottom">
            <AlignVerticalJustifyEnd
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ToggleButton>
        </ToggleButtonGroup>
      </fieldset>

      <fieldset className="properties-aria text-decoration">
        <legend className="fieldset-legend">
          {localize("Text Decoration")}
        </legend>
        <ToggleButtonGroup
          aria-label={localize("Text decoration")}
          indicator
          selectedKeys={
            styleValues.textDecoration === "none"
              ? []
              : [styleValues.textDecoration]
          }
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0] as string;
            // 선택 해제 시 'none'으로 초기화
            updateStyle("textDecoration", value || "none");
          }}
        >
          <ToggleButton id="overline">
            <Baseline
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
              style={{ transform: "rotate(180deg)" }}
            />
          </ToggleButton>
          <ToggleButton id="underline">
            <Underline
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ToggleButton>
          <ToggleButton id="line-through">
            <Strikethrough
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ToggleButton>
        </ToggleButtonGroup>
      </fieldset>

      <fieldset className="properties-aria font-style">
        <legend className="fieldset-legend">{localize("Font Style")}</legend>
        <ToggleButtonGroup
          aria-label={localize("Font style")}
          indicator
          selectedKeys={[styleValues.fontStyle]}
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0] as string;
            if (value) updateStyle("fontStyle", value);
          }}
        >
          <ToggleButton id="normal">
            <RemoveFormatting
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ToggleButton>
          <ToggleButton id="italic">
            <Italic
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ToggleButton>
          <ToggleButton id="oblique">
            <Type
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
              style={{ fontStyle: "oblique", transform: "skewX(-10deg)" }}
            />
          </ToggleButton>
        </ToggleButtonGroup>
      </fieldset>

      <fieldset className="properties-aria text-transform">
        <legend className="fieldset-legend">
          {localize("Text Transform")}
        </legend>
        <ToggleButtonGroup
          aria-label={localize("Text transform")}
          indicator
          selectedKeys={
            styleValues.textTransform === "none"
              ? []
              : [styleValues.textTransform]
          }
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0] as string;
            // 선택 해제 시 'none'으로 초기화
            updateStyle("textTransform", value || "none");
          }}
        >
          <ToggleButton id="uppercase">
            <CaseUpper
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ToggleButton>
          <ToggleButton id="lowercase">
            <CaseLower
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ToggleButton>
          <ToggleButton id="capitalize">
            <CaseSensitive
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ToggleButton>
        </ToggleButtonGroup>
      </fieldset>

      {/* ADR-008: Text Behavior Preset */}
      <PropertySelect
        icon={TextWrap}
        label="Wrap"
        className="text-behavior"
        value={styleValues.textBehaviorPreset}
        popoverWidthMode="fit-content"
        options={[
          { value: "normal", label: "Normal" },
          { value: "nowrap", label: "No Wrap" },
          { value: "truncate", label: "Truncate (...)" },
          { value: "break-words", label: "Break Words" },
          { value: "break-all", label: "Break All" },
          { value: "keep-all", label: "Keep All (CJK)" },
          { value: "preserve", label: "Preserve" },
          { value: "custom", label: "Custom..." },
        ]}
        onChange={handleTextBehaviorChange}
      />
    </>
  );
});

/**
 * TypographySection - 외부 래퍼 (PropertySection 관리)
 */
export const TypographySection = memo(function TypographySection() {
  const resetStyles = useResetStyles();
  const hasDirty = useHasDirtyStyles(TYPOGRAPHY_PROPS);

  const handleReset = () => {
    resetStyles(TYPOGRAPHY_PROPS);
  };

  return (
    <PropertySection
      id="typography"
      title="Typography"
      onReset={hasDirty ? handleReset : undefined}
    >
      <TypographySectionContent />
    </PropertySection>
  );
});

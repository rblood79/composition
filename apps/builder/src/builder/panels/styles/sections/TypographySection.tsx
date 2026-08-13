/**
 * TypographySection - Typography 스타일 편집 섹션
 *
 * Font, Text styles 편집
 * 접힌 섹션의 훅 실행을 방지하기 위해 내용 컴포넌트 분리.
 */

import { memo, useCallback, useEffect, useMemo, useState } from "react";
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
import { SwatchIconButton } from "../../../components/ui";
import { iconProps } from "../../../../utils/ui/uiConstants";
import {
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Underline,
  Strikethrough,
  RemoveFormatting,
  Italic,
  CaseSensitive,
  CaseLower,
  CaseUpper,
  Baseline,
  TextWrap,
} from "lucide-react";
import { useStore } from "../../../stores";
import { useStyleActions } from "../hooks/useStyleActions";
import { useOptimizedStyleActions } from "../hooks/useOptimizedStyleActions";
import { useTypographyValues } from "../hooks/useTypographyValues";
import { useResetStyles, useHasDirtyStyles } from "../hooks/useResetStyles";
import {
  DEFAULT_FONT_OPTIONS,
  FONT_REGISTRY_STORAGE_KEY,
  getFontWeightOptions,
  loadFontRegistry,
} from "../../../fonts/customFonts";
import { usePanelLayout } from "../../../hooks/usePanelLayout";

const TypographySectionContent = memo(function TypographySectionContent() {
  const { updateStyle, updateStyles } = useStyleActions();
  const { togglePanel } = usePanelLayout();
  const { updateStyleImmediate, updateStylePreview } =
    useOptimizedStyleActions();
  const selectedId = useStore((s) => s.selectedElementId);
  const styleValues = useTypographyValues(selectedId);
  const [registryFaces, setRegistryFaces] = useState(() =>
    loadFontRegistry().faces.map(({ family, weight }) => ({ family, weight })),
  );

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

  useEffect(() => {
    const syncFonts = () =>
      setRegistryFaces(
        loadFontRegistry().faces.map(({ family, weight }) => ({
          family,
          weight,
        })),
      );

    // ADR-155: Activity 재표시로 effect 재장착 시 숨김 중 놓친 갱신 catch-up
    syncFonts();

    window.addEventListener("composition:custom-fonts-updated", syncFonts);
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== FONT_REGISTRY_STORAGE_KEY) return;
      syncFonts();
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("composition:custom-fonts-updated", syncFonts);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const fontOptions = useMemo(() => {
    const seenFamilies = new Set<string>();
    const dynamicOptions: Array<{ value: string; label: string }> = [];
    for (const face of registryFaces) {
      if (!seenFamilies.has(face.family)) {
        seenFamilies.add(face.family);
        dynamicOptions.push({
          value: face.family,
          label: `${face.family} (Custom)`,
        });
      }
    }

    return [...DEFAULT_FONT_OPTIONS, ...dynamicOptions];
  }, [registryFaces]);

  const fontWeightOptions = useMemo(
    () => getFontWeightOptions(styleValues?.fontFamily || "", registryFaces),
    [styleValues?.fontFamily, registryFaces],
  );

  if (!styleValues) return null;

  return (
    <>
      <PropertySelect
        icon={Type}
        label="Font Family"
        className="font-family"
        value={styleValues.fontFamily}
        options={fontOptions}
        onChange={(value) => updateStyle("fontFamily", value)}
      />

      <PropertyColor
        icon={Type}
        label="Color"
        className="color"
        value={styleValues.color}
        onChange={(value) => updateStyle("color", value)}
        onPreview={(value) => updateStylePreview("color", value)}
        placeholder="#000000"
      />

      <div className="fieldset-actions actions-font">
        <SwatchIconButton
          aria-label="폰트 관리"
          onPress={() => togglePanel("right", "fonts")}
        >
          <Type
            color={iconProps.color}
            size={iconProps.size}
            strokeWidth={iconProps.strokeWidth}
          />
        </SwatchIconButton>
      </div>

      <PropertyUnitInput
        icon={Type}
        label="Font Size"
        className="font-size"
        value={styleValues.fontSize}
        units={["reset", "px"]}
        defaultUnit="px"
        onChange={(value) => updateStyleImmediate("fontSize", value)}
        onDrag={(value) => updateStylePreview("fontSize", value)}
        min={8}
        max={200}
      />
      <PropertyUnitInput
        icon={Type}
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
        icon={Type}
        label="Font Weight"
        className="font-weight"
        value={styleValues.fontWeight}
        options={fontWeightOptions}
        onChange={(value) => updateStyle("fontWeight", value)}
      />
      <PropertyUnitInput
        icon={Type}
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
        <legend className="fieldset-legend">Text Align</legend>
        <ToggleButtonGroup
          aria-label="Text alignment"
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
        <legend className="fieldset-legend">Vertical Align</legend>
        <ToggleButtonGroup
          aria-label="Vertical alignment"
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
        <legend className="fieldset-legend">Text Decoration</legend>
        <ToggleButtonGroup
          aria-label="Text decoration"
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
        <legend className="fieldset-legend">Font Style</legend>
        <ToggleButtonGroup
          aria-label="Font style"
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
        <legend className="fieldset-legend">Text Transform</legend>
        <ToggleButtonGroup
          aria-label="Text transform"
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
const TYPOGRAPHY_PROPS = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "color",
  "textAlign",
  "textDecoration",
  "textTransform",
  "verticalAlign",
  "whiteSpace",
  "wordBreak",
  "overflowWrap",
  "textOverflow",
];

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

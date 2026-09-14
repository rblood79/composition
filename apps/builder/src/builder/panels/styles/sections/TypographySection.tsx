/**
 * TypographySection - Typography 스타일 편집 섹션
 *
 * 6행 (panel-ui 03, 2026-09-14): 글꼴 | 색 · Weight | Size · Height | Spacing · Align | Vertical ·
 * Style | Decoration · Case | Wrap — 12 컨트롤이 legend + 아이콘 두 줄 (46) 이던 것을 suffix/inline
 * 라벨로 28 행에. Decoration · Case 는 「×」 가 none 자리 (재클릭 해제 대신 명시 선택).
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
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Baseline,
  CaseLower,
  CaseSensitive,
  CaseUpper,
  Bold,
  Italic,
  Strikethrough,
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

  const isBold = Number(styleValues.fontWeight) >= 600;
  const isItalic = styleValues.fontStyle !== "normal";
  const fontStyleKeys = [
    ...(isBold ? ["bold"] : []),
    ...(isItalic ? ["italic"] : []),
  ];

  return (
    <>
      {/* 1행: 글꼴 (이름이 곧 라벨) | 색 swatch 28 */}
      <FontFamilyPicker
        value={styleValues.fontFamily}
        onChange={(value) => updateStyle("fontFamily", value)}
      />
      <PropertyColor
        className="color"
        value={styleValues.color}
        onChange={handleTextColorCommit}
        onPreview={handleTextColorPreview}
        presentationOwnsFrameScheduling={presentationOwnsTextColor}
        onPresentationCancel={cancelTextColorPresentation}
        placeholder="#000000"
      />

      {/* 2행: Weight | Size — 3행: Height | Spacing (suffix 라벨, 종전 아이콘 + legend 두 줄) */}
      <PropertySelect
        label="Font Weight"
        className="font-weight"
        labelMode="inline"
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
        label="Font Size"
        className="font-size"
        labelMode="suffix"
        suffixLabel="SIZE"
        value={styleValues.fontSize}
        units={["reset", "px"]}
        defaultUnit="px"
        onChange={handleTextMetricCommit}
        onDrag={handleTextMetricPreview}
        min={8}
        max={200}
      />
      <PropertyUnitInput
        label="Line Height"
        className="line-height"
        labelMode="suffix"
        suffixLabel="LINE"
        value={styleValues.lineHeight}
        units={["reset", "px"]}
        onChange={(value) => updateStyleImmediate("lineHeight", value)}
        onDrag={(value) => updateStylePreview("lineHeight", value)}
        min={0}
        max={10}
        allowKeywords
      />
      <PropertyUnitInput
        label="Letter Spacing"
        className="letter-spacing"
        labelMode="suffix"
        suffixLabel="SPACE"
        value={styleValues.letterSpacing}
        units={["reset", "px"]}
        onChange={(value) => updateStyleImmediate("letterSpacing", value)}
        onDrag={(value) => updateStylePreview("letterSpacing", value)}
        min={-10}
        max={10}
        allowKeywords
      />

      {/* 4행: Align | Vertical */}
      <fieldset className="properties-aria text-align">
        <legend className="fieldset-legend">{localize("Align")}</legend>
        <ToggleButtonGroup
          aria-label={localize("Text alignment")}
          indicator
          selectedKeys={[styleValues.textAlign]}
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0] as string;
            if (value) updateStyle("textAlign", value);
          }}
        >
          <ToggleButton id="left" aria-label={localize("Align left")}>
            <AlignLeft
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ToggleButton>
          <ToggleButton id="center" aria-label={localize("Align center")}>
            <AlignCenter
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ToggleButton>
          <ToggleButton id="right" aria-label={localize("Align right")}>
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
          {localize("Vertical align")}
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
          <ToggleButton id="top" aria-label={localize("Vertical align top")}>
            <AlignVerticalJustifyStart
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ToggleButton>
          <ToggleButton
            id="middle"
            aria-label={localize("Vertical align middle")}
          >
            <AlignVerticalJustifyCenter
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ToggleButton>
          <ToggleButton
            id="bottom"
            aria-label={localize("Vertical align bottom")}
          >
            <AlignVerticalJustifyEnd
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ToggleButton>
        </ToggleButtonGroup>
      </fieldset>

      {/* 5행: Style | Decoration — Style 은 Bold · Italic 다중 선택 (동시 활성 · 재클릭 해제),
          × 토글 없음. Bold = fontWeight ≥ 600, 켜면 700 · 끄면 base 가 굵지 않으면 inline 삭제,
          굵으면 400. Italic = fontStyle ≠ normal (oblique 도 켜진 걸로 표시), 켜면 italic. */}
      <fieldset className="properties-aria font-style">
        <legend className="fieldset-legend">{localize("Style")}</legend>
        <ToggleButtonGroup
          aria-label={localize("Font style")}
          indicator
          selectionMode="multiple"
          selectedKeys={fontStyleKeys}
          onSelectionChange={(keys) => {
            const next = new Set(Array.from(keys) as string[]);
            const boldNext = next.has("bold");
            const italicNext = next.has("italic");
            if (boldNext !== isBold) {
              const value = boldNext
                ? "700"
                : Number(styleValues.fontWeightBase) >= 600
                  ? "400"
                  : "";
              if (
                value !== "" &&
                isTextMetricPresentationOwned("fontWeight") &&
                commitTextMetricPresentation("fontWeight", value)
              ) {
                // presentation 이 커밋
              } else {
                updateStyle("fontWeight", value);
              }
            }
            if (italicNext !== isItalic) {
              updateStyle("fontStyle", italicNext ? "italic" : "normal");
            }
          }}
        >
          <ToggleButton id="bold" aria-label={localize("Bold")}>
            <Bold
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ToggleButton>
          <ToggleButton id="italic" aria-label={localize("Italic")}>
            <Italic
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ToggleButton>
        </ToggleButtonGroup>
      </fieldset>

      <fieldset className="properties-aria text-decoration">
        <legend className="fieldset-legend">{localize("Decoration")}</legend>
        <ToggleButtonGroup
          aria-label={localize("Text decoration")}
          indicator
          selectedKeys={[styleValues.textDecoration]}
          onSelectionChange={(keys) => {
            // 활성 토글을 한 번 더 누르면 해제 = none (별도 × 토글 없음, 2026-09-14)
            const value = (Array.from(keys)[0] as string | undefined) ?? "none";
            if (value !== styleValues.textDecoration) {
              updateStyle("textDecoration", value);
            }
          }}
        >
          <ToggleButton
            id="line-through"
            aria-label={localize("Strikethrough")}
          >
            <Strikethrough
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ToggleButton>
          <ToggleButton id="underline" aria-label={localize("Underline")}>
            <Underline
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ToggleButton>
          <ToggleButton id="overline" aria-label={localize("Overline")}>
            <Baseline
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
              style={{ transform: "rotate(180deg)" }}
            />
          </ToggleButton>
        </ToggleButtonGroup>
      </fieldset>

      {/* 6행: Case | Wrap */}
      <fieldset className="properties-aria text-transform">
        <legend className="fieldset-legend">{localize("Case")}</legend>
        <ToggleButtonGroup
          aria-label={localize("Text transform")}
          indicator
          selectedKeys={[styleValues.textTransform]}
          onSelectionChange={(keys) => {
            const value = (Array.from(keys)[0] as string | undefined) ?? "none";
            if (value !== styleValues.textTransform) {
              updateStyle("textTransform", value);
            }
          }}
        >
          <ToggleButton id="uppercase" aria-label={localize("Uppercase")}>
            <CaseUpper
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ToggleButton>
          <ToggleButton id="capitalize" aria-label={localize("Capitalize")}>
            <CaseSensitive
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ToggleButton>
          <ToggleButton id="lowercase" aria-label={localize("Lowercase")}>
            <CaseLower
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ToggleButton>
        </ToggleButtonGroup>
      </fieldset>

      {/* ADR-008: Text Behavior Preset */}
      <PropertySelect
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

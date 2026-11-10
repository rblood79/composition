/**
 * TypographySection - Typography 스타일 편집 섹션
 *
 * 6행 (panel-ui 03, 2026-09-14): 글꼴 | 색 · Weight | Size · Height | Spacing · Align | Vertical ·
 * Style | Decoration · Case | Wrap — 라벨은 legend 위 + 상자 아래 (46, Gap 과 같은 어법 — 2026-09-15
 * 사용자 판정으로 suffix/inline 에서 되돌림), 단위는 상자 안 트리거. Decoration · Case 는 「×」 가
 * none 자리 (재클릭 해제 대신 명시 선택).
 * 접힌 섹션의 훅 실행을 방지하기 위해 내용 컴포넌트 분리.
 */

import { memo, useCallback, useMemo } from "react";
import { Section as PropertySection } from "../../../components/panel/Section";
import { PropertyUnitInput } from "../../../components/property/PropertyUnitInput";
import { FONT_SIZE_PRESET_OPTIONS } from "../../../components/property/propertyUnitPresets";
import { PropertyColor } from "../../../components/property/PropertyColor";
import { PropertySelect } from "../../../components/property/PropertySelect";
import {
  ToggleButton,
  ToggleButtonGroup,
} from "@composition/shared/components";
import { iconProps } from "../../../../utils/ui/uiConstants";
import {
  ALargeSmall,
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Baseline,
  Bold,
  CaseLower,
  CaseSensitive,
  CaseUpper,
  Italic,
  LetterSpacing,
  LineHeight,
  Strikethrough,
  Underline,
} from "lucide-react";
import { useStyleActions } from "../hooks/useStyleActions";
import { useOptimizedStyleActions } from "../hooks/useOptimizedStyleActions";
import { useTypographyValues } from "../hooks/useTypographyValues";
import { useResetStyles, useHasDirtyStyles } from "../hooks/useResetStyles";
import { getFontWeightOptions } from "../../../fonts/customFonts";
import { FontFamilyPicker } from "../../fonts/FontFamilyPicker";
import { useFontRegistry } from "../../fonts/useFontRegistry";
import { TYPOGRAPHY_PROPS } from "./styleSectionProps";
import { useSemanticLabel } from "../../../../i18n";
import { useStylesHost, useStylesSelectedId } from "../stylesHost";
import { useTextEditorHandle } from "../../../catalogRuntime/textEditorHandle";
import { catalogStyleWritesOf } from "../../../catalogRuntime/styleFields";
import { isTextRunMarkKey } from "../../../../../../../packages/shared/src/catalog/document/textRuns";

/** ADR-299 — the panel's 「Mixed」 value of a range key whose characters differ. */
const MIXED = "mixed";

/**
 * ADR-008 Text Behavior 프리셋 (빈 문자열 = 해제). `overflow` 는 Size 절의 컨트롤이라 Truncate
 * 만 쓴다 — 다른 프리셋이 지우면 Size 절에서 정한 overflow (모서리 clip 등) 가 사라진다.
 */
const TEXT_BEHAVIOR_PRESETS: Record<string, Record<string, string>> = {
  normal: {
    whiteSpace: "",
    wordBreak: "",
    overflowWrap: "",
    textOverflow: "",
  },
  nowrap: {
    whiteSpace: "nowrap",
    wordBreak: "",
    overflowWrap: "",
    textOverflow: "",
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
  },
  "break-all": {
    whiteSpace: "",
    wordBreak: "break-all",
    overflowWrap: "",
    textOverflow: "",
  },
  "keep-all": {
    whiteSpace: "",
    wordBreak: "keep-all",
    overflowWrap: "break-word",
    textOverflow: "",
  },
  // "Auto" = pre-wrap — 새 Text 의 기본 (줄바꿈 보존 · 폭에서 접힘, Figma 규약). 종전 이름 "Preserve".
  auto: {
    whiteSpace: "pre-wrap",
    wordBreak: "",
    overflowWrap: "",
    textOverflow: "",
  },
};

const TypographySectionContent = memo(function TypographySectionContent() {
  const localize = useSemanticLabel();
  const { updateStyle: updateNodeStyle, updateStyles } = useStyleActions();
  const { updateStyleImmediate, cancelStylePreview, updateStylePreview } =
    useOptimizedStyleActions();
  const selectedId = useStylesSelectedId();
  const nodeValues = useTypographyValues(selectedId);
  // 색 드래그도 Styles host 미리보기
  const host = useStylesHost();
  // ADR-299 Decision 5 — while the text is edited, the range keys read and write the editor's
  // selected range (a PM transaction → preview; the edit commits one command). Otherwise the node:
  // a key some run sets reads 「Mixed」 and a write sets node + runs (사용자 결정 3).
  const editor = useTextEditorHandle(selectedId);
  const runAxes = host.useTextRunAxes?.(selectedId) ?? [];
  const styleValues = useMemo(() => {
    if (!nodeValues) return nodeValues;
    const range = editor?.marks();
    const read = (
      key: "fontWeight" | "fontStyle" | "textDecoration" | "color" | "fontSize",
    ) =>
      range
        ? range[key] === undefined
          ? nodeValues[key]
          : String(range[key])
        : runAxes.includes(key)
          ? MIXED
          : nodeValues[key];
    return {
      ...nodeValues,
      fontWeight: read("fontWeight"),
      fontStyle: read("fontStyle"),
      textDecoration: read("textDecoration"),
      color: read("color") === MIXED ? "" : read("color"),
      fontSize: read("fontSize"),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `editor` re-renders per selection change
  }, [nodeValues, editor, editor?.marks(), runAxes.join("|")]);
  /** A range key goes to the editor's range while editing; true = taken. */
  const writeRange = useCallback(
    (key: string, value: string): boolean => {
      if (!editor || !isTextRunMarkKey(key)) return false;
      const write = catalogStyleWritesOf({ [key]: value }).visual?.[
        key as keyof NonNullable<
          ReturnType<typeof catalogStyleWritesOf>["visual"]
        >
      ] as { kind: string; value?: unknown } | undefined;
      editor.apply(key, write?.kind === "set" ? write.value : undefined);
      return true;
    },
    [editor],
  );
  const updateStyle = useCallback(
    (key: string, value: string) => {
      if (!writeRange(key, value)) updateNodeStyle(key, value);
    },
    [writeRange, updateNodeStyle],
  );
  // 등록된 face 는 Font Weight 옵션 산출에만 쓴다 — 패밀리 목록은 FontFamilyPicker 가 직접 읽는다.
  const { registry } = useFontRegistry();

  // ADR-008: Text Behavior 프리셋 변경 핸들러
  // updateStyles (batch)로 5개 속성을 단일 set()에 적용 → 히스토리 1건 + 레이아웃 1회
  const handleTextBehaviorChange = useCallback(
    (preset: string) => {
      const values = TEXT_BEHAVIOR_PRESETS[preset];
      if (!values) return; // 'custom' → no-op
      // Leaving Truncate takes back the overflow: hidden it set.
      updateStyles(
        preset !== "truncate" && styleValues?.textBehaviorPreset === "truncate"
          ? { ...values, overflow: "" }
          : values,
      );
    },
    [updateStyles, styleValues?.textBehaviorPreset],
  );

  const fontWeightOptions = useMemo(
    () => getFontWeightOptions(styleValues?.fontFamily || "", registry.faces),
    [styleValues?.fontFamily, registry.faces],
  );

  // (A range's color · size apply on commit — the preview is the node's, not the range's.)
  const handleTextColorPreview = useCallback(
    (value: string): void => {
      if (!editor) updateStylePreview("color", value);
    },
    [updateStylePreview, editor],
  );

  const handleTextColorCommit = useCallback(
    (value: string): void => updateStyle("color", value),
    [updateStyle],
  );

  const handleTextMetricPreview = useCallback(
    (value: string): void => {
      if (!editor) updateStylePreview("fontSize", value);
    },
    [updateStylePreview, editor],
  );

  const handleTextMetricCommit = useCallback(
    (value: string): void => {
      if (!writeRange("fontSize", value))
        updateStyleImmediate("fontSize", value);
    },
    [updateStyleImmediate, writeRange],
  );

  if (!styleValues) return null;

  const isBold = Number(styleValues.fontWeight) >= 600;
  // (A mixed range — 「Mixed」 — is neither on.)
  const isItalic =
    styleValues.fontStyle !== "normal" && styleValues.fontStyle !== MIXED;
  const sizeMixed = styleValues.fontSize === MIXED;
  const fontStyleKeys = [
    ...(isBold ? ["bold"] : []),
    ...(isItalic ? ["italic"] : []),
  ];

  return (
    // (ADR-299 — this section is in the text edit scope: `isInTextEditScope` reads its
    //  `data-section-id`; a wrapper here would break the section grid's direct-child rules.)
    <>
      {/* 1행: 글꼴 (legend — 다른 Select 와 같은 칸, 2026-11-10 사용자 지적) | 색 swatch 28 (상자 줄에 맞춤) */}
      <FontFamilyPicker
        label="Font family"
        value={styleValues.fontFamilyAuthored}
        inheritedFamily={
          styleValues.fontFamilyAuthored ? undefined : styleValues.fontFamily
        }
        onChange={(value) => updateStyle("fontFamily", value)}
      />
      <PropertyColor
        className="color"
        value={styleValues.color}
        onChange={handleTextColorCommit}
        onPreview={handleTextColorPreview}
        livePreview
        onPresentationCancel={() => host.cancelPreview?.()}
        placeholder="#000000"
      />

      {/* 2행: Weight | Size — 3행: Height | Spacing (legend 위 + 상자 아래, 단위는 상자 안 트리거 — 2026-09-15 사용자 판정) */}
      <PropertySelect
        label="Font Weight"
        className="font-weight"
        value={styleValues.fontWeight}
        options={fontWeightOptions}
        onChange={(value) => updateStyle("fontWeight", value)}
      />
      <PropertyUnitInput
        label="Font Size"
        icon={ALargeSmall}
        className="font-size"
        unitSuffix
        value={sizeMixed ? "" : styleValues.fontSize}
        {...(sizeMixed ? { placeholder: localize("Mixed") } : {})}
        units={["reset", "px"]}
        defaultUnit="px"
        presets={FONT_SIZE_PRESET_OPTIONS}
        presetAriaLabel={localize("Font size presets")}
        onChange={handleTextMetricCommit}
        onDragCancel={cancelStylePreview}
        onDrag={handleTextMetricPreview}
        min={8}
        max={200}
      />
      <PropertyUnitInput
        label="Line Height"
        icon={LineHeight}
        className="line-height"
        unitSuffix
        value={styleValues.lineHeight}
        autoValue={styleValues.lineHeightAuto}
        units={["auto", "px"]}
        onChange={(value) => updateStyleImmediate("lineHeight", value)}
        onDragCancel={cancelStylePreview}
        onDrag={(value) => updateStylePreview("lineHeight", value)}
        min={0}
        max={999}
        allowKeywords
      />
      <PropertyUnitInput
        label="Letter Spacing"
        icon={LetterSpacing}
        className="letter-spacing"
        unitSuffix
        value={styleValues.letterSpacing}
        units={["reset", "px"]}
        onChange={(value) => updateStyleImmediate("letterSpacing", value)}
        onDragCancel={cancelStylePreview}
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
              updateStyle("fontWeight", value);
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
          { value: "auto", label: "Auto" },
          { value: "normal", label: "Normal" },
          { value: "nowrap", label: "No wrap" },
          { value: "truncate", label: "Truncate (…)" },
          { value: "break-words", label: "Break words" },
          { value: "break-all", label: "Break all" },
          { value: "keep-all", label: "Keep all (CJK)" },
          { value: "custom", label: "Custom…" },
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

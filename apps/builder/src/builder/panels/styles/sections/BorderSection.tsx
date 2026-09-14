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
 * ADR-219 (2026-09-14): 변 세그먼트 「전체 · 좌 · 우 · 상 · 하」 (Width 아래) 와 코너 2×2
 * (Radius 아래). 표시는 `resolveBorderGeometry` 의 유효 4값 (저장 형태 무관), 쓰기는 —
 * 전체/슬라이더 = shorthand (store 배치 연산이 longhand 를 지운다), 변/칸 = longhand 배치
 * (`updateStylesImmediate` 한 번 · 코너 칸 하나는 그 longhand 하나). double/groove/ridge/
 * inset/outset 은 변별 폭 미지원 — 세그먼트 비활성, 그런 문서가 오면 「Skia 근사」 배지.
 * 접힌 섹션의 훅 실행을 방지하기 위해 내용 컴포넌트 분리.
 */

import { memo, type ComponentType } from "react";
import {
  Ellipsis,
  Minus,
  PanelBottom,
  PanelLeft,
  PanelRight,
  PanelTop,
  Square,
} from "lucide-react";
import {
  ToggleButtonGroup,
  ToggleButton,
} from "@composition/shared/components";
import {
  PropertySection,
  PropertyColor,
  PropertyRowMenu,
  PropertySlider,
  PropertyUnitInput,
} from "../../../components";
import {
  BORDER_RADIUS_PRESET_OPTIONS,
  BORDER_WIDTH_PRESET_OPTIONS,
  type PropertyUnitPreset,
} from "../../../components/property/propertyUnitPresets";
import {
  CornerRadius,
  LineDashed,
  type CornerRadiusCorner,
} from "../../../components/icons";
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

// 「없음 (×)」 토글 없음 — 활성 토글 재클릭이 해제 = none (Text 탭 세그먼트와 같은 패턴, 2026-09-14)
const BORDER_STYLE_OPTIONS = [
  { id: "solid", label: "Solid", icon: Minus },
  { id: "dashed", label: "Dashed", icon: LineDashed },
  { id: "dotted", label: "Dotted", icon: Ellipsis },
] as const;

/** 변별 폭을 지원하지 않는 style — 세그먼트 비활성 (breakdown §2.3 ③) */
const SIDED_WIDTH_UNSUPPORTED_STYLES = new Set([
  "double",
  "groove",
  "ridge",
  "inset",
  "outset",
]);

/** 세그먼트 순서 (시안 02 ④): 전체 · 좌 · 우 · 상 · 하 */
const SIDE_OPTIONS = [
  { id: "all", label: "All sides", icon: Square },
  { id: "left", label: "Left side", icon: PanelLeft },
  { id: "right", label: "Right side", icon: PanelRight },
  { id: "top", label: "Top side", icon: PanelTop },
  { id: "bottom", label: "Bottom side", icon: PanelBottom },
] as const;

/** `[top, right, bottom, left]` 인덱스 */
const SIDE_INDEX = { top: 0, right: 1, bottom: 2, left: 3 } as const;

// 코너 글리프가 라벨 (panel-ui 02 — 대조 B5; 종전 「TL」 글자 suffix). 접근 이름은 label 그대로.
const CORNER_ICONS: Record<
  CornerRadiusCorner,
  ComponentType<{ color?: string; size?: number; strokeWidth?: number }>
> = {
  tl: (p) => <CornerRadius corner="tl" {...p} />,
  tr: (p) => <CornerRadius corner="tr" {...p} />,
  bl: (p) => <CornerRadius corner="bl" {...p} />,
  br: (p) => <CornerRadius corner="br" {...p} />,
};

const CORNER_FIELDS = [
  {
    prop: "borderTopLeftRadius",
    label: "Top left radius",
    corner: "tl" as CornerRadiusCorner,
    index: 0,
  },
  {
    prop: "borderTopRightRadius",
    label: "Top right radius",
    corner: "tr" as CornerRadiusCorner,
    index: 1,
  },
  {
    prop: "borderBottomLeftRadius",
    label: "Bottom left radius",
    corner: "bl" as CornerRadiusCorner,
    index: 3,
  },
  {
    prop: "borderBottomRightRadius",
    label: "Bottom right radius",
    corner: "br" as CornerRadiusCorner,
    index: 2,
  },
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
  const { updateStyleImmediate, updateStylePreview, updateStylesImmediate } =
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

  // ADR-219 — 유효 4값. 슬라이더는 균일값 (비균일이면 최대값을 보이고, 드래그하면 균일로)
  const { widths, radii, uniformWidth, uniformRadius } =
    styleValues.borderGeometry;
  const widthPx = uniformWidth ?? Math.max(...widths);
  const radiusPx = uniformRadius ?? Math.max(...radii);
  const sidesOn = (["top", "right", "bottom", "left"] as const).filter(
    (side) => widths[SIDE_INDEX[side]] > 0,
  );
  const allSidesOn = sidesOn.length === 4;
  const sidesUnsupported = SIDED_WIDTH_UNSUPPORTED_STYLES.has(
    styleValues.borderStyle,
  );
  const showSkiaApproximation = sidesUnsupported && uniformWidth === null;
  const selectedSideKeys = allSidesOn ? ["all", ...sidesOn] : sidesOn;

  /** 변 세그먼트 — 전체 = shorthand, 일부 = 변 longhand 4 (w 또는 0) 배치 한 번 */
  const handleSidesChange = (keys: Set<unknown> | "all"): void => {
    const next = new Set(Array.from(keys as Set<string>));
    const w = widthPx > 0 ? widthPx : 1;
    const wasAll = allSidesOn;
    const nowAll = next.has("all");
    if (nowAll && !wasAll) {
      updateStyleImmediate("borderWidth", `${w}px`);
      return;
    }
    if (!nowAll && wasAll) {
      // "전체" 해제 = 변 전부 0 (shorthand 0 으로 접힌다)
      updateStyleImmediate("borderWidth", "0px");
      return;
    }
    const mask = (side: "top" | "right" | "bottom" | "left") =>
      next.has(side) ? `${w}px` : "0px";
    if (
      next.has("top") &&
      next.has("right") &&
      next.has("bottom") &&
      next.has("left")
    ) {
      updateStyleImmediate("borderWidth", `${w}px`);
      return;
    }
    updateStylesImmediate({
      borderTopWidth: mask("top"),
      borderRightWidth: mask("right"),
      borderBottomWidth: mask("bottom"),
      borderLeftWidth: mask("left"),
    });
  };

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

      <div className="style-border-sides">
        <fieldset className="properties-aria border-sides">
          <legend className="fieldset-legend">
            {localize("Sides")}
            {showSkiaApproximation && (
              <span
                className="border-sides-badge"
                title={localize("Per-side width needs solid, dashed or dotted")}
              >
                {localize("Skia approximation")}
              </span>
            )}
          </legend>
          <ToggleButtonGroup
            aria-label={localize("Sides")}
            indicator
            selectionMode="multiple"
            selectedKeys={selectedSideKeys}
            isDisabled={sidesUnsupported}
            onSelectionChange={handleSidesChange}
          >
            {SIDE_OPTIONS.map(({ id, label, icon: Icon }) => (
              <ToggleButton
                key={id}
                id={id}
                aria-label={localize(label)}
                {...(sidesUnsupported
                  ? {
                      title: localize(
                        "Per-side width needs solid, dashed or dotted",
                      ),
                    }
                  : {})}
              >
                <Icon
                  color={iconProps.color}
                  size={iconProps.size}
                  strokeWidth={iconProps.strokeWidth}
                />
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </fieldset>
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

      <div className="style-border-corners">
        {CORNER_FIELDS.map(({ prop, label, corner, index }) => (
          <PropertyUnitInput
            key={prop}
            label={localize(label)}
            className={`border-corner border-corner-${corner}`}
            labelMode="icon"
            icon={CORNER_ICONS[corner]}
            units={["px", "reset"]}
            defaultUnit="px"
            allowEmptyReset
            min={0}
            max={INPUT_MAX}
            value={`${radii[index]}px`}
            onChange={(value) => updateStyleImmediate(prop, value)}
          />
        ))}
      </div>

      <div className="style-border">
        <fieldset className="properties-aria border-style">
          <legend className="fieldset-legend">{localize("Style")}</legend>
          <ToggleButtonGroup
            aria-label={localize("Border Style")}
            indicator
            selectedKeys={[styleValues.borderStyle]}
            onSelectionChange={(keys) => {
              // 재클릭 (빈 선택) = none — companion 은 none 에 width/color 를 넣지 않는다
              const value =
                (Array.from(keys)[0] as string | undefined) ?? "none";
              if (value !== styleValues.borderStyle) {
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

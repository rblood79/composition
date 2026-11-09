/**
 * ThemesPanel - 인라인 테마 설정 패널 (ADR-021 Phase A+B · ADR-227 Phase 4)
 *
 * 테마 목록 (문서 컬렉션) + Tint 프리셋 선택 + Dark Mode 토글 + Neutral Tone + Radius Scale + 토큰 재정의
 * + 미니 프리뷰. 기존 PropertySection/PanelHeader 패턴 준수. preset/서체 절은 활성 테마에 쓴다.
 */

import { memo, useCallback } from "react";
import { SwatchBook, Check, Sun, Moon } from "lucide-react";
import { Button } from "react-aria-components/Button";
import { DialogTrigger } from "react-aria-components/Dialog";
import { Popover } from "@composition/shared/components/Popover";
import { ToggleButton as RAToggleButton } from "react-aria-components/ToggleButton";
import { parseColor } from "react-aria-components/ColorPicker";
import { ColorSwatch } from "@composition/shared/components/ColorSwatch";
import { iconProps } from "../../../utils/ui/uiConstants";
import type { TintPreset } from "../../../utils/theme/tintToSkiaColors";
import { TINT_PRESETS } from "../../../utils/theme/tintToSkiaColors";
import {
  NEUTRAL_PRESETS,
  type NeutralPreset,
} from "../../../utils/theme/neutralToSkiaColors";
import { oklchToHex } from "../../../utils/theme/oklchToHex";
import { PanelHeader } from "../../components/panel/PanelHeader";
import { Section as PropertySection } from "../../components/panel/Section";
import { PropertySelect } from "../../components/property/PropertySelect";
import { PanelContents } from "../../components/panel/PanelContents";
import { MiniThemePreview } from "./MiniThemePreview";
import { useToneLadders } from "./useToneLadders";
import { ThemeListSection } from "./ThemeListSection";
import { ThemeTokensSection } from "./ThemeTokensSection";
import { useI18n } from "../../../i18n";
import { useThemesHost } from "./themesHost";
import { FontFamilyPicker } from "../fonts/FontFamilyPicker";
import { ColorPickerPanel } from "../styles/components/ColorPickerPanel";
import { panelFillColorHex } from "../../catalogRuntime/panelTokens";
import { ACTION_ICONS } from "../../config/actionIcons";
import { useThemeConfigDarkMode } from "../../../stores/themeConfigStore";
import "./ThemesPanel.css";

// ============================================================================
// TintGrid — 10색 ColorSwatch 프리셋 버튼
// ============================================================================

/** Tint 프리셋 표시 순서 */
const TINT_ORDER: TintPreset[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "turquoise",
  "cyan",
  "blue",
  "indigo",
  "purple",
  "pink",
];

/** 프리셋별 미리보기 hex (55% lightness = highlight-background 기준) */
const TINT_HEX_MAP: Record<TintPreset, string> = Object.fromEntries(
  TINT_ORDER.map((key) => {
    const { h, c } = TINT_PRESETS[key];
    return [key, oklchToHex(0.55, c, h)];
  }),
) as Record<TintPreset, string>;

/** Tint 프리셋 한글 라벨 */
const TINT_LABELS: Record<TintPreset, string> = {
  red: "Red",
  orange: "Orange",
  yellow: "Yellow",
  green: "Green",
  turquoise: "Turquoise",
  cyan: "Cyan",
  blue: "Blue",
  indigo: "Indigo",
  purple: "Purple",
  pink: "Pink",
};

interface TintSwatchProps {
  tint: TintPreset;
  selected: boolean;
  onSelect: (tint: TintPreset) => void;
}

const TintSwatch = memo(
  function TintSwatch({ tint, selected, onSelect }: TintSwatchProps) {
    const handlePress = useCallback(() => onSelect(tint), [tint, onSelect]);
    const color = parseColor(TINT_HEX_MAP[tint]);

    return (
      <Button
        className="react-aria-Group color-swatch-button tint-swatch"
        aria-label={TINT_LABELS[tint]}
        data-selected={selected || undefined}
        onPress={handlePress}
      >
        <ColorSwatch color={color} />
        {selected && (
          <Check
            size={14}
            strokeWidth={3}
            color="#fff"
            className="tint-swatch-check"
          />
        )}
      </Button>
    );
  },
  (prev, next) =>
    prev.tint === next.tint &&
    prev.selected === next.selected &&
    prev.onSelect === next.onSelect,
);

// ============================================================================
// CustomAccentSwatch — 프리셋 밖 accent 색 (ADR-302 `color.accent` hex — tint 대체)
// ============================================================================

const AddIcon = ACTION_ICONS.add;

/**
 * 프리셋 10 뒤의 한 칸 — 사용자 색이 없으면 「+」, 있으면 그 색 견본 (선택 ✓). 누르면 색 고르기 (Fill 과
 * 같은 `ColorPickerPanel`) 가 열리고 손을 놓을 때 한 번 저장한다. 프리셋을 고르면 사용자 색은 지워진다.
 * (2026-11-10 사용자 요청 — 모델은 이미 hex 를 받았지만 패널에 넣는 자리가 없었다.)
 */
function CustomAccentSwatch({
  hex,
  fallbackHex,
  onCommit,
}: {
  /** 지금 사용자 accent (`#RRGGBB`) — 없으면 「+」 */
  hex: string | undefined;
  /** 고르기를 처음 열 때의 색 (지금 tint 견본) */
  fallbackHex: string;
  onCommit: (hex: string) => void;
}) {
  const mode = useThemeConfigDarkMode() === "dark" ? "dark" : "light";
  const commit = useCallback(
    (color: string) => {
      // 테마 색 토큰을 고르면 그 색의 지금 값 · alpha 는 accent 에 쓰지 않는다
      const resolved = panelFillColorHex(color, mode);
      if (/^#[0-9a-f]{6}/i.test(resolved))
        onCommit(resolved.slice(0, 7).toUpperCase());
    },
    [mode, onCommit],
  );
  const label = hex ? `Custom accent ${hex}` : "Add custom accent color";
  return (
    <DialogTrigger>
      <Button
        className="react-aria-Group color-swatch-button tint-swatch tint-swatch--custom"
        aria-label={label}
        data-selected={hex ? true : undefined}
      >
        {hex ? (
          <>
            <ColorSwatch color={parseColor(hex)} />
            <Check
              size={14}
              strokeWidth={3}
              color="#fff"
              className="tint-swatch-check"
            />
          </>
        ) : (
          <span className="tint-swatch-add" aria-hidden="true">
            <AddIcon size={iconProps.size} strokeWidth={iconProps.strokeWidth} />
          </span>
        )}
      </Button>
      <Popover
        placement="bottom start"
        className="property-color-popover"
        hideArrow
      >
        <ColorPickerPanel
          key={hex ?? fallbackHex}
          value={`${hex ?? fallbackHex}FF`}
          resetKey={hex ?? fallbackHex}
          onChange={() => {}}
          onChangeEnd={commit}
        />
      </Popover>
    </DialogTrigger>
  );
}

// ============================================================================
// NeutralGrid — 5색 Neutral 프리셋 스와치
// ============================================================================

/** 견본 = 그 Tone 사다리의 500 단 (ADR-302 — 역할 색과 같은 생성 사다리). 로드 전은 투명. */
const NEUTRAL_SWATCH_STEP = 500;

/** Neutral 프리셋 라벨 */
const NEUTRAL_LABELS: Record<NeutralPreset, string> = {
  slate: "Slate",
  gray: "Gray",
  zinc: "Zinc",
  neutral: "Neutral",
  stone: "Stone",
};

interface NeutralSwatchProps {
  preset: NeutralPreset;
  /** 그 Tone 사다리의 견본 단 — 생성 chunk 로드 전이면 없다. */
  hex: string | undefined;
  selected: boolean;
  onSelect: (preset: NeutralPreset) => void;
}

const NeutralSwatch = memo(
  function NeutralSwatch({
    preset,
    hex,
    selected,
    onSelect,
  }: NeutralSwatchProps) {
    const handlePress = useCallback(() => onSelect(preset), [preset, onSelect]);
    const color = parseColor(hex ?? "#00000000");

    return (
      <Button
        className="react-aria-Group color-swatch-button tint-swatch"
        aria-label={NEUTRAL_LABELS[preset]}
        data-selected={selected || undefined}
        onPress={handlePress}
      >
        <ColorSwatch color={color} />
        {selected && (
          <Check
            size={14}
            strokeWidth={3}
            color="#fff"
            className="tint-swatch-check"
          />
        )}
      </Button>
    );
  },
  (prev, next) =>
    prev.preset === next.preset &&
    prev.hex === next.hex &&
    prev.selected === next.selected &&
    prev.onSelect === next.onSelect,
);

// ============================================================================
// Select 옵션
// ============================================================================

const RADIUS_OPTIONS = [
  { value: "none", label: "None" },
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
  { value: "xl", label: "Extra Large" },
];

const BASE_FONT_SIZE_OPTIONS = [
  { value: "14", label: "14px (Small)" },
  { value: "16", label: "16px (Default)" },
  { value: "18", label: "18px (Large)" },
];

const LINE_HEIGHT_OPTIONS = [
  { value: "1.4", label: "1.4 (Compact)" },
  { value: "1.5", label: "1.5 (Default)" },
  { value: "1.6", label: "1.6 (Relaxed)" },
  { value: "1.75", label: "1.75 (Spacious)" },
];

// ============================================================================
// ThemesContent
// ============================================================================

function ThemesContent() {
  const { t } = useI18n();
  const host = useThemesHost();
  const preset = host.useActivePreset();
  const currentTint = preset.tint as TintPreset;
  const darkMode = preset.darkMode;
  const neutral = preset.neutral as NeutralPreset;
  const toneLadders = useToneLadders();
  const radiusScale = preset.radiusScale;
  const baseTypography = host.useBaseTypography();

  const isDark = darkMode === "dark";

  // ADR-227 Phase 1 · ADR-248 4e-4d-4 — 쓰기는 host 하나: 구 앱은 문서 우선 (`themeActions`, 컬렉션
  //   부재면 store), catalog 는 command 1개 (history 1 · theme 설치 · root 재생성은 workspace).
  const handleDarkModeToggle = useCallback(
    (isSelected: boolean) => {
      host.setActiveThemePreset({ darkMode: isSelected ? "dark" : "light" });
    },
    [host],
  );

  const handleTintSelect = useCallback(
    (tint: TintPreset) => {
      host.setActiveThemeAccent({ tint });
    },
    [host],
  );
  // ADR-302 — 활성 테마의 `color.accent` hex 가 있으면 tint 대신 그 색이 accent 다
  const themes = host.useThemes();
  const customAccentEntry = themes?.items[themes.active]?.tokens["color.accent"];
  const customAccent =
    typeof customAccentEntry?.value === "string"
      ? customAccentEntry.value
      : undefined;
  const handleCustomAccent = useCallback(
    (hex: string) => {
      host.setActiveThemeAccent({ hex });
    },
    [host],
  );

  const handleNeutralSelect = useCallback(
    (preset: NeutralPreset) => {
      host.setActiveThemePreset({ neutral: preset });
    },
    [host],
  );

  const handleRadiusChange = useCallback(
    (value: string) => {
      host.setActiveThemePreset({ radiusScale: value });
    },
    [host],
  );

  // 서체 변경은 테마 명령과 기존 catalog Preview 채널을 통해 반영한다.
  const applyTypography = useCallback(
    (patch: Partial<typeof baseTypography>) => {
      host.setActiveThemeBaseTypography(patch);
    },
    [host],
  );
  const handleFontFamilyChange = useCallback(
    (value: string) => applyTypography({ fontFamily: value }),
    [applyTypography],
  );
  const handleBaseFontSizeChange = useCallback(
    (value: string) => applyTypography({ fontSize: Number(value) }),
    [applyTypography],
  );
  const handleLineHeightChange = useCallback(
    (value: string) => applyTypography({ lineHeight: Number(value) }),
    [applyTypography],
  );

  return (
    <div className="panel themes-panel">
      <PanelHeader
        icon={<SwatchBook size={iconProps.size} />}
        title={t("themes.title")}
        panelId="theme"
        actions={
          <RAToggleButton
            className="iconButton"
            aria-label={
              isDark ? t("themes.switchToLight") : t("themes.switchToDark")
            }
            isSelected={isDark}
            onChange={handleDarkModeToggle}
          >
            {isDark ? (
              <Sun size={iconProps.size} strokeWidth={iconProps.strokeWidth} />
            ) : (
              <Moon size={iconProps.size} strokeWidth={iconProps.strokeWidth} />
            )}
          </RAToggleButton>
        }
      />

      <PanelContents>
        {/* ADR-227 Phase 4 — 문서 테마 컬렉션 목록 (추가 = 활성 복제 · 활성 · 이름 · 삭제) */}
        <ThemeListSection />

        <PropertySection title="Colors" id="theme-colors">
          {/* 프리셋 10 은 1·2열, 사용자 색은 행 끝 액션 칸 (28) — Font Family 옆 색 칸과 같은 자리
              (2026-11-10 사용자 지적: 처음엔 격자 11번째 칸이었다) */}
          <div className="fieldset-row theme-accent-row" data-wide="true">
            <fieldset className="properties-aria">
              <legend className="fieldset-legend">Accent</legend>
              <div className="tint-grid">
                {TINT_ORDER.map((tint) => (
                  <TintSwatch
                    key={tint}
                    tint={tint}
                    selected={!customAccent && currentTint === tint}
                    onSelect={handleTintSelect}
                  />
                ))}
              </div>
            </fieldset>
            <div className="fieldset-actions">
              <CustomAccentSwatch
                hex={customAccent}
                fallbackHex={TINT_HEX_MAP[currentTint] ?? "#3B63E6"}
                onCommit={handleCustomAccent}
              />
            </div>
          </div>

          <fieldset className="properties-aria">
            <legend className="fieldset-legend">Tone</legend>
            <div className="tint-grid">
              {NEUTRAL_PRESETS.map((preset) => (
                <NeutralSwatch
                  key={preset}
                  preset={preset}
                  hex={toneLadders[preset]?.[NEUTRAL_SWATCH_STEP]}
                  selected={neutral === preset}
                  onSelect={handleNeutralSelect}
                />
              ))}
            </div>
          </fieldset>
        </PropertySection>

        <PropertySection title="Appearance" id="theme-appearance">
          <PropertySelect
            label="Radius"
            value={radiusScale}
            onChange={handleRadiusChange}
            options={RADIUS_OPTIONS}
          />
        </PropertySection>

        <PropertySection title="Typography" id="theme-typography">
          <FontFamilyPicker
            label="Font"
            scope="theme"
            value={baseTypography.fontFamily}
            onChange={handleFontFamilyChange}
          />
          <PropertySelect
            label="Size"
            value={String(baseTypography.fontSize)}
            onChange={handleBaseFontSizeChange}
            options={BASE_FONT_SIZE_OPTIONS}
          />
          <PropertySelect
            label="Line Height"
            value={String(baseTypography.lineHeight)}
            onChange={handleLineHeightChange}
            options={LINE_HEIGHT_OPTIONS}
          />
        </PropertySection>

        {/* ADR-227 Phase 4 — 활성 테마 토큰 재정의 (color · typography · radius · border · shadow · focus) */}
        <ThemeTokensSection />

        <PropertySection title="Preview" id="theme-preview">
          <MiniThemePreview />
        </PropertySection>
      </PanelContents>
    </div>
  );
}

// ============================================================================
// ThemesPanel — 비활성 gating 은 PanelWorkspace 의 <Activity mode="hidden"> 이 담당 (ADR-922)
// ============================================================================

export function ThemesPanel() {
  return <ThemesContent />;
}

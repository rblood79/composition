/**
 * ThemesPanel - 인라인 테마 설정 패널 (ADR-021 Phase A+B · ADR-227 Phase 4)
 *
 * 테마 목록 (문서 컬렉션) + Tint 프리셋 선택 + Dark Mode 토글 + Neutral Tone + Radius Scale + 토큰 재정의
 * + 미니 프리뷰. 기존 PropertySection/PanelHeader 패턴 준수. preset/서체 절은 활성 테마에 쓴다.
 */

import { memo, useCallback } from "react";
import { SwatchBook, Check, Sun, Moon } from "lucide-react";
import { Button } from "react-aria-components/Button";
import { ToggleButton as RAToggleButton } from "react-aria-components/ToggleButton";
import { parseColor } from "react-aria-components/ColorPicker";
import { ColorSwatch } from "@composition/shared/components/ColorSwatch";
import { iconProps } from "../../../utils/ui/uiConstants";
import {
  useThemeConfigStore,
  useThemeConfigTint,
  useThemeConfigDarkMode,
  useThemeConfigNeutral,
  useThemeConfigRadiusScale,
  useThemeConfigBaseTypography,
} from "../../../stores/themeConfigStore";
import type { TintPreset } from "../../../utils/theme/tintToSkiaColors";
import { TINT_PRESETS } from "../../../utils/theme/tintToSkiaColors";
import type { NeutralPreset } from "../../../utils/theme/neutralToSkiaColors";
import { NEUTRAL_PALETTES } from "../../../utils/theme/neutralToSkiaColors";
import type { RadiusScale } from "../../../stores/themeConfigStore";
import { oklchToHex } from "../../../utils/theme/oklchToHex";
import {
  PanelHeader,
  PropertySection,
  PropertySelect,
  PanelContents,
} from "../../components";
import { MiniThemePreview } from "./MiniThemePreview";
import { ThemeListSection } from "./ThemeListSection";
import { ThemeTokensSection } from "./ThemeTokensSection";
import { useI18n } from "../../../i18n";
import { useThemeMessenger } from "../../hooks/useThemeMessenger";
import {
  setActiveThemeBaseTypography,
  setActiveThemePreset,
} from "./themeActions";
import { DEFAULT_BASE_TYPOGRAPHY } from "../../fonts/customFonts";
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
// NeutralGrid — 5색 Neutral 프리셋 스와치
// ============================================================================

/** Neutral 프리셋 표시 순서 */
const NEUTRAL_ORDER: NeutralPreset[] = [
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
];

/** 프리셋별 대표 hex (step 500 = 중간 밝기) */
const NEUTRAL_HEX_MAP: Record<NeutralPreset, string> = {
  slate: NEUTRAL_PALETTES.slate[500],
  gray: NEUTRAL_PALETTES.gray[500],
  zinc: NEUTRAL_PALETTES.zinc[500],
  neutral: NEUTRAL_PALETTES.neutral[500],
  stone: NEUTRAL_PALETTES.stone[500],
};

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
  selected: boolean;
  onSelect: (preset: NeutralPreset) => void;
}

const NeutralSwatch = memo(
  function NeutralSwatch({ preset, selected, onSelect }: NeutralSwatchProps) {
    const handlePress = useCallback(() => onSelect(preset), [preset, onSelect]);
    const color = parseColor(NEUTRAL_HEX_MAP[preset]);

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

// ADR-056: Typography 프리셋 (ADR-107 R4 drift 방지 — DEFAULT 체인은 상수 참조)
const FONT_FAMILY_OPTIONS = [
  {
    value: DEFAULT_BASE_TYPOGRAPHY.fontFamily,
    label: "Pretendard (Default)",
  },
  {
    value:
      "-apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', Roboto, sans-serif",
    label: "System Sans",
  },
  {
    value: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    label: "Inter",
  },
  {
    value:
      "'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    label: "Monospace",
  },
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
  const currentTint = useThemeConfigTint();
  const darkMode = useThemeConfigDarkMode();
  const neutral = useThemeConfigNeutral();
  const radiusScale = useThemeConfigRadiusScale();
  const baseTypography = useThemeConfigBaseTypography();
  const setTint = useThemeConfigStore((s) => s.setTint);
  const setDarkMode = useThemeConfigStore((s) => s.setDarkMode);
  const setNeutral = useThemeConfigStore((s) => s.setNeutral);
  const setRadiusScale = useThemeConfigStore((s) => s.setRadiusScale);
  const setBaseTypography = useThemeConfigStore((s) => s.setBaseTypography);
  const { sendBaseTypography } = useThemeMessenger();

  const isDark = darkMode === "dark";

  // ADR-227 Phase 1 — 쓰기는 문서 우선: canonical themes 컬렉션 (활성 테마 preset/델타) + history +
  //   persist 를 `themeActions` 가 한 묶음으로 내고, 런타임 store 는 거기서 파생된다. migration 전
  //   (컬렉션 부재) 이면 종전대로 store 만 (false 반환) — 로드 직후 잠깐의 창.
  const handleDarkModeToggle = useCallback(
    (isSelected: boolean) => {
      const darkMode = isSelected ? "dark" : "light";
      if (!setActiveThemePreset({ darkMode })) setDarkMode(darkMode);
    },
    [setDarkMode],
  );

  const handleTintSelect = useCallback(
    (tint: TintPreset) => {
      if (!setActiveThemePreset({ tint })) setTint(tint);
    },
    [setTint],
  );

  const handleNeutralSelect = useCallback(
    (preset: NeutralPreset) => {
      if (!setActiveThemePreset({ neutral: preset })) setNeutral(preset);
    },
    [setNeutral],
  );

  const handleRadiusChange = useCallback(
    (value: string) => {
      if (!setActiveThemePreset({ radiusScale: value })) {
        setRadiusScale(value as RadiusScale);
      }
    },
    [setRadiusScale],
  );

  // ADR-056 Phase 3+4: Typography 핸들러 — 문서 (테마 델타) + Preview postMessage 동시
  const applyTypography = useCallback(
    (patch: Partial<typeof baseTypography>) => {
      if (!setActiveThemeBaseTypography(patch)) setBaseTypography(patch);
      sendBaseTypography({ ...baseTypography, ...patch });
    },
    [setBaseTypography, sendBaseTypography, baseTypography],
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
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
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
          <fieldset className="properties-aria">
            <legend className="fieldset-legend">Accent</legend>
            <div className="tint-grid">
              {TINT_ORDER.map((tint) => (
                <TintSwatch
                  key={tint}
                  tint={tint}
                  selected={currentTint === tint}
                  onSelect={handleTintSelect}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="properties-aria">
            <legend className="fieldset-legend">Tone</legend>
            <div className="tint-grid">
              {NEUTRAL_ORDER.map((preset) => (
                <NeutralSwatch
                  key={preset}
                  preset={preset}
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
          <PropertySelect
            label="Font"
            value={baseTypography.fontFamily}
            onChange={handleFontFamilyChange}
            options={FONT_FAMILY_OPTIONS}
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

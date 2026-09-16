/**
 * ColorPickerPalettes — 색 피커 아래 「Document · Theme」 팔레트 (panel-ui 05 #1, 2026-09-15)
 *
 * Document = 이 문서에서 쓰인 색 자동 수집 (useDocumentColors — 저장소 없음).
 * Theme = ADR-110 theme/tokens 의 실제 모델: 현재 accent tint 사다리 (theme 이 쓰는 lightness 6)
 * + neutral tone 사다리 (Tailwind 50 · 200 · 400 · 600 · 800 · 950) 두 행 — ThemesPanel Colors
 * 절과 같은 값, 이름 있는 팔레트는 없다. swatch 28 · 6열 gap 8 (208, 팝오버 215 안) · 헤더 28 ·
 * 그룹 라벨 18 — 새 값 0. 스와치 클릭 = 그 색을 commit (입력 필드와 같은 경로).
 */
import { memo, useCallback, useMemo, useState } from "react";
import { Button } from "react-aria-components/Button";
import { ColorSwatch } from "@composition/shared/components/ColorSwatch";
import { parseColor } from "react-aria-components/ColorPicker";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  useThemeConfigDarkMode,
  useThemeConfigNeutral,
  useThemeConfigTint,
} from "../../../../stores/themeConfigStore";
import { resolveAccentLadder } from "../../../../utils/theme/tintToSkiaColors";
import { NEUTRAL_PALETTES } from "../../../../utils/theme/neutralToSkiaColors";
import { useSemanticLabel } from "../../../../i18n";
import { useDocumentColors } from "../hooks/useDocumentColors";
import { hex8ToHex6 } from "../utils/colorUtils";

/** Tailwind 사다리에서 고르는 6 단 — 50 · 200 · 400 · 600 · 800 · 950 (모두 실제 팔레트 값) */
export const NEUTRAL_LADDER_STEPS = [50, 200, 400, 600, 800, 950] as const;

interface ColorPickerPalettesProps {
  /** 현재 색 (hex8) — 같은 색의 스와치에 선택 링 */
  value: string;
  onSelect: (hex8: string) => void;
}

/** 스와치 하나 — 드래그 프레임마다 바뀌는 건 선택 링 2개뿐이라 행 단위 memo (parseColor 도 색당 1회) */
const Swatch = memo(function Swatch({
  hex,
  selected,
  labelPrefix,
  onSelect,
}: {
  hex: string;
  selected: boolean;
  labelPrefix: string;
  onSelect: (hex: string) => void;
}) {
  const color = useMemo(() => parseColor(hex), [hex]);
  const handlePress = useCallback(() => onSelect(hex), [onSelect, hex]);
  return (
    <Button
      className="color-picker-palette__swatch"
      aria-label={`${labelPrefix} ${hex.slice(1, 7).toUpperCase()}`}
      aria-pressed={selected}
      data-selected={selected || undefined}
      onPress={handlePress}
    >
      <ColorSwatch color={color} />
    </Button>
  );
});

const SwatchGrid = memo(function SwatchGrid({
  colors,
  current,
  labelPrefix,
  onSelect,
}: {
  colors: readonly string[];
  current: string;
  labelPrefix: string;
  onSelect: (hex: string) => void;
}) {
  // 선택 비교 키 — 색당 1회 (드래그 프레임마다 24 개를 다시 정규화하지 않는다)
  const hex6s = useMemo(() => colors.map((hex) => hex8ToHex6(hex)), [colors]);
  return (
    <div
      className="color-picker-palette__grid"
      role="group"
      aria-label={labelPrefix}
    >
      {colors.map((hex, i) => (
        <Swatch
          key={hex}
          hex={hex}
          selected={hex6s[i] === current}
          labelPrefix={labelPrefix}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
});

function PaletteHeader({
  title,
  count,
  open,
  onToggle,
}: {
  title: string;
  count?: string;
  open: boolean;
  onToggle: () => void;
}) {
  const Caret = open ? ChevronDown : ChevronRight;
  return (
    <button
      type="button"
      className="color-picker-palette__header"
      aria-expanded={open}
      onClick={onToggle}
    >
      <Caret size={14} strokeWidth={2} aria-hidden="true" />
      <span className="color-picker-palette__title">{title}</span>
      {count !== undefined && (
        <span className="color-picker-palette__count">{count}</span>
      )}
    </button>
  );
}

export const ColorPickerPalettes = memo(function ColorPickerPalettes({
  value,
  onSelect,
}: ColorPickerPalettesProps) {
  const localize = useSemanticLabel();
  const documentColors = useDocumentColors();
  const tint = useThemeConfigTint();
  const neutral = useThemeConfigNeutral();
  const darkMode = useThemeConfigDarkMode();
  const [documentOpen, setDocumentOpen] = useState(true);
  const [themeOpen, setThemeOpen] = useState(true);

  const accentLadder = useMemo(
    () => resolveAccentLadder(tint, darkMode === "dark" ? "dark" : "light"),
    [tint, darkMode],
  );
  const neutralLadder = useMemo(
    () => NEUTRAL_LADDER_STEPS.map((step) => NEUTRAL_PALETTES[neutral][step]),
    [neutral],
  );
  const current = hex8ToHex6(value);

  // 선택한 스와치 색을 hex8 로 commit — 문서 색은 alpha 를 보존, theme 사다리는 불투명
  const handleSelect = useCallback(
    (hex: string) =>
      onSelect(hex.length === 9 ? hex : `${hex}FF`.toUpperCase()),
    [onSelect],
  );

  return (
    <div className="color-picker-palettes">
      <section className="color-picker-palette" data-palette="document">
        <PaletteHeader
          title={localize("Document")}
          count={String(documentColors.length)}
          open={documentOpen}
          onToggle={() => setDocumentOpen((v) => !v)}
        />
        {documentOpen &&
          (documentColors.length > 0 ? (
            <SwatchGrid
              colors={documentColors}
              current={current}
              labelPrefix={localize("Document")}
              onSelect={handleSelect}
            />
          ) : (
            <p className="color-picker-palette__empty">
              {localize("No colors used yet")}
            </p>
          ))}
      </section>
      <section className="color-picker-palette" data-palette="theme">
        <PaletteHeader
          title={localize("Theme")}
          open={themeOpen}
          onToggle={() => setThemeOpen((v) => !v)}
        />
        {themeOpen && (
          <>
            <span className="color-picker-palette__label">
              {localize("Accent")} · {tint}
            </span>
            <SwatchGrid
              colors={accentLadder}
              current={current}
              labelPrefix={localize("Accent")}
              onSelect={handleSelect}
            />
            <span className="color-picker-palette__label">
              {localize("Neutral")} · {neutral}
            </span>
            <SwatchGrid
              colors={neutralLadder}
              current={current}
              labelPrefix={localize("Neutral")}
              onSelect={handleSelect}
            />
          </>
        )}
      </section>
    </div>
  );
});

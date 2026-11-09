/**
 * ColorPickerPalettes — 색 피커 아래 「Theme · Document」 팔레트 — 설명은 `ColorPickerPalettes.runtime.ts`
 * (ADR-298 Phase 3: Theme = 테마 색 토큰, 먼저).
 */
import { ColorSwatch } from "@composition/shared/components/ColorSwatch";

import { ChevronDown, ChevronRight } from "lucide-react";

import { memo, useCallback, useMemo, useState } from "react";

import { Button } from "react-aria-components/Button";

import { parseColor } from "react-aria-components/ColorPicker";

import { useSemanticLabel } from "../../../../i18n";

import {
  useThemeConfigDarkMode,
  useThemeConfigNeutral,
  useThemeConfigTint,
} from "../../../../stores/themeConfigStore";

import { tokenToCSSVar, type TokenRef } from "@composition/rendering";

import { readThemeTokenValue } from "../../../../../../../packages/shared/src/catalog/document/themedToken";

import { catalogFillColorOf } from "../../../../../../../packages/shared/src/catalog/resolution/resolver";

import { useDocumentColors } from "../hooks/useDocumentColors";

import { hex8ToHex6 } from "../utils/colorUtils";
import {
  type ColorPickerPalettesProps,
  THEME_PALETTE_GROUPS,
} from "./ColorPickerPalettes.runtime";

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
    <Button
      className="color-picker-palette__header"
      aria-expanded={open}
      onPress={onToggle}
    >
      <Caret size={14} strokeWidth={2} aria-hidden="true" />
      <span className="color-picker-palette__title">{title}</span>
      {count !== undefined && (
        <span className="color-picker-palette__count">{count}</span>
      )}
    </Button>
  );
}

/** Theme 스와치 하나 — 활성 모드 값으로 칠하고 이름 (토큰) 을 접근 이름 · title 로. */
const TokenSwatch = memo(function TokenSwatch({
  name,
  value,
  hex,
  selected,
  onSelect,
}: {
  name: string;
  /** The token's CSS variable (`tokenToCSSVar` — `{color.neutral-subtle}` is not `var(--neutral-subtle)`). */
  value: string;
  hex: string;
  selected: boolean;
  onSelect: (value: string) => void;
}) {
  const color = useMemo(() => parseColor(hex), [hex]);
  const handlePress = useCallback(() => onSelect(value), [onSelect, value]);
  return (
    <Button
      className="color-picker-palette__swatch"
      aria-label={name}
      aria-pressed={selected}
      data-selected={selected || undefined}
      data-token={name}
      onPress={handlePress}
    >
      <ColorSwatch color={color} />
    </Button>
  );
});

/** A theme color token's CSS variable when it is a plain `var(--name)` (the panel's token text). */
function themeTokenVar(name: string): string | undefined {
  const css = tokenToCSSVar(`{color.${name}}` as TokenRef);
  return /^var\(--[\w-]+\)$/.test(css) ? css : undefined;
}

export const ColorPickerPalettes = memo(function ColorPickerPalettes({
  value,
  token,
  onSelect,
}: ColorPickerPalettesProps) {
  const localize = useSemanticLabel();
  const documentColors = useDocumentColors();
  const tint = useThemeConfigTint();
  const neutral = useThemeConfigNeutral();
  const darkMode = useThemeConfigDarkMode();
  const [documentOpen, setDocumentOpen] = useState(true);
  const [themeOpen, setThemeOpen] = useState(true);

  // 토큰 값은 활성 테마 맵 (설치된 tint · neutral) 과 색 모드에서 읽는다 — 바뀌면 다시
  const themeGroups = useMemo(() => {
    const mode = darkMode === "dark" ? "dark" : "light";
    return THEME_PALETTE_GROUPS.map((group) => ({
      label: group.label,
      swatches: group.tokens.flatMap((name) => {
        const css = themeTokenVar(name);
        const hex = catalogFillColorOf(
          readThemeTokenValue(`{color.${name}}`, "color", mode),
        );
        return css && hex ? [{ name, css, hex }] : [];
      }),
    }));
  }, [tint, neutral, darkMode]);
  const current = hex8ToHex6(value);

  // 문서 색은 hex8 로 commit (alpha 보존), Theme 은 토큰 변수
  const handleSelect = useCallback(
    (picked: string) =>
      onSelect(
        picked.startsWith("var(") || picked.length === 9
          ? picked
          : `${picked}FF`.toUpperCase(),
      ),
    [onSelect],
  );

  return (
    <div className="color-picker-palettes">
      <section className="color-picker-palette" data-palette="theme">
        <PaletteHeader
          title={localize("Theme")}
          open={themeOpen}
          onToggle={() => setThemeOpen((v) => !v)}
        />
        {themeOpen &&
          themeGroups.map((group) => (
            <div key={group.label} className="color-picker-palette__group">
              <span className="color-picker-palette__label">
                {localize(group.label)}
              </span>
              <div
                className="color-picker-palette__grid"
                role="group"
                aria-label={localize(group.label)}
              >
                {group.swatches.map((swatch) => (
                  <TokenSwatch
                    key={swatch.name}
                    name={swatch.name}
                    value={swatch.css}
                    hex={swatch.hex}
                    selected={token === swatch.css}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            </div>
          ))}
      </section>
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
              current={token ? "" : current}
              labelPrefix={localize("Document")}
              onSelect={handleSelect}
            />
          ) : (
            <p className="color-picker-palette__empty">
              {localize("No colors used yet")}
            </p>
          ))}
      </section>
    </div>
  );
});

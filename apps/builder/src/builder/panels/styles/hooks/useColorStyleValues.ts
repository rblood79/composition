import { useMemo, type CSSProperties } from "react";
import { adaptStyleWithFills } from "@composition/shared";

import {
  useResolvedSkiaTheme,
  useThemeConfigVersion,
} from "../../../../stores/themeConfigStore";
import {
  resolveAppearanceSpecPreset,
  resolveStylePanelCatalogPaint,
  resolveTypographySpecPreset,
  type AppearanceSpecPreset,
  type TypographySpecPreset,
} from "../utils/specPresetResolver";
import {
  firstDefined,
  resolveStylePanelColor,
} from "../utils/styleValueHelpers";
import {
  useElementStyleContext,
  type ElementStyleContext,
} from "./useElementStyleContext";

export interface ResolvedEditorColor {
  raw: string;
  concrete: string;
}

export interface ColorStyleValues {
  context: ElementStyleContext;
  effectiveStyle: Record<string, unknown> | undefined;
  appearancePreset: AppearanceSpecPreset;
  typographyPreset: TypographySpecPreset;
  backgroundColor: ResolvedEditorColor;
  borderColor: ResolvedEditorColor;
  color: ResolvedEditorColor;
}

function editorColor(
  raw: string,
  theme: "light" | "dark",
  accentColor: ElementStyleContext["accentColor"],
): ResolvedEditorColor {
  return {
    raw,
    concrete: resolveStylePanelColor(raw, theme, accentColor),
  };
}

/**
 * Appearance/Typography가 공유하는 read-only catalog paint adapter.
 * authored state는 cache하지 않고 공통 resolver를 default interaction으로 한 번 호출한다.
 */
export function useColorStyleValues(
  id: string | null,
): ColorStyleValues | null {
  const context = useElementStyleContext(id);
  const { style, type, size, fills, props, accentColor } = context;
  const theme = useResolvedSkiaTheme();
  const themeVersion = useThemeConfigVersion();

  const appearancePreset = useMemo(
    () => resolveAppearanceSpecPreset(type, size, props),
    [type, size, props],
  );
  const typographyPreset = useMemo(
    () => resolveTypographySpecPreset(type, size, props),
    [type, size, props],
  );

  const effectiveStyle = useMemo(
    () =>
      adaptStyleWithFills(
        (style as CSSProperties | undefined) ?? undefined,
        fills,
      ) as Record<string, unknown> | undefined,
    [style, fills],
  );

  const paintStyle = useMemo<Readonly<Record<string, unknown>>>(() => {
    return {
      ...(appearancePreset.backgroundColor
        ? { backgroundColor: appearancePreset.backgroundColor }
        : {}),
      ...(appearancePreset.borderColor
        ? { borderColor: appearancePreset.borderColor }
        : {}),
      ...(typographyPreset.color ? { color: typographyPreset.color } : {}),
      ...(effectiveStyle ?? {}),
    };
  }, [appearancePreset, typographyPreset, effectiveStyle]);

  const paint = useMemo(
    () => resolveStylePanelCatalogPaint(type, size, props, paintStyle),
    [type, size, props, paintStyle],
  );

  return useMemo(() => {
    if (!id) return null;
    // resolveStylePanelColor → resolveToken 은 lightColors/darkColors 전역 객체를 읽고,
    // setTint/setNeutral 은 그 객체를 제자리 mutation 한다. theme 문자열과 accentColor 는
    // 그대로이므로 themeVersion 이 이 memo 의 유일한 재계산 신호다 (구독 + cache key).
    void themeVersion;

    const backgroundRaw = firstDefined(
      effectiveStyle?.backgroundColor,
      paint?.backgroundColor ?? appearancePreset.backgroundColor,
      "#FFFFFF",
    );
    const borderRaw = firstDefined(
      effectiveStyle?.borderColor,
      paint?.borderColor ?? appearancePreset.borderColor,
      "#000000",
    );
    const colorRaw = firstDefined(
      effectiveStyle?.color,
      paint?.color ?? typographyPreset.color,
      "#000000",
    );

    return {
      context,
      effectiveStyle,
      appearancePreset,
      typographyPreset,
      backgroundColor: editorColor(backgroundRaw, theme, accentColor),
      borderColor: editorColor(borderRaw, theme, accentColor),
      color: editorColor(colorRaw, theme, accentColor),
    };
  }, [
    id,
    context,
    effectiveStyle,
    appearancePreset,
    typographyPreset,
    paint,
    theme,
    themeVersion,
    accentColor,
  ]);
}

/**
 * useAppearanceValues - Appearance 섹션 전용 Zustand 스타일 값 훅
 */

import { useMemo, type CSSProperties } from "react";
import { adaptStyleWithFills } from "@composition/shared";
import {
  useResolvedSkiaTheme,
  useThemeConfigVersion,
} from "../../../../stores/themeConfigStore";
import {
  resolveAppearanceSpecPreset,
  type AppearanceSpecPreset,
} from "../utils/specPresetResolver";
import {
  numToPx,
  firstDefined,
  resolveStylePanelColor,
} from "../utils/styleValueHelpers";
import { useElementStyleContext } from "./useElementStyleContext";

export interface AppearanceStyleValues {
  backgroundColor: string;
  borderColor: string;
  borderWidth: string;
  borderRadius: string;
  borderStyle: string;
  boxShadow: string;
  overflow: string;
}

export function useAppearanceValues(
  id: string | null,
): AppearanceStyleValues | null {
  const { style, type, size, fills, props } = useElementStyleContext(id);
  const theme = useResolvedSkiaTheme();
  const themeVersion = useThemeConfigVersion();

  const specPreset = useMemo<AppearanceSpecPreset>(
    () => resolveAppearanceSpecPreset(type, size, props),
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

  return useMemo(() => {
    if (!id) return null;
    const s = effectiveStyle ?? {};
    const backgroundColor = firstDefined(
      s.backgroundColor,
      specPreset.backgroundColor,
      "#FFFFFF",
    );
    const borderColor = firstDefined(
      s.borderColor,
      specPreset.borderColor,
      "#000000",
    );
    return {
      backgroundColor: resolveStylePanelColor(backgroundColor, theme),
      borderColor: resolveStylePanelColor(borderColor, theme),
      borderWidth: firstDefined(
        s.borderWidth,
        numToPx(specPreset.borderWidth),
        "0px",
      ),
      borderRadius: firstDefined(
        s.borderRadius,
        numToPx(specPreset.borderRadius),
        "0px",
      ),
      borderStyle: firstDefined(s.borderStyle, specPreset.borderStyle, "solid"),
      boxShadow: firstDefined(s.boxShadow, specPreset.boxShadow, "none"),
      overflow: firstDefined(s.overflow, specPreset.overflow, "visible"),
    };
  }, [id, effectiveStyle, specPreset, theme, themeVersion]);
}

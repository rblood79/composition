/**
 * useAppearanceValues - Appearance 섹션 전용 Zustand 스타일 값 훅
 */

import { useMemo, type CSSProperties } from "react";
import { adaptStyleWithFills } from "@composition/shared";
import {
  resolveAppearanceSpecPreset,
  type AppearanceSpecPreset,
} from "../utils/specPresetResolver";
import { numToPx, firstDefined } from "../utils/styleValueHelpers";
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
  const { style, type, size, fills } = useElementStyleContext(id);

  const specPreset = useMemo<AppearanceSpecPreset>(
    () => resolveAppearanceSpecPreset(type, size),
    [type, size],
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
    return {
      backgroundColor: firstDefined(
        s.backgroundColor,
        specPreset.backgroundColor,
        "#FFFFFF",
      ),
      borderColor: firstDefined(
        s.borderColor,
        specPreset.borderColor,
        "#000000",
      ),
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
  }, [id, effectiveStyle, specPreset]);
}

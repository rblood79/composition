/**
 * useAppearanceValues - Appearance 섹션 전용 Zustand 스타일 값 훅
 */

import { useMemo } from "react";
import { numToPx, firstDefined } from "../utils/styleValueHelpers";
import { useColorStyleValues } from "./useColorStyleValues";

export interface AppearanceStyleValues {
  backgroundColor: string;
  borderColor: string;
  borderWidth: string;
  borderRadius: string;
  borderStyle: string;
  boxShadow: string;
  /** 요소 전체 opacity (CSS `opacity`, 0~1 문자열). spec preset 에는 없는 채널 — inline 또는 "1". */
  opacity: string;
  /** CSS `filter` (blur 한 종을 패널이 편집, 나머지 함수는 보존). inline 또는 "". */
  filter: string;
}

export function useAppearanceValues(
  id: string | null,
): AppearanceStyleValues | null {
  const colorValues = useColorStyleValues(id);

  return useMemo(() => {
    if (!id || !colorValues) return null;
    const s = colorValues.effectiveStyle ?? {};
    const specPreset = colorValues.appearancePreset;
    return {
      backgroundColor: colorValues.backgroundColor.concrete,
      borderColor: colorValues.borderColor.concrete,
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
      opacity: firstDefined(s.opacity, undefined, "1"),
      filter: firstDefined(s.filter, undefined, ""),
    };
  }, [id, colorValues]);
}

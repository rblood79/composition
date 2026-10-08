/**
 * useAppearanceValues - Appearance 섹션 전용 스타일 값 훅
 */

import { useMemo } from "react";
import { numToPx, firstDefined } from "../utils/styleValueHelpers";
import { useColorStyleValues } from "./useColorStyleValues";
import {
  resolveBorderGeometry,
  type BorderGeometry,
} from "../../../workspace/canvas/styleConversion/borderGeometry";

export interface AppearanceStyleValues {
  backgroundColor: string;
  borderColor: string;
  borderWidth: string;
  borderRadius: string;
  borderStyle: string;
  boxShadow: string;
  /** 요소 전체 opacity (CSS `opacity`, 0~1 문자열). inline 또는 "1". */
  opacity: string;
  /** CSS `filter` (blur 한 종을 패널이 편집, 나머지 함수는 보존). inline 또는 "". */
  filter: string;
  /**
   * ADR-219 — 코너 4 · 변 4 유효값 (저장 형태 무관: longhand ?? shorthand ?? record 실효값).
   * 패널 표시는 이것으로, 쓰기는 shorthand (전체) 또는 longhand (칸/변) 로.
   */
  borderGeometry: BorderGeometry;
}

const text = (value: string | number | undefined) =>
  value === undefined ? undefined : String(value);

export function useAppearanceValues(
  id: string | null,
): AppearanceStyleValues | null {
  const colorValues = useColorStyleValues(id);

  return useMemo(() => {
    if (!id || !colorValues) return null;
    const s = colorValues.effectiveStyle ?? {};
    // 그려진 record 의 실효 geometry (`catalogEffectiveStyle`) 가 먼저 — 색은 paint adapter 가 푼다.
    // record 에 없는 키만 자기 type rule 의 containerStyles (생성 CSS class 로 DOM 에 닿는 채널 —
    // Popover · Modal 의 box-shadow) 로 채운다.
    const e = colorValues.context.effective ?? {};
    const preset = colorValues.appearancePreset;
    const borderWidth = numToPx(e.borderWidth) ?? numToPx(preset.borderWidth);
    const borderRadius =
      numToPx(e.borderRadius) ?? numToPx(preset.borderRadius);
    return {
      backgroundColor: colorValues.backgroundColor.concrete,
      borderColor: colorValues.borderColor.concrete,
      borderWidth: firstDefined(s.borderWidth, borderWidth, "0px"),
      borderRadius: firstDefined(s.borderRadius, borderRadius, "0px"),
      borderStyle: firstDefined(
        s.borderStyle,
        text(e.borderStyle) ?? preset.borderStyle,
        "solid",
      ),
      boxShadow: firstDefined(
        s.boxShadow,
        text(e.boxShadow) ?? preset.boxShadow,
        "none",
      ),
      opacity: firstDefined(s.opacity, undefined, "1"),
      filter: firstDefined(s.filter, undefined, ""),
      borderGeometry: resolveBorderGeometry(s, { borderRadius, borderWidth }),
    };
  }, [id, colorValues]);
}

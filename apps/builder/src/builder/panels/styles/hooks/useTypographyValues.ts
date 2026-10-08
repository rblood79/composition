/**
 * useTypographyValues - Typography 섹션 전용 스타일 값 훅
 */

import { useMemo } from "react";
import {
  DEFAULT_FONT_FAMILY,
  extractFirstFontFamily,
  normalizeFontWeight,
} from "../../../fonts/customFonts";
import { numToPx, firstDefined } from "../utils/styleValueHelpers";
import { useColorStyleValues } from "./useColorStyleValues";

export interface TypographyStyleValues {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  /**
   * 작성값을 뺀 굵기 기준선 — Bold 토글 해제가 inline 을 지울지 400 을 쓸지 가른다. 작성된 fontWeight
   * 가 없으면 record 의 실효 굵기, 있으면 자기 type rule 의 굵기 (record 는 작성값이 덮인 뒤라
   * 그 밑을 모른다).
   */
  fontWeightBase: string;
  fontStyle: string;
  lineHeight: string;
  letterSpacing: string;
  color: string;
  textAlign: string;
  textDecoration: string;
  textTransform: string;
  verticalAlign: string;
  whiteSpace: string;
  wordBreak: string;
  overflowWrap: string;
  textOverflow: string;
  overflow: string;
  textBehaviorPreset: string;
  /** 글자 크기가 작성값이 아니라 record 의 실효값이다. */
  isFontSizeFromPreset?: boolean;
}

function deriveTextBehaviorPreset(
  ws: string,
  wb: string,
  ow: string,
  to: string,
  /** Only Truncate reads it: overflow is the Size section's control. */
  of: string,
): string {
  if (ws === "nowrap" && to === "ellipsis" && of === "hidden")
    return "truncate";
  if (ws === "nowrap") return "nowrap";
  // pre-wrap = "Auto" (새 Text 기본 — 줄바꿈 보존, ADR-027 후속 5).
  if (ws === "pre-wrap") return "auto";
  if (wb === "break-all") return "break-all";
  if (wb === "keep-all") return "keep-all";
  if (ow === "break-word") return "break-words";
  if (
    (!ws || ws === "normal") &&
    (!wb || wb === "normal") &&
    (!ow || ow === "normal") &&
    (!to || to === "clip")
  )
    return "normal";
  return "custom";
}

const text = (value: string | number | undefined) =>
  value === undefined ? undefined : String(value);

export function useTypographyValues(
  id: string | null,
): TypographyStyleValues | null {
  const colorValues = useColorStyleValues(id);

  return useMemo(() => {
    if (!id || !colorValues) return null;
    const s = colorValues.context.style ?? {};
    // 그려진 record 의 실효 typography (`catalogEffectiveStyle`) — 부모 size 전파 · 자기 rule 의
    // 글자 크기 · 굵기 · 줄 높이 (px) 가 여기 있다.
    const e = colorValues.context.effective ?? {};
    // record 에 없는 키만 자기 type rule 로 (record 가 글자 축을 들지 않는 노드).
    const preset = colorValues.typographyPreset;

    const rawFamily = firstDefined(
      s.fontFamily,
      text(e.fontFamily) ?? preset.fontFamily,
      DEFAULT_FONT_FAMILY,
    );
    const fontFamily = extractFirstFontFamily(rawFamily);

    const hasInlineFontSize =
      s.fontSize !== undefined && s.fontSize !== null && s.fontSize !== "";
    const effectiveFontSize = numToPx(e.fontSize) ?? numToPx(preset.fontSize);
    const isFontSizeFromPreset =
      !hasInlineFontSize && effectiveFontSize !== undefined;

    const fontSize = firstDefined(s.fontSize, effectiveFontSize, "16px");

    const hasInlineFontWeight =
      s.fontWeight !== undefined &&
      s.fontWeight !== null &&
      s.fontWeight !== "";
    const effectiveFontWeight = text(e.fontWeight) ?? preset.fontWeight;
    const fontWeight = normalizeFontWeight(
      firstDefined(s.fontWeight, effectiveFontWeight, "400"),
    );
    const fontWeightBase = normalizeFontWeight(
      hasInlineFontWeight
        ? (preset.fontWeight ?? "400")
        : (effectiveFontWeight ?? "400"),
    );

    const lineHeight = firstDefined(
      s.lineHeight,
      numToPx(e.lineHeight) ?? numToPx(preset.lineHeight),
      "normal",
    );
    const letterSpacing = firstDefined(
      s.letterSpacing,
      numToPx(e.letterSpacing) ?? numToPx(preset.letterSpacing),
      "normal",
    );

    const whiteSpace = firstDefined(s.whiteSpace, text(e.whiteSpace), "normal");
    const wordBreak = firstDefined(s.wordBreak, text(e.wordBreak), "normal");
    const overflowWrap = firstDefined(
      s.overflowWrap,
      text(e.overflowWrap),
      "normal",
    );
    const textOverflow = firstDefined(
      s.textOverflow,
      text(e.textOverflow),
      "clip",
    );
    const overflow = firstDefined(s.overflow, text(e.overflow), "visible");
    return {
      fontFamily,
      fontSize,
      fontWeight,
      fontWeightBase,
      fontStyle: firstDefined(s.fontStyle, text(e.fontStyle), "normal"),
      lineHeight,
      letterSpacing,
      color: colorValues.color.concrete,
      textAlign: firstDefined(s.textAlign, text(e.textAlign), "left"),
      textDecoration: firstDefined(
        s.textDecoration,
        text(e.textDecoration),
        "none",
      ),
      textTransform: firstDefined(
        s.textTransform,
        text(e.textTransform),
        "none",
      ),
      verticalAlign: firstDefined(
        s.verticalAlign,
        text(e.verticalAlign),
        "baseline",
      ),
      whiteSpace,
      wordBreak,
      overflowWrap,
      textOverflow,
      overflow,
      textBehaviorPreset: deriveTextBehaviorPreset(
        whiteSpace,
        wordBreak,
        overflowWrap,
        textOverflow,
        overflow,
      ),
      isFontSizeFromPreset,
    };
  }, [id, colorValues]);
}

import { useMemo } from "react";
import { numToPx, firstDefined, uniform4Way } from "../utils/styleValueHelpers";
import { useElementStyleContext } from "./useElementStyleContext";
import { resolveGapAxisProperty } from "../utils/gapAxis";

export interface LayoutStyleValues {
  display: string;
  flexDirection: string;
  alignItems: string;
  justifyContent: string;
  gap: string;
  flexWrap: string;
  padding: string;
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  margin: string;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
}

type Length = number | string | undefined;

/**
 * Layout 탭의 표시 값 — 작성값 (`style`, 활성 breakpoint 레이어) 이 먼저, 없으면 그려진 record 의
 * 실효값 (`effective` — `catalogEffectiveStyle`: Canvas · DOM 이 읽는 상자 모델과 longhand), 그도
 * 없으면 패널 기본. 기본값을 type · size 로 다시 계산하지 않는다 — 부모 part rule · size 전파가
 * 준 값은 record 에만 있다.
 */
export function useLayoutValues(id: string | null): LayoutStyleValues | null {
  const { style, effective } = useElementStyleContext(id);

  return useMemo(() => {
    if (!id) return null;
    const s = style ?? {};
    const e = (effective ?? {}) as Record<string, Length>;
    const display = firstDefined(s.display, numToPx(e.display), "block");
    const flexDirection = firstDefined(
      s.flexDirection,
      numToPx(e.flexDirection),
      "row",
    );
    const flexWrap = firstDefined(s.flexWrap, numToPx(e.flexWrap), "nowrap");
    // ADR-222 §4.1: 단일 행/열 flex 는 주축 longhand 를 우선 표시 (row → columnGap · column → rowGap)
    const gapAxis = resolveGapAxisProperty(display, flexDirection, flexWrap);
    const axisGap = gapAxis ? s[gapAxis] : undefined;
    const axisEffectiveGap = gapAxis ? e[gapAxis] : undefined;
    const inlineUniformPadding = uniform4Way(
      numToPx(s.paddingTop as Length),
      numToPx(s.paddingRight as Length),
      numToPx(s.paddingBottom as Length),
      numToPx(s.paddingLeft as Length),
    );
    const inlineUniformMargin = uniform4Way(
      numToPx(s.marginTop as Length),
      numToPx(s.marginRight as Length),
      numToPx(s.marginBottom as Length),
      numToPx(s.marginLeft as Length),
    );
    return {
      display,
      flexDirection,
      alignItems: firstDefined(s.alignItems, numToPx(e.alignItems), ""),
      justifyContent: firstDefined(
        s.justifyContent,
        numToPx(e.justifyContent),
        "",
      ),
      // store 는 longhand (rowGap/columnGap) 만 유지 — shorthand gap 은
      // inspectorActions 에서 longhand 로 분배. Panel Gap 필드는 rowGap
      // 우선, 없으면 columnGap, 없으면 shorthand `s.gap` (legacy) 표시.
      gap: firstDefined(
        axisGap ?? s.rowGap ?? s.columnGap ?? s.gap,
        numToPx(axisEffectiveGap ?? e.rowGap ?? e.columnGap ?? e.gap),
        "0px",
      ),
      flexWrap,
      // ADR-082 P1-2: 실효 4-way 가 균일하면 shorthand 에 반영 (collapsed 모드 UX)
      padding: firstDefined(
        numToPx(s.padding as Length) ?? inlineUniformPadding,
        uniform4Way(
          numToPx(e.paddingTop),
          numToPx(e.paddingRight),
          numToPx(e.paddingBottom),
          numToPx(e.paddingLeft),
        ),
        "0px",
      ),
      paddingTop: firstDefined(s.paddingTop, numToPx(e.paddingTop), "0px"),
      paddingRight: firstDefined(
        s.paddingRight,
        numToPx(e.paddingRight),
        "0px",
      ),
      paddingBottom: firstDefined(
        s.paddingBottom,
        numToPx(e.paddingBottom),
        "0px",
      ),
      paddingLeft: firstDefined(s.paddingLeft, numToPx(e.paddingLeft), "0px"),
      // ADR-082 P1-2: margin 도 4-way uniform fallback 동일 적용
      margin: firstDefined(
        numToPx(s.margin as Length) ?? inlineUniformMargin,
        uniform4Way(
          numToPx(e.marginTop),
          numToPx(e.marginRight),
          numToPx(e.marginBottom),
          numToPx(e.marginLeft),
        ),
        "0px",
      ),
      marginTop: firstDefined(s.marginTop, numToPx(e.marginTop), "0px"),
      marginRight: firstDefined(s.marginRight, numToPx(e.marginRight), "0px"),
      marginBottom: firstDefined(
        s.marginBottom,
        numToPx(e.marginBottom),
        "0px",
      ),
      marginLeft: firstDefined(s.marginLeft, numToPx(e.marginLeft), "0px"),
    };
  }, [id, style, effective]);
}

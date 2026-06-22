/**
 * DatePicker / DateRangePicker 공유 shapes 빌더 + size/state/metric 상수.
 *
 * ADR-912 단계5 step4 (2026-06-17): DatePicker.spec.ts / DateRangePicker.spec.ts 물리 삭제를 위해
 * spec 파일에 거주하던 spec-free 함수/상수를 본 모듈로 추출. 모두 props/sizeEntry/displayText/hasValue
 * 만 읽고 VariantSpec/ComponentSpec 객체를 참조하지 않는다(spec-free) — skiaPrimitives 의 datefield_trigger
 * replace primitive(hot path) 가 직접 소비.
 *
 * 계층: renderers/ (resolveSpecFontSize 동일 계층 + skiaPrimitives 형제). primitives/ 가 아닌 이유 —
 * resolveSpecFontSize(renderers/utils)에 의존하므로 primitives→renderers 역방향을 피한다.
 */

import type { Shape, TokenRef } from "../types";
import { fontFamily } from "../primitives/typography";
import { resolveSpecFontSize } from "./utils/resolveSpecFontSize";

/** DateInput 높이 metric (sm/md/lg). DateInputSpec.sizes[size].height 와 동일 값 (ADR-091 Phase 3에서 검증됨). */
export const DATE_PICKER_INPUT_HEIGHT: Record<string, number> = {
  sm: 22,
  md: 30,
  lg: 42,
};
export const DATE_PICKER_INPUT_PADDING: Record<
  string,
  { top: number; right: number; left: number }
> = {
  sm: { top: 2, right: 2, left: 8 },
  md: { top: 4, right: 4, left: 12 },
  lg: { top: 8, right: 8, left: 16 },
};
export const DATE_PICKER_BORDER_RADIUS: Record<string, number> = {
  sm: 6,
  md: 8,
  lg: 10,
};
export const DATE_PICKER_ICON_SIZE: Record<string, number> = {
  sm: 14,
  md: 16,
  lg: 20,
};

/** locale 기반 날짜 placeholder */
export function buildDatePlaceholder(locale: string): string {
  const isAsian =
    locale.startsWith("ko") ||
    locale.startsWith("ja") ||
    locale.startsWith("zh");
  const isEuropean =
    locale.startsWith("de") ||
    locale.startsWith("fr") ||
    locale.startsWith("es") ||
    locale.startsWith("it") ||
    locale.startsWith("pt") ||
    locale.startsWith("ru");
  if (isAsian) return "YYYY / MM / DD";
  if (isEuropean) return "DD / MM / YYYY";
  return "MM / DD / YYYY";
}

/**
 * DateInput 의 segment placeholder displayText 빌더 — `_parentTag`/`_granularity`/
 *   `_hourCycle`/`_locale` 4 prop 만 읽는 spec-free 순수 함수.
 *
 * datefieldSegments escape(skiaPrimitives) 의 그리기 텍스트와 layout 의 콘텐츠 폭 측정
 *   (calculateContentWidth dateinput 분기)이 **동일 텍스트** 를 쓰도록 단일 소스로 추출.
 *   두 곳이 placeholder 를 따로 만들면 box 폭(layout)과 그려지는 텍스트(escape)가 어긋난다.
 */
export function buildDateInputDisplayText(props: {
  parentTag?: string;
  granularity?: string;
  hourCycle?: number;
  locale?: string;
}): string {
  const parentTag = props.parentTag || "DateField";
  const granularity =
    props.granularity || (parentTag === "TimeField" ? "minute" : "day");
  const hourCycle = props.hourCycle;
  const locale = props.locale || "en-US";

  const dateText = buildDatePlaceholder(locale);
  const hasTime =
    granularity === "hour" ||
    granularity === "minute" ||
    granularity === "second";
  const timeSeg = (() => {
    let t = "HH : MM";
    if (granularity === "second") t += " : SS";
    if (hourCycle === 12) t += "  AM";
    return t;
  })();
  return parentTag === "TimeField"
    ? timeSeg
    : parentTag === "DateRangePicker"
      ? `${dateText} – ${dateText}`
      : hasTime
        ? `${dateText}  ${timeSeg}`
        : dateText;
}

/** DatePicker / DateRangePicker 공유 shapes 빌더 입력 */
export interface DatePickerShapesInput {
  props: Record<string, unknown>;
  sizeEntry: Record<string, unknown>;
  displayText: string;
  hasValue: boolean;
  defaultContainerWidth?: number;
}

export function buildDatePickerShapes(input: DatePickerShapesInput): Shape[] {
  const { props, sizeEntry, displayText, hasValue } = input;
  const defaultCW = input.defaultContainerWidth ?? 200;

  const sizeName = (props.size as string) || "md";
  const inputHeight =
    DATE_PICKER_INPUT_HEIGHT[sizeName] ?? DATE_PICKER_INPUT_HEIGHT.md;
  const pad =
    DATE_PICKER_INPUT_PADDING[sizeName] ?? DATE_PICKER_INPUT_PADDING.md;
  const borderRadius =
    DATE_PICKER_BORDER_RADIUS[sizeName] ?? DATE_PICKER_BORDER_RADIUS.md;
  const iconSz = DATE_PICKER_ICON_SIZE[sizeName] ?? DATE_PICKER_ICON_SIZE.md;
  const gap = 4;

  const containerWidth =
    (props._containerWidth as number) ||
    ((props.style as Record<string, unknown> | undefined)?.width as number) ||
    defaultCW;

  const style = (props.style as Record<string, unknown> | undefined) ?? {};
  const fontSize = resolveSpecFontSize(
    (style.fontSize as string | number | undefined) ??
      (sizeEntry.fontSize as string | number | undefined),
    14,
  );
  const ff = (style.fontFamily as string) || fontFamily.sans;

  const textColor =
    (style.color as string | undefined) ??
    (hasValue
      ? ("{color.neutral}" as TokenRef)
      : ("{color.neutral-subdued}" as TokenRef));
  const bgColor =
    (style.backgroundColor as string | undefined) ??
    ("{color.layer-2}" as TokenRef);
  const borderColor =
    (style.borderColor as string | undefined) ?? ("{color.border}" as TokenRef);

  const btnAreaWidth = iconSz + pad.right + gap;
  const textMaxWidth = containerWidth - pad.left - btnAreaWidth;
  const btnX = containerWidth - pad.right - iconSz;

  return [
    {
      id: "input-bg",
      type: "roundRect" as const,
      x: 0,
      y: 0,
      width: containerWidth,
      height: inputHeight,
      radius: borderRadius,
      fill: bgColor,
    },
    {
      type: "border" as const,
      target: "input-bg",
      borderWidth: 1,
      color: borderColor ?? ("{color.border}" as TokenRef),
      radius: borderRadius,
    },
    {
      type: "text" as const,
      x: pad.left,
      y: 0,
      text: displayText,
      fontSize,
      fontFamily: ff,
      fontWeight: 400,
      fill: textColor,
      align: "left" as const,
      baseline: "middle" as const,
      maxWidth: textMaxWidth,
    },
    {
      type: "icon_font" as const,
      iconName: "calendar",
      x: btnX + iconSz / 2,
      y: inputHeight / 2,
      fontSize: iconSz,
      fill: "{color.neutral-subdued}" as TokenRef,
      strokeWidth: 2,
    },
  ];
}

/** DatePicker/DateRangePicker 공유 sizes (Skia size oracle — rule table 과 값 동일). */
export const DATE_PICKER_SIZES = {
  xs: {
    height: 20,
    paddingX: 4,
    paddingY: 1,
    fontSize: "{typography.text-2xs}" as TokenRef,
    borderRadius: "{radius.xs}" as TokenRef,
    iconSize: 10,
    gap: 2,
  },
  sm: {
    height: 22,
    paddingX: 8,
    paddingY: 2,
    fontSize: "{typography.text-xs}" as TokenRef,
    borderRadius: "{radius.sm}" as TokenRef,
    iconSize: 14,
    gap: 4,
  },
  md: {
    height: 30,
    paddingX: 12,
    paddingY: 4,
    fontSize: "{typography.text-sm}" as TokenRef,
    borderRadius: "{radius.md}" as TokenRef,
    iconSize: 16,
    gap: 4,
  },
  lg: {
    height: 42,
    paddingX: 16,
    paddingY: 8,
    fontSize: "{typography.text-base}" as TokenRef,
    borderRadius: "{radius.lg}" as TokenRef,
    iconSize: 20,
    gap: 4,
  },
  xl: {
    height: 52,
    paddingX: 20,
    paddingY: 12,
    fontSize: "{typography.text-lg}" as TokenRef,
    borderRadius: "{radius.xl}" as TokenRef,
    iconSize: 24,
    gap: 8,
  },
};

/** DatePicker/DateRangePicker 공유 states */
export const DATE_PICKER_STATES = {
  hover: {},
  pressed: {},
  disabled: { opacity: 0.38, pointerEvents: "none" as const },
  focusVisible: {
    focusRing: "{focus.ring.default}" as const,
  },
};

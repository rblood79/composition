import React from "react";
import {
  Calendar,
  DatePicker,
  DateRangePicker,
  DateField,
  TimeField,
} from "../components/list";
import { I18nProvider } from "react-aria-components";
import type { PreviewElement, RenderContext } from "../types";
import { today, now, getLocalTimeZone, Time } from "@internationalized/date";

/**
 * locale + calendar → I18nProvider locale 문자열
 * 예: "ko-KR" + "buddhist" → "ko-KR-u-ca-buddhist"
 */
function buildLocaleString(
  locale?: string,
  calendar?: string,
): string | undefined {
  if (!locale && !calendar) return undefined;
  const base = locale || "en-US";
  if (!calendar) return base;
  return `${base}-u-ca-${calendar}`;
}

/** locale/calendar가 있으면 I18nProvider로 래핑 */
function wrapWithI18n(
  node: React.ReactElement,
  locale?: string,
  calendar?: string,
): React.ReactNode {
  const localeStr = buildLocaleString(locale, calendar);
  if (!localeStr) return node;
  return (
    <I18nProvider key={node.key} locale={localeStr}>
      {node}
    </I18nProvider>
  );
}

// ─── 공통 헬퍼 ──────────────────────────────────────────

function resolveCalendarIconPosition(cip: unknown): "left" | "right" {
  return cip === "left" || cip === "right" ? cip : "right";
}

/**
 * Calendar 자식 CalendarHeader element.props.style 의 layout 부분을 `<header>` 용 CSSProperties 로
 * 추출한다 (2026-07-02 B2, Style 패널 Layout 편집 ↔ Skia inline_icon_text 대칭).
 *
 * layout 관련 속성만 화이트리스트로 통과 — header 구조/ARIA(D1) 및 color/width 등 비-layout 은 제외.
 * DOM `<header>` 는 flex(prev/heading/next) 이므로 flexDirection/justifyContent/gap/padding 이 의미를
 * 갖는다. style-ssot 규칙에 따라 gap 은 longhand(row/columnGap) 이 있으면 그대로, shorthand gap 은
 * 컴포넌트가 알아서 소비. 값이 하나도 없으면 undefined 반환(기존 header 기본 배치 유지).
 */
export function resolveCalendarHeaderStyle(
  element: PreviewElement,
  context: RenderContext,
): React.CSSProperties | undefined {
  const children = context.childrenByParent.get(element.id) ?? [];
  const headerEl = children.find((c) => c.type === "CalendarHeader");
  const s = headerEl?.props?.style as Record<string, unknown> | undefined;
  if (!s) return undefined;
  const LAYOUT_KEYS = [
    "display",
    "flexDirection",
    "justifyContent",
    "alignItems",
    "gap",
    "rowGap",
    "columnGap",
    "padding",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
  ] as const;
  const out: Record<string, unknown> = {};
  for (const k of LAYOUT_KEYS) {
    if (s[k] != null) out[k] = s[k];
  }
  return Object.keys(out).length > 0 ? (out as React.CSSProperties) : undefined;
}

function resolvePlaceholder(
  props: Record<string, unknown>,
): string | undefined {
  return typeof props.placeholderValue === "string"
    ? props.placeholderValue
    : typeof props.placeholder === "string"
      ? props.placeholder
      : undefined;
}

/**
 * Date 관련 컴포넌트 렌더러
 * - Calendar
 * - DatePicker
 * - DateRangePicker
 * - DateField
 * - TimeField
 */

/**
 * Calendar 렌더링
 */
export const renderCalendar = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { updateElementProps } = context;

  const getPageBehavior = () => {
    const pb = element.props.pageBehavior;
    return pb === "visible" || pb === "single" ? pb : "visible";
  };

  const locale = element.props.locale as string | undefined;
  const calendarSystem = element.props.calendarSystem as string | undefined;
  const maxVisibleMonths = Number(element.props.maxVisibleMonths) || 1;
  const size = element.props.size as string | undefined;
  const variant = element.props.variant as string | undefined;
  // locale/calendarSystem 변경 시 리마운트 (defaultValue calendar 타입 재적용)
  const remountKey = `${element.id}-${locale || ""}-${calendarSystem || ""}`;

  // CalendarHeader 자식 element.props.style 의 layout 부분을 `<header>` 로 전달 (2026-07-02 B2).
  //   Skia inline_icon_text 가 동일 style 을 소비하므로 CSS↔Skia 대칭. header 구조/ARIA(D1) 불변,
  //   시각 layout(D3)만 반영. Style 패널 Layout(Gap/Padding/Justify) 편집이 DOM header 에 동기화.
  const headerStyle = resolveCalendarHeaderStyle(element, context);

  return (
    <Calendar
      key={remountKey}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      headerStyle={headerStyle}
      className={element.props.className}
      variant={(variant as "default" | "accent") || "default"}
      size={(size as "sm" | "md" | "lg") || "md"}
      locale={locale}
      calendarSystem={calendarSystem}
      aria-label={
        typeof element.props["aria-label"] === "string"
          ? element.props["aria-label"]
          : "Calendar"
      }
      isDisabled={Boolean(element.props.isDisabled)}
      isReadOnly={Boolean(element.props.isReadOnly)}
      isInvalid={Boolean(element.props.isInvalid)}
      maxVisibleMonths={maxVisibleMonths}
      pageBehavior={getPageBehavior() as "visible" | "single"}
      defaultToday={element.props.defaultToday === true}
      minValue={element.props.minValue as string | undefined}
      maxValue={element.props.maxValue as string | undefined}
      defaultValue={element.props.defaultValue as string | undefined}
      defaultFocusedValue={
        element.props.defaultFocusedValue as string | undefined
      }
      autoFocus={Boolean(element.props.autoFocus)}
      onChange={(date) => {
        const updatedProps = {
          ...element.props,
          value: date,
        };
        updateElementProps(element.id, updatedProps);
      }}
      errorMessage={String(element.props.errorMessage || "")}
    />
  );
};

/**
 * DatePicker 렌더링
 */
export const renderDatePicker = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { updateElementProps } = context;

  const getGranularity = () => {
    const g = String(element.props.granularity || "");
    if (["hour", "minute", "second"].includes(g)) return g;
    // includeTime이 true이면 기본 minute, 아니면 day
    return element.props.includeTime ? "minute" : "day";
  };

  const locale = element.props.locale as string | undefined;
  const calendarSystem = element.props.calendarSystem as string | undefined;
  const size = element.props.size as string | undefined;
  const granularity = getGranularity();
  const isTime = ["hour", "minute", "second"].includes(granularity);
  // locale/calendarSystem + date↔time 타입 전환 시 리마운트 (CalendarDate↔ZonedDateTime)
  const remountKey = `${element.id}-${locale || ""}-${calendarSystem || ""}-${isTime}`;

  return (
    <DatePicker
      key={remountKey}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
      size={(size as "sm" | "md" | "lg") || "md"}
      locale={locale}
      calendarSystem={calendarSystem}
      label={String(element.props.label || "Date Picker")}
      description={String(element.props.description || "")}
      errorMessage={String(element.props.errorMessage || "")}
      placeholder={resolvePlaceholder(element.props)}
      isDisabled={Boolean(element.props.isDisabled)}
      isRequired={Boolean(element.props.isRequired)}
      isReadOnly={Boolean(element.props.isReadOnly)}
      isInvalid={Boolean(element.props.isInvalid)}
      isQuiet={Boolean(element.props.isQuiet || false)}
      necessityIndicator={
        element.props.necessityIndicator as "icon" | "label" | undefined
      }
      labelPosition={(element.props.labelPosition as "top" | "side") || "top"}
      labelAlign={
        element.props.labelAlign as "start" | "center" | "end" | undefined
      }
      name={element.props.name ? String(element.props.name) : undefined}
      form={element.props.form ? String(element.props.form) : undefined}
      autoComplete={
        element.props.autoComplete
          ? String(element.props.autoComplete)
          : undefined
      }
      validationBehavior={
        (element.props.validationBehavior as "native" | "aria") || undefined
      }
      defaultValue={element.props.defaultValue as string | undefined}
      defaultToday={element.props.defaultToday === true}
      minValue={element.props.minValue as string | undefined}
      maxValue={element.props.maxValue as string | undefined}
      hideTimeZone={element.props.hideTimeZone !== false}
      granularity={granularity as "day" | "hour" | "minute" | "second"}
      pageBehavior={
        (element.props.pageBehavior as "visible" | "single") || undefined
      }
      showCalendarIcon={element.props.showCalendarIcon !== false}
      calendarIconPosition={resolveCalendarIconPosition(
        element.props.calendarIconPosition,
      )}
      iconName={
        element.props.iconName ? String(element.props.iconName) : undefined
      }
      showWeekNumbers={Boolean(element.props.showWeekNumbers)}
      highlightToday={element.props.highlightToday !== false}
      allowClear={element.props.allowClear !== false}
      autoFocus={Boolean(element.props.autoFocus)}
      shouldForceLeadingZeros={element.props.shouldForceLeadingZeros !== false}
      shouldCloseOnSelect={element.props.shouldCloseOnSelect !== false}
      maxVisibleMonths={
        element.props.maxVisibleMonths
          ? Number(element.props.maxVisibleMonths)
          : undefined
      }
      includeTime={Boolean(element.props.includeTime)}
      timeFormat={(element.props.timeFormat as "12h" | "24h") || "24h"}
      timeLabel={(element.props.timeLabel as string) || "시간"}
      onChange={(date) => {
        const updatedProps = {
          ...element.props,
          value: date,
        };
        updateElementProps(element.id, updatedProps);
      }}
    />
  );
};

/**
 * DateRangePicker 렌더링
 */
export const renderDateRangePicker = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { updateElementProps } = context;

  const getGranularity = () => {
    const g = String(element.props.granularity || "");
    return ["day", "hour", "minute", "second"].includes(g) ? g : "day";
  };

  const locale = element.props.locale as string | undefined;
  const calendarSystem = element.props.calendarSystem as string | undefined;
  const size = element.props.size as string | undefined;
  const granularity = getGranularity();
  const isTime = ["hour", "minute", "second"].includes(granularity);
  const remountKey = `${element.id}-${locale || ""}-${calendarSystem || ""}-${isTime}`;

  return (
    <DateRangePicker
      key={remountKey}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
      size={(size as "sm" | "md" | "lg") || "md"}
      label={String(element.props.label || "Date Range Picker")}
      description={String(element.props.description || "")}
      errorMessage={String(element.props.errorMessage || "")}
      placeholder={resolvePlaceholder(element.props)}
      locale={locale}
      calendarSystem={calendarSystem}
      isDisabled={Boolean(element.props.isDisabled)}
      isRequired={Boolean(element.props.isRequired)}
      isReadOnly={Boolean(element.props.isReadOnly)}
      isInvalid={Boolean(element.props.isInvalid)}
      isQuiet={Boolean(element.props.isQuiet || false)}
      necessityIndicator={
        element.props.necessityIndicator as "icon" | "label" | undefined
      }
      labelPosition={(element.props.labelPosition as "top" | "side") || "top"}
      labelAlign={
        element.props.labelAlign as "start" | "center" | "end" | undefined
      }
      defaultValue={undefined}
      minValue={element.props.minValue as string | undefined}
      maxValue={element.props.maxValue as string | undefined}
      defaultToday={element.props.defaultToday === true}
      hideTimeZone={element.props.hideTimeZone !== false}
      granularity={granularity as "day" | "hour" | "minute" | "second"}
      hourCycle={
        element.props.hourCycle
          ? (Number(element.props.hourCycle) as 12 | 24)
          : undefined
      }
      pageBehavior={
        (element.props.pageBehavior as "visible" | "single") || undefined
      }
      startName={
        element.props.startName ? String(element.props.startName) : undefined
      }
      endName={
        element.props.endName ? String(element.props.endName) : undefined
      }
      validationBehavior={
        (element.props.validationBehavior as "native" | "aria") || undefined
      }
      showCalendarIcon={element.props.showCalendarIcon !== false}
      calendarIconPosition={resolveCalendarIconPosition(
        element.props.calendarIconPosition,
      )}
      iconName={
        element.props.iconName ? String(element.props.iconName) : undefined
      }
      showWeekNumbers={Boolean(element.props.showWeekNumbers)}
      highlightToday={element.props.highlightToday !== false}
      allowClear={element.props.allowClear !== false}
      autoFocus={Boolean(element.props.autoFocus)}
      shouldForceLeadingZeros={element.props.shouldForceLeadingZeros !== false}
      shouldCloseOnSelect={element.props.shouldCloseOnSelect !== false}
      maxVisibleMonths={
        element.props.maxVisibleMonths
          ? Number(element.props.maxVisibleMonths)
          : undefined
      }
      allowsNonContiguousRanges={Boolean(
        element.props.allowsNonContiguousRanges,
      )}
      includeTime={Boolean(element.props.includeTime)}
      timeFormat={(element.props.timeFormat as "12h" | "24h") || "24h"}
      startTimeLabel={(element.props.startTimeLabel as string) || "시작 시간"}
      endTimeLabel={(element.props.endTimeLabel as string) || "종료 시간"}
      onChange={(dateRange) => {
        const updatedProps = {
          ...element.props,
          value: dateRange,
        };
        updateElementProps(element.id, updatedProps);
      }}
    />
  );
};

/**
 * DateField 렌더링
 */
export const renderDateField = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { updateElementProps } = context;

  const granularity = (() => {
    const g = String(element.props.granularity || "");
    return ["day", "hour", "minute", "second"].includes(g) ? g : "day";
  })() as "day" | "hour" | "minute" | "second";

  const locale = element.props.locale as string | undefined;
  const calendar = element.props.calendar as string | undefined;

  const hourCycle = element.props.hourCycle
    ? Number(element.props.hourCycle)
    : undefined;
  // granularity/locale/calendar 변경 시 리마운트 (defaultValue 재적용)
  const remountKey = `${element.id}-${granularity}-${locale || ""}-${calendar || ""}`;

  return wrapWithI18n(
    <DateField
      key={remountKey}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
      label={String(element.props.label || "Date")}
      description={String(element.props.description || "")}
      errorMessage={String(element.props.errorMessage || "")}
      size={
        (element.props.size as "xs" | "sm" | "md" | "lg" | "xl") || undefined
      }
      isDisabled={Boolean(element.props.isDisabled)}
      isRequired={Boolean(element.props.isRequired)}
      isReadOnly={Boolean(element.props.isReadOnly)}
      isInvalid={Boolean(element.props.isInvalid)}
      isQuiet={Boolean(element.props.isQuiet || false)}
      necessityIndicator={
        element.props.necessityIndicator as "icon" | "label" | undefined
      }
      labelPosition={(element.props.labelPosition as "top" | "side") || "top"}
      labelAlign={
        element.props.labelAlign as "start" | "center" | "end" | undefined
      }
      name={element.props.name ? String(element.props.name) : undefined}
      autoFocus={Boolean(element.props.autoFocus)}
      hideTimeZone={element.props.hideTimeZone !== false}
      shouldForceLeadingZeros={element.props.shouldForceLeadingZeros !== false}
      minValue={element.props.minValue as string | undefined}
      maxValue={element.props.maxValue as string | undefined}
      validationBehavior={
        (element.props.validationBehavior as "native" | "aria") || undefined
      }
      placeholderValue={element.props.placeholderValue as string | undefined}
      defaultValue={
        granularity === "day"
          ? today(getLocalTimeZone())
          : now(getLocalTimeZone())
      }
      granularity={granularity}
      hourCycle={hourCycle as 12 | 24 | undefined}
      onChange={(date) => {
        const updatedProps = {
          ...element.props,
          value: date,
        };
        updateElementProps(element.id, updatedProps);
      }}
    />,
    locale,
    calendar,
  );
};

/**
 * TimeField 렌더링
 */
export const renderTimeField = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { updateElementProps } = context;

  const getGranularity = () => {
    const g = String(element.props.granularity || "");
    return ["hour", "minute", "second"].includes(g) ? g : "minute";
  };

  const locale = element.props.locale as string | undefined;
  const granularity = getGranularity() as "hour" | "minute" | "second";
  const hourCycle = element.props.hourCycle
    ? Number(element.props.hourCycle)
    : undefined;
  const remountKey = `${element.id}-${granularity}-${locale || ""}`;

  return wrapWithI18n(
    <TimeField
      key={remountKey}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
      label={String(element.props.label || "Time")}
      description={String(element.props.description || "")}
      errorMessage={String(element.props.errorMessage || "")}
      size={
        (element.props.size as "xs" | "sm" | "md" | "lg" | "xl") || undefined
      }
      isDisabled={Boolean(element.props.isDisabled)}
      isRequired={Boolean(element.props.isRequired)}
      isReadOnly={Boolean(element.props.isReadOnly)}
      isInvalid={Boolean(element.props.isInvalid)}
      isQuiet={Boolean(element.props.isQuiet || false)}
      necessityIndicator={
        element.props.necessityIndicator as "icon" | "label" | undefined
      }
      labelPosition={(element.props.labelPosition as "top" | "side") || "top"}
      labelAlign={
        element.props.labelAlign as "start" | "center" | "end" | undefined
      }
      name={element.props.name ? String(element.props.name) : undefined}
      autoFocus={Boolean(element.props.autoFocus)}
      hideTimeZone={element.props.hideTimeZone !== false}
      shouldForceLeadingZeros={element.props.shouldForceLeadingZeros !== false}
      validationBehavior={
        (element.props.validationBehavior as "native" | "aria") || undefined
      }
      placeholderValue={element.props.placeholderValue as string | undefined}
      minValue={element.props.minValue as string | undefined}
      maxValue={element.props.maxValue as string | undefined}
      defaultValue={new Time(9, 0)}
      granularity={granularity}
      hourCycle={hourCycle as 12 | 24 | undefined}
      onChange={(time) => {
        const updatedProps = {
          ...element.props,
          value: time,
        };
        updateElementProps(element.id, updatedProps);
      }}
    />,
    locale,
  );
};

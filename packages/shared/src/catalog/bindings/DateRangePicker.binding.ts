/**
 * ADR-142 family ⑦(date) — DateRangePicker primitive 의 `PrimitiveBinding`.
 *
 * Preview 는 노드 트리 — RAC DateRangePicker 안에서 자식 (Label · Group > DateInput[start] + Text +
 * DateInput[end] + Button · Description · FieldError · Popover > RangeCalendar) 을 순서대로 그린다
 * (`delegatedDom` `daterangepicker`, ADR-256 Phase 6e). 닫힌 Popover 는 Canvas 에 그리지 않는다.
 * Skia 는 각 부품 노드를 그린다.
 */

import type { PrimitiveBinding } from "../types";
import {
  DATE_CALENDAR_SYSTEM_PROP,
  DATE_LOCALE_PROP,
  FIRST_DAY_OF_WEEK_PROP,
} from "./dateLocaleProps";

export const dateRangePickerBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "daterangepicker",
  },
  // ADR-912 단계 5 (1b): range trigger field Skia 시각을 `datefield_trigger` skiaPrimitive(replace)로
  // 이전. range 판정은 escape 가 props.startDate/endDate/_dateRange 로 수행(폭 320 + "start – end").
  skiaPrimitive: "datefield_trigger",
  props: {
    accepts: {
      label: { kind: "string", label: "Label", section: "content" },
      description: {
        kind: "string",
        label: "Description",
        section: "content",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      labelPosition: {
        kind: "enum",
        label: "Label Position",
        section: "appearance",
        default: "top",
        options: [
          { value: "top", label: "Top" },
          { value: "side", label: "Side" },
        ],
      },
      // RSP labelAlign (2026-08-21, design-data 감사 §1-2 축①) — side 라벨 컬럼 안에서의
      //   라벨 텍스트 정렬. DOM 은 `data-label-align` → catalog nested rule 의
      //   `text-align: var(--form-label-align)`, Canvas 는 rulePartRules.ts 가 같은 `label-align`
      //   블록을 Label part rule 의 textAlign 으로 컴파일해 읽는다. Form 조상 값은 조상 walk 로
      //   상속하고 자신이 지정하면 자신이 우선 (nearest-wins).
      labelAlign: {
        kind: "enum",
        label: "Label Align",
        section: "appearance",
        default: "start",
        options: [
          { value: "start", label: "Start" },
          { value: "center", label: "Center" },
          { value: "end", label: "End" },
        ],
        // RSP: labelAlign 은 labelPosition="side" 에서만 의미 (2026-09-15)
        visibleWhen: { key: "labelPosition", equals: "side" },
      },
      // calendar 아이콘 이름 D2 (DatePicker 동형). SSOT=부모 props.iconName.
      iconName: {
        kind: "icon",
        label: "Calendar Icon",
        section: "appearance",
        default: "calendar",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
      granularity: {
        kind: "enum",
        // RAC/HTML 기본과 같은 값 — 패널이 비어 보이지 않게 (2026-09-16)
        default: "day",
        label: "Granularity",
        section: "content",
        options: [
          { value: "day", label: "Day" },
          { value: "hour", label: "Hour" },
          { value: "minute", label: "Minute" },
          { value: "second", label: "Second" },
        ],
      },
      errorMessage: {
        kind: "string",
        label: "Error Message",
        section: "state",
      },
      minValue: { kind: "string", label: "Min Value", section: "state" },
      maxValue: { kind: "string", label: "Max Value", section: "state" },
      // S2 · RAC `placeholderValue`: the date the empty picker's calendar opens on (ISO text, as
      //   DateField's — 2026-10-09).
      placeholderValue: {
        kind: "string",
        label: "Placeholder Value",
        section: "content",
      },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): delegatedDom `datePickerProps` 가 소비 —
      //   RAC/RSP DateRangePicker 공식 prop. hideTimeZone/shouldForceLeadingZeros/
      //   shouldCloseOnSelect 는 렌더러 기본값이 true (`!== false`) 라 default: true 명시.
      startName: { kind: "string", label: "Start Name", section: "content" },
      endName: { kind: "string", label: "End Name", section: "content" },
      isRequired: { kind: "boolean", label: "Required", section: "state" },
      isInvalid: { kind: "boolean", label: "Invalid", section: "state" },
      autoFocus: { kind: "boolean", label: "Auto Focus", section: "state" },
      necessityIndicator: {
        kind: "enum",
        label: "Necessity Indicator",
        section: "appearance",
        // RSP/RAC 기본 표시는 icon (`*`) — seg 가 선택 없이 시작하지 않도록 (2026-09-16 사용자 결정)
        default: "icon",
        options: [
          { value: "icon", label: "Icon" },
          { value: "label", label: "Label" },
        ],
      },
      hourCycle: {
        kind: "enum",
        label: "Hour Cycle",
        section: "locale",
        options: [
          { value: "12", label: "12" },
          { value: "24", label: "24" },
        ],
        // 시간 granularity 에서만 의미 (2026-09-15)
        visibleWhen: {
          key: "granularity",
          oneOf: ["hour", "minute", "second"],
        },
      },
      hideTimeZone: {
        kind: "boolean",
        label: "Hide Time Zone",
        section: "locale",
        default: true,
        // 시간 granularity 에서만 의미 (2026-09-15)
        visibleWhen: {
          key: "granularity",
          oneOf: ["hour", "minute", "second"],
        },
      },
      pageBehavior: {
        kind: "enum",
        // RAC/HTML 기본과 같은 값 — 패널이 비어 보이지 않게 (2026-09-16)
        default: "visible",
        label: "Page Behavior",
        section: "content",
        options: [
          { value: "visible", label: "Visible" },
          { value: "single", label: "Single" },
        ],
      },
      shouldForceLeadingZeros: {
        kind: "boolean",
        label: "Leading Zeros",
        section: "locale",
        default: true,
      },
      shouldCloseOnSelect: {
        kind: "boolean",
        label: "Close On Select",
        section: "state",
        default: true,
      },
      maxVisibleMonths: {
        kind: "number",
        // RAC/HTML 기본과 같은 값 — 패널이 비어 보이지 않게 (2026-09-16)
        default: 1,
        label: "Max Visible Months",
        section: "content",
        min: 1,
      },
      allowsNonContiguousRanges: {
        kind: "boolean",
        label: "Non-contiguous Ranges",
        section: "state",
      },
      validationBehavior: {
        kind: "enum",
        label: "Validation",
        section: "state",
        options: [
          { value: "native", label: "Native" },
          { value: "aria", label: "ARIA" },
        ],
        // RAC Form 이 FormContext 로 자식 field 에 전파 — Form 하나만 편집 (2026-09-15)
        editorHidden: true,
      },
      // react-aria.adobe.com "International calendars": unset = the browser's locale.
      locale: DATE_LOCALE_PROP,
      calendarSystem: DATE_CALENDAR_SYSTEM_PROP,
      firstDayOfWeek: FIRST_DAY_OF_WEEK_PROP,
    },
    toRacProps: "default",
    // size 는 DateRangePicker.tsx 가 React prop 으로 직접 소비 + 자기 `data-size` 를 다시 emit
    //   → passthrough 없으면 default("M") 고정 + toRacProps 의 data-size 를 덮어씀
    //   (DatePicker.binding 과 동일 근거, ProgressCircle/Avatar/StatusLight 선례).
    //   labelPosition · labelAlign 도 같다: wrapper 가 `data-label-position={labelPosition}` ·
    //   `data-label-align` 를 다시 써서 side 가 항상 top 으로 덮였다 (ADR-248 4e-12, 2026-10-03).
    propPassthrough: ["size", "labelPosition", "labelAlign"],
  },
};

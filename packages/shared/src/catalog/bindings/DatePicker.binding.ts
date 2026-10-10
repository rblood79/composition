/**
 * ADR-142 family ⑦(date) — DatePicker primitive 의 `PrimitiveBinding`.
 *
 * Preview 는 노드 트리 — RAC DatePicker 안에서 자식 (Label · Group > DateInput + Button ·
 * Description · FieldError · Popover > Calendar) 을 순서대로 그린다 (`delegatedDom` `datepicker`,
 * ADR-256 Phase 6e). 닫힌 Popover 는 Canvas 에 그리지 않는다. Skia 는 각 부품 노드를 그린다.
 */

import type { PrimitiveBinding } from "../types";
import {
  DATE_CALENDAR_SYSTEM_PROP,
  DATE_LOCALE_PROP,
  FIRST_DAY_OF_WEEK_PROP,
} from "./dateLocaleProps";

export const datePickerBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "datepicker",
  },
  // ADR-912 단계 5 (1b): trigger field(input box + display text + calendar icon) Skia 시각을
  // `datefield_trigger` skiaPrimitive(replace)로 이전.
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
      // ADR-913 slice 2 (2026-06-18): labelPosition D2 노출 (measure gap[8]). DatePicker.tsx:84/119/186
      //   이 이미 prop 수용 + data-label-position emit, DatePicker entry 는 containerVariants(label-
      //   position.side) 보유 → binding 노출만으로 Inspector 설정 + Skia side 배치 완성 (DateField
      //   binding 동형). isQuiet 는 Skia buildDatePickerShapes quiet 미구현(gap[10]/R5)으로 노출 보류 —
      //   노출 시 Skia 평면 box ↔ CSS bottom-border 즉시 비대칭. Skia primitive 구현 후 별도 노출.
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
      // calendar 아이콘 이름 D2 (Select iconName 동형). SSOT=부모 DatePicker.props.iconName →
      //   toRacProps 로 Preview DatePicker.tsx 전달 + Skia SelectIcon 조부모 위임 → 양쪽 대칭.
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
      // S2 · RAC `hourCycle` (DateField · DateRangePicker 와 같은 계약 — 2026-10-09).
      hourCycle: {
        kind: "enum",
        label: "Hour Cycle",
        section: "locale",
        options: [
          { value: "12", label: "12" },
          { value: "24", label: "24" },
        ],
        visibleWhen: {
          key: "granularity",
          oneOf: ["hour", "minute", "second"],
        },
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
      //   RAC/RSP DatePicker 공식 prop. hideTimeZone/shouldForceLeadingZeros/
      //   shouldCloseOnSelect 는 렌더러 기본값이 true (`!== false`) 라 default: true 명시.
      //   (hourCycle 은 custom timeFormat("12h"/"24h") 채널이 이미 담당 — 중복 미추가.)
      name: { kind: "string", label: "Name", section: "content" },
      isRequired: { kind: "boolean", label: "Required", section: "state" },
      isInvalid: { kind: "boolean", label: "Invalid", section: "state" },
      autoFocus: { kind: "boolean", label: "Auto Focus", section: "state" },
      isQuiet: { kind: "boolean", label: "Quiet", section: "appearance" },
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
    // size 는 DatePicker.tsx(INTERNAL_RENDERERS 어댑터)가 **React prop 으로 직접 소비**한다
    //   (Label/DateInput/Button 하위 크기 결정 + 자기 `data-size` emit). catalog 의 size kind 는
    //   기본 data-attr 라우팅(`data-size`)이라 그대로 두면 DatePicker.tsx 의 size 가 undefined →
    //   **항상 default("M") 고정**, 게다가 wrapper 가 `{...props}` 뒤에 `data-size={size}` 를 다시
    //   써서 toRacProps 가 넣어준 `data-size="L"` 까지 **덮어쓴다** → Preview 가 size 변경을 전혀
    //   반영 못 함 (2026-07-14 사용자 적발). ProgressCircle/Avatar/StatusLight 선례 동형.
    //   labelPosition · labelAlign 도 같다: wrapper 가 `data-label-position={labelPosition}` ·
    //   `data-label-align` 를 다시 써서 side 가 항상 top 으로 덮였다 (ADR-248 4e-12, 2026-10-03).
    propPassthrough: ["size", "labelPosition", "labelAlign"],
  },
};

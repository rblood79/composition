/**
 * ADR-142 family ⑦(date) — DatePicker primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) primitive. composition wrapper(`DatePicker.tsx`)가 RAC DatePicker +
 * Label/Group/DateInput/Button/Popover/Calendar 합성(internal source). 캔버스 정적 노드 시각은
 * trigger field(input box + display text + 후행 calendar icon) — Popover+Calendar grid 는 클릭
 * 시 열리는 portal(정적 캔버스 미표시). Skia 는 `datefield_trigger` skiaPrimitive(replace) escape 로
 * trigger field 재현(ADR-912 단계 5 (1b) — skiaLegacy 제거).
 */

import type { PrimitiveBinding } from "../types";

export const datePickerBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "datepicker",
  },
  // ADR-912 단계 5 (1b): trigger field(input box + display text + calendar icon) Skia 시각을
  // `datefield_trigger` skiaPrimitive(replace)로 이전. skiaLegacy 제거 → isCatalogSkiaCutover=true.
  skiaPrimitive: "datefield_trigger",
  props: {
    accepts: {
      label: { kind: "string", label: "Label", section: "content" },
      description: {
        kind: "string",
        label: "Description",
        section: "content",
      },
      placeholder: {
        kind: "string",
        label: "Placeholder",
        section: "content",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
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
      //   `text-align: var(--form-label-align)`, Skia 는 buildSpecNodeData.resolveLabelAlignment
      //   (start|center|end → left|center|right 매핑). Form 조상 값은 renderer/조상 walk 로 상속하고
      //   자신이 지정하면 자신이 우선 (nearest-wins, 양 경로 동일).
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
      },
      showCalendarIcon: {
        kind: "boolean",
        label: "Show Calendar Icon",
        section: "appearance",
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
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): renderDatePicker 기소비 —
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
      },
      pageBehavior: {
        kind: "enum",
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
        label: "Max Visible Months",
        section: "content",
        min: 1,
      },
      validationBehavior: {
        kind: "enum",
        label: "Validation",
        section: "state",
        options: [
          { value: "native", label: "Native" },
          { value: "aria", label: "ARIA" },
        ],
      },
    },
    toRacProps: "default",
    // size 는 DatePicker.tsx(INTERNAL_RENDERERS 어댑터)가 **React prop 으로 직접 소비**한다
    //   (Label/DateInput/Button 하위 크기 결정 + 자기 `data-size` emit). catalog 의 size kind 는
    //   기본 data-attr 라우팅(`data-size`)이라 그대로 두면 DatePicker.tsx 의 size 가 undefined →
    //   **항상 default("md") 고정**, 게다가 wrapper 가 `{...props}` 뒤에 `data-size={size}` 를 다시
    //   써서 toRacProps 가 넣어준 `data-size="lg"` 까지 **덮어쓴다** → Preview 가 size 변경을 전혀
    //   반영 못 함 (2026-07-14 사용자 적발). ProgressCircle/Avatar/StatusLight 선례 동형.
    propPassthrough: ["size"],
  },
};

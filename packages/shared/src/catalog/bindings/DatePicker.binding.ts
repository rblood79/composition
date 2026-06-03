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
      showCalendarIcon: {
        kind: "boolean",
        label: "Show Calendar Icon",
        section: "appearance",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
    },
    toRacProps: "default",
  },
};

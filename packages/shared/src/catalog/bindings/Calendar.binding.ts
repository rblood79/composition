/**
 * ADR-142 family ⑦(date) — Calendar primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. composition wrapper(`Calendar.tsx`)가 RAC
 * Calendar + CalendarGrid/CalendarHeader/CalendarCell 합성(internal source). 날짜 grid 는
 * 비-box 시각(6주 × 7일 cell + 헤더) → DOM-only cutover(skiaLegacy:true). DOM 은 RAC 가 grid
 * 자동 합성, Skia 만 legacy render.shapes 유지(날짜 grid Skia generic 미확정, 전 family 후 일괄).
 *
 * color(TailSwatch/ColorPicker/ColorArea 등)는 사용자 지시로 family ⑦ 제외(별도 처리).
 */

import type { PrimitiveBinding } from "../types";

export const calendarBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "calendar",
  },
  props: {
    accepts: {
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "default",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
    },
    toRacProps: "default",
  },
};

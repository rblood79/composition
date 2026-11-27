import type { PrimitiveBinding } from "../types";

/**
 * ADR-321 Phase 4 — Rating: Spectrum 의 별점 (design-data `rating`). S2 1.8.2 · RAC 에 없어 RAC 부품으로
 * 조립한다 — 입력은 RAC `Slider`, 표시 전용 (`isReadOnly`) 은 RAC `Meter` (사용자 결정 7 · Phase 5).
 * 별 개수는 5 고정 (사용자 결정 6). 별 다섯은 노드가 아니라 Rating 이 그린다 (`rule/rating.ts`).
 *
 * 값 (Canvas 는 시작 값의 정지 모양 — Decision 10): `value` → `defaultValue` 를 유효값 (`runtime/rating.ts`
 * — 입력 = 정수, 표시 = 0.5 단위) 으로 맞춘 수.
 */
export const ratingBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "rating" },
  props: {
    accepts: {
      // (The controlled twin — a value binding · a rule's write; the panel edits the start value.)
      value: {
        editorHidden: true,
        kind: "number",
        label: "Value",
        section: "value",
      },
      defaultValue: {
        kind: "number",
        label: "Value",
        section: "value",
        min: 0,
        max: 5,
      },
      // (design-data `size`: s · m — the rule's sizes, as ProgressCircle's S · M · L.)
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      isEmphasized: {
        kind: "boolean",
        label: "Emphasized",
        section: "appearance",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
    },
    toRacProps: "default",
  },
};

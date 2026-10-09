import type { PrimitiveBinding } from "../types";

/**
 * MeterValue — Meter compound 의 현재 값 텍스트 leaf.
 *
 * **글자 = template 바인딩**: Meter origin template 이 `children: "{valueText}"` 로 Meter 의 값
 *   글자에 묶는다 (ADR-256 Phase 7b — Meter 의 render props 가 바인딩 frame).
 *
 * **DOM**: RAC `<Meter>` 의 자식으로 `span.value` (`domBinding.tsx` `metervalue` — `progressPart`).
 *
 * **Canvas = text leaf**: children 을 rule.variants(text color) + sizes(fontSize/lineHeight) 로
 *   그림. value_fill_* escape 없는 순수 text leaf.
 *
 * **binding 필수 이유**: catalog primitiveEntry 는 getPrimitiveBinding(type) 로 binding 을
 *   채운다. binding 누락 시 entry.binding=undefined → resolveEditContract 가 value 선택 시
 *   `entry.binding.props.accepts` 에서 크래시(2026-06-11 회귀). accepts 가 Inspector D2 properties.
 */
export const meterValueBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "metervalue" },
  props: {
    accepts: {
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "informative",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      children: {
        kind: "string",
        label: "Value",
        section: "content",
        default: "",
      },
    },
    toRacProps: "default",
  },
};

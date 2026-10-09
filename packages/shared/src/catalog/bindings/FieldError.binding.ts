import type { PrimitiveBinding } from "../types";

/**
 * FieldError — compound 컴포넌트의 validation 에러 메시지 leaf.
 *
 * **Canvas**: rule `COMPONENT_RULES_TABLE.FieldError` (fontSize + lineHeight + textWeight 400,
 *   transparent fill, sizes height 0 = inline text) — Description/Label 과 같은 text 시각, 색만
 *   negative(빨강). field 의 size 는 `CATALOG_SIZE_PROPAGATION` 으로 닿는다.
 *
 * **DOM (`domBinding.tsx`)**: field (`FIELD_HINT_OWNERS`) 의 부품이면 RAC `FieldError` — field 가
 *   invalid 일 때 RAC 가 보인다. TagGroup 의 부품이면 RAC `Text[slot=errorMessage]`. 그 밖은
 *   `span.react-aria-FieldError` (`role="alert"`).
 *
 * **source = internal**: RAC standalone `FieldError` controller 없음 (field context 안에서만 동작).
 *
 * D1: field 안에서는 RAC FieldError, 그 밖은 composition `<span>`.
 * D2: children/size 편집 surface.
 * D3: 시각(텍스트 색 negative/크기/lineHeight/weight 400)은 theme rule
 *     (COMPONENT_RULES_TABLE.FieldError).
 */
export const fieldErrorBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "fielderror",
  },
  props: {
    accepts: {
      children: { kind: "string", label: "Text", section: "content" },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
    },
    toRacProps: "default",
  },
};

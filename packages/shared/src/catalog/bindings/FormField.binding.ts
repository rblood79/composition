import type { PrimitiveBinding } from "../types";

/**
 * FormField — Form 필드 그룹 슬롯 컨테이너 (Label + 입력 컨트롤 묶음, composition 자체 추상,
 * RAC/starter 전용 컴포넌트 없음). palette 미노출 sub-part(DialogFooter/Field 동형). Form origin
 * template (`reusableOriginLibrary.ts` `component-form`) 은 이 노드 없이 field 를 직접 자식으로 둔다.
 *
 * **시각**: rule `COMPONENT_RULES_TABLE.FormField` 의 shell — 필드 그룹 시각은 자식 Label/입력
 *   노드가 그린다. layout 은 노드의 layout 값.
 *
 * **DOM**: `INTERNAL_RENDERERS` 에 `div` 가 없어 `ruleDom` 의 fallback `div.react-aria-FormField`
 *   (+ `data-size`) 로 그린다.
 *
 * D1: composition 자체 `<div>` (RAC 구조 밖).
 * D2: size 만 — slot 컨테이너 최소 surface.
 * D3: 시각 shell(투명, fill 없음).
 */
export const formFieldBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "div",
  },
  props: {
    accepts: {
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
    },
    toRacProps: "default",
  },
};

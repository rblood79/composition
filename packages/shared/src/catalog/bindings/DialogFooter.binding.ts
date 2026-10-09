import type { PrimitiveBinding } from "../types";

/**
 * DialogFooter — Dialog 액션 버튼 영역 슬롯 컨테이너 (composition 자체 추상, RAC/starter 전용
 * 컴포넌트 없음). Dialog origin template (`reusableOriginLibrary.ts` `component-dialog`) 이
 * Heading/Description 과 함께 자식 노드로 둔다. palette 미노출 sub-part(SelectValue/Field 동형).
 *
 * **시각**: rule `COMPONENT_RULES_TABLE.DialogFooter` + template 노드의 layout (`display:flex` /
 *   `justifyContent:flex-end` / `gap:"8px"`). footer 자체는 shell — 시각은 자식 버튼이 그린다.
 *
 * **DOM**: `INTERNAL_RENDERERS` 에 `footer` 가 없어 `ruleDom` 의 fallback
 *   `div.react-aria-DialogFooter` (+ `data-size`) 로 그린다.
 *
 * D1: composition 자체 상자 (RAC 구조 밖).
 * D2: size 만 — slot 컨테이너 최소 surface.
 * D3: 시각 shell(투명, fill 없음). layout 은 template 노드의 layout.
 */
export const dialogFooterBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "footer",
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

import type { PrimitiveBinding } from "../types";

/**
 * CardContent — Card 본문 슬롯 컨테이너 (Description 등 콘텐츠 묶음, composition 자체 추상,
 * RAC/starter 전용 컴포넌트 없음). Card origin template 의 자식 노드다 (reusableOriginLibrary.ts).
 * palette 미노출 sub-part(FormField/DialogFooter 동형).
 *
 * **ADR-912 childSpec→catalog cutover (2026-06-15)**: 시각 source =
 *   rule(`COMPONENT_RULES_TABLE.CardContent`) + generic box(shell).
 *   CardHeader/CardFooter/CardPreview 동형 일괄.
 *
 * **시각 = shell + rule layout**: layout(`display:flex` / `flexDirection:column` …)은 rule
 *   `structure.containerStyles` 가 정본이다. Canvas 는 shell 만 그리고
 *   본문 시각은 자식 Description 노드가 그린다.
 *
 * **DOM = `CATALOG_DELEGATED_DOM.cardcontent` (delegatedDom.tsx)**:
 *   `div.react-aria-CardContent[data-size]` 안에 자식 노드를 그린다.
 *   Description 자식은 RAC slot context 없이 `div.react-aria-Description` 으로 그린다.
 *
 * D1: composition `<div>` (internal source). D2: size 만. D3: 시각 shell(투명). layout=rule containerStyles.
 */
export const cardContentBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    // 고유 renderer id — CATALOG_DELEGATED_DOM.cardcontent 의 key.
    renderer: "cardcontent",
  },
  props: {
    accepts: {
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

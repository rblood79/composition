import type { PrimitiveBinding } from "../types";

/**
 * CardHeader — Card 헤더 슬롯 컨테이너 (Heading + action button 묶음, composition 자체 추상,
 * RAC/starter 전용 컴포넌트 없음). Card origin template 의 자식 노드다 (reusableOriginLibrary.ts).
 * palette 미노출 sub-part(FormField/DialogFooter 동형).
 *
 * **ADR-912 childSpec→catalog cutover (2026-06-15)**: 시각 source =
 *   rule(`COMPONENT_RULES_TABLE.CardHeader`) + generic box(shell).
 *   CardContent/CardFooter/CardPreview 동형 일괄.
 *
 * **시각 = shell + rule layout**: layout(`display:flex` / `flexDirection:row` …)은 rule
 *   `structure.containerStyles` 가 정본이다. Canvas 는 shell 만 그리고
 *   헤더 시각은 자식 Heading 노드가 그린다.
 *
 * **DOM = `CATALOG_DELEGATED_DOM.cardheader` (delegatedDom.tsx)**:
 *   `div.react-aria-CardHeader[data-size]` 안에 자식 노드를 그린다.
 *
 * D1: composition `<div>` (internal source).
 * D2: size 만 — slot 컨테이너 최소 surface.
 * D3: 시각 shell(투명, fill 없음). layout 은 rule containerStyles.
 */
export const cardHeaderBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    // 고유 renderer id — CATALOG_DELEGATED_DOM.cardheader 의 key.
    renderer: "cardheader",
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

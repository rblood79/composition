import type { PrimitiveBinding } from "../types";

/**
 * CardPreview — Card 미디어/preview 슬롯 컨테이너 (image/media 영역, composition 자체 추상,
 * RAC/starter 전용 컴포넌트 없음). Card origin template 의 자식 노드다 (reusableOriginLibrary.ts).
 * palette 미노출 sub-part(FormField/DialogFooter 동형).
 *
 * **ADR-912 childSpec→catalog cutover (2026-06-15)**: 시각 source =
 *   rule(`COMPONENT_RULES_TABLE.CardPreview`) + generic box(shell).
 *   CardHeader/CardContent/CardFooter 동형 일괄.
 *
 * **시각 = shell + rule layout**: layout(`display:flex` / `flexDirection:column` …)은 rule
 *   `structure.containerStyles` 가 정본이다. Canvas 는 shell 만 그리고
 *   미디어 시각은 자식 Image 노드가 그린다.
 *
 * **DOM = `CATALOG_DELEGATED_DOM.cardpreview` (delegatedDom.tsx)**:
 *   `div.react-aria-CardPreview[data-size]` 안에 자식 노드를 그린다.
 *
 * D1: composition `<div>` (internal source). D2: size 만. D3: 시각 shell(투명). layout=rule containerStyles.
 */
export const cardPreviewBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    // 고유 renderer id — CATALOG_DELEGATED_DOM.cardpreview 의 key.
    renderer: "cardpreview",
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

import type { PrimitiveBinding } from "../types";

/**
 * Card — 카드 컨테이너 (CardPreview / CardHeader / CardContent / CardFooter 슬롯 묶음).
 * composition 자체 추상 + S2 참조(`react-spectrum.adobe.com/Card`) — RAC/starter 에 `Card`
 * 컴포넌트 없음(S2 전용). origin template 이 자식 4 슬롯 노드를 둔다 (reusableOriginLibrary.ts).
 *
 * **ADR-912 R6 (Card 본체 S2 재설계 catalog cutover, 2026-06-15)**:
 *   옛 spec 시각(bg roundRect + isSelected 2px accent border)은 비표준 자체 변형이었다 —
 *   `cardType`(default/asset/user/product) + `isQuiet` boolean 분기는 S2 정본(variant=primary/
 *   secondary/tertiary/quiet)을 따르지 않았고, isQuiet boolean·isSelected boolean 시각 분기는 catalog rule 의 2축(fillStyle×state)으로
 *   표현 불가했다. **제거 → S2 variant 모델로 재생성**(R2 TreeItem 패턴: "복잡하면 제거 → 레퍼런스로
 *   새로, 그게 catalog 에 더 맞다"). isQuiet → `variant: "quiet"`(base transparent) 흡수,
 *   isSelected → RAC `[data-selected]` → `fill.default.selected` + `selectedBorder: accent` 토큰.
 *   시각 source = `COMPONENT_RULES_TABLE.Card`(variants 4종 fill + sizes) + buildCatalogShapes
 *   generic box shell. catalog rule schema 는 variants×fill 2축으로 4 variant 를 확장 없이 표현
 *   (ToggleButton 선례 동형).
 *
 * **시각 = generic shell(자식이 내용 렌더)**: Card 는 컨테이너이므로 Canvas 는 shell(bg roundRect +
 *   variant border 만)을 그리고 자식 노드가 header/content/footer 시각을 담당한다. quiet variant 는
 *   base transparent → hover 시만 배경. container layout(`display:flex` / `flexDirection:column` …)은
 *   rule `structure.containerStyles` 가 정본이다.
 *
 * **부모→자식 전달**: title · description 은 origin template 의 `{title}` · `{description}` 바인딩으로
 *   Heading · Description 자식에 닿는다(ADR-254).
 *
 * **DOM = `CATALOG_DELEGATED_DOM.card` (delegatedDom.tsx)**: shared `Card.tsx` 에 variant/size/상태를
 *   넘기고 자식 노드를 그 안에 그린다(CardHeader/CardContent/CardPreview/CardFooter 자식이 있으면
 *   `structuralChildren`).
 *
 * D1: composition `<div>` (internal source, shared `Card.tsx`).
 * D2: content(title/description) + variant/size/accentColor + interaction(href/target) + 상태 편집 surface.
 * D3: 시각(variant 별 배경/테두리 + radius)은 theme rule(COMPONENT_RULES_TABLE.Card). Skia generic
 *     box shell ↔ DOM `react-aria-Card[data-variant]` 시각 대칭.
 */
export const cardBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    // 고유 renderer id — CATALOG_DELEGATED_DOM.card 의 key ("div" 는 다른 단순 컨테이너와 공유된다).
    renderer: "card",
  },
  props: {
    accepts: {
      // content — origin template 바인딩 `{title}` · `{description}` 으로 Heading · Description
      //   자식에 닿는다.
      title: { kind: "string", label: "Title", section: "content" },
      description: {
        kind: "string",
        label: "Description",
        section: "content",
      },
      // appearance — S2 variant 모델(구 cardType/isQuiet 흡수).
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "primary",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      // live consumer: CATALOG_DELEGATED_DOM.card (data-accent attr)
      accentColor: {
        kind: "string",
        label: "Accent Color",
        section: "appearance",
      },
      // interactions / state
      href: { kind: "string", label: "Link", section: "content" },
      target: {
        kind: "enum",
        label: "Target",
        section: "content",
        options: [
          { value: "_self", label: "Self" },
          { value: "_blank", label: "Blank" },
        ],
      },
      isSelected: {
        kind: "boolean",
        label: "Selected",
        section: "state",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};

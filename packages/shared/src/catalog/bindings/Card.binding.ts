import type { PrimitiveBinding } from "../types";

/**
 * Card — 카드 컨테이너. S2 `Card` 구조 (`react-spectrum.adobe.com/Card`) — `Card > CardPreview +
 * Content (Text[slot=title] + Text[slot=description] + 자유 내용) + Footer`. RAC/starter 에 `Card`
 * 컴포넌트 없음(S2 전용). origin template 이 세 영역 노드를 둔다 (reusableOriginLibrary.ts).
 *
 * **ADR-256 Phase 10 (2026-10-11, 사용자 결정 「S2 그대로」)**: CardHeader 삭제 · title /
 *   description prop 삭제 — S2 Card 처럼 제목 · 설명은 Content 안 Text 노드의 글자다 (Card 가 S2 의
 *   `TextContext` slot `title` · `description` 을 준다 — delegatedDom `card`). 글자 모양 (size 별
 *   글꼴 · 간격) 은 Card rule 의 `staticSelectors` · `sizeSelectors` (S2 `Card.tsx` title ·
 *   description · content 값).
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
 * **DOM = `CATALOG_DELEGATED_DOM.card` (delegatedDom.tsx)**: shared `Card.tsx` 에 variant/size/상태를
 *   넘기고 자식 노드를 순서대로 그 안에 그린다.
 *
 * D1: composition `<div>` (internal source, shared `Card.tsx`).
 * D2: variant/size/accentColor + interaction(href/target) + 상태 편집 surface (S2 Card 에 title prop 없음).
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
        default: "M",
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

import type { PrimitiveBinding } from "../types";

/**
 * Card — 카드 컨테이너 (CardPreview / CardHeader / CardContent / CardFooter 슬롯 묶음).
 * composition 자체 추상 + S2 참조(`react-spectrum.adobe.com/Card`) — RAC/starter 에 `Card`
 * 컴포넌트 없음(S2 전용). Card factory(`LayoutComponents.ts`)가 자식 4 슬롯을 자동 생성한다.
 *
 * **ADR-912 R6 (Card 본체 S2 재설계 catalog cutover, 2026-06-15)**:
 *   구 `Card.spec.ts`(render.shapes: bg roundRect + isSelected 2px accent border, skipCSSGeneration:
 *   false → 자체 generated/Card.css)는 비표준 자체 변형이었다 — `cardType`(default/asset/user/
 *   product) + `isQuiet` boolean 분기는 S2 정본(variant=primary/secondary/tertiary/quiet)을 따르지
 *   않았고, isQuiet boolean·isSelected boolean 시각 분기는 catalog rule 의 2축(fillStyle×state)으로
 *   표현 불가했다. **제거 → S2 variant 모델로 재생성**(R2 TreeItem 패턴: "복잡하면 제거 → 레퍼런스로
 *   새로, 그게 catalog 에 더 맞다"). isQuiet → `variant: "quiet"`(base transparent) 흡수,
 *   isSelected → RAC `[data-selected]` → `fill.default.selected` + `selectedBorder: accent` 토큰.
 *   시각 source = `COMPONENT_RULES_TABLE.Card`(variants 4종 fill + sizes) + buildCatalogShapes
 *   generic box shell. catalog rule schema 는 variants×fill 2축으로 4 variant 를 확장 없이 표현
 *   (ToggleButton 선례 동형).
 *
 * **시각 = generic shell(자식이 내용 렌더) + factory props.style layout**: Card 는 컨테이너이므로
 *   buildCatalogShapes 가 `_hasChildren` shell(bg roundRect + variant border 만, 자식 Element 가
 *   header/content/footer 시각 담당)을 그린다. quiet variant 는 base transparent → hover 시만 배경.
 *   container layout(`display:flex` / `flexDirection` / `gap` / `padding` / `width`)은 factory
 *   `props.style` SSOT(ADR-907 Layer B, Skia/Taffy 직접 read).
 *
 * **propagation 보존**: 구 Card.spec 의 5 규칙(title → CardHeader.Heading.children / description →
 *   CardContent.Description.children / size → CardHeader·CardContent·CardFooter)은 spec 삭제 대비
 *   `propagationRegistry.ts` 인라인 propagation-only spec(cardPropagationSpec)으로 보존 — catalog 는
 *   propagation 표현 수단이 없으므로(ComponentRule/PrimitiveBinding 에 parentProp 필드 없음) builder
 *   runtime 의 propagationRegistry 가 유일 경로(자식 CardHeader/CardContent propagation-only spec 동형).
 *
 * **DOM parity**: INTERNAL_RENDERERS 미등록 → CanonicalNodeRenderer generic fallback.
 *   isSpecOrCatalogBacked(spec || isCatalogCutover) 가 catalog 등록 후 true → `react-aria-Card`
 *   className + `data-variant` / `data-size` 보존. generated/Card.css 는 rule virtual input 으로
 *   재생성(generate-css TEXT_LEAF_META).
 *
 * D1: composition `<div>` (internal source, generic DOM). selectable 시 role/tabIndex 는 D2 prop.
 * D2: content(title/description/footer) + variant/size + interaction(href/selectable) 편집 surface.
 * D3: 시각(variant 별 배경/테두리 + radius)은 theme rule(COMPONENT_RULES_TABLE.Card). Skia generic
 *     box shell ↔ DOM `react-aria-Card[data-variant]` 시각 대칭.
 */
export const cardBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    // 2026-06-24: "div" generic → "card" 고유 renderer id. Card 는 self-compose(renderCard 가
    //   childrenByParent 로 CardPreview/Header/Content/Footer 슬롯 합성, hasStructuralChildren 분기)
    //   라 DELEGATING_INTERNAL 경로(flattenNodeChildrenByParent 보강)가 필수다. "div" 는 다른 단순
    //   컨테이너와 공유돼 DELEGATING 에 넣을 수 없어 고유 id 필요. disclosuregroup/nav 선례 동형.
    renderer: "card",
  },
  props: {
    accepts: {
      // content — propagation 으로 자식 슬롯에 주입(title→Heading, description→Description).
      title: { kind: "string", label: "Title", section: "content" },
      description: {
        kind: "string",
        label: "Description",
        section: "content",
      },
      footer: { kind: "string", label: "Footer", section: "content" },
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
      orientation: {
        kind: "enum",
        label: "Orientation",
        section: "appearance",
        default: "vertical",
        options: [
          { value: "vertical", label: "Vertical" },
          { value: "horizontal", label: "Horizontal" },
        ],
      },
      // live consumer: LayoutRenderers.tsx renderCard line 254/291 (data-accent attr)
      accentColor: {
        kind: "string",
        label: "Accent Color",
        section: "appearance",
      },
      // interactions / state
      href: { kind: "string", label: "Link", section: "state" },
      target: {
        kind: "enum",
        label: "Target",
        section: "state",
        options: [
          { value: "_self", label: "Self" },
          { value: "_blank", label: "Blank" },
        ],
      },
      isSelectable: {
        kind: "boolean",
        label: "Selectable",
        section: "state",
      },
      isSelected: {
        kind: "boolean",
        label: "Selected",
        section: "state",
        visibleWhen: { key: "isSelectable", equals: true },
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};

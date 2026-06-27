import type { PrimitiveBinding } from "../types";

/**
 * CardView — Card 그리드/워터폴 컬렉션 레이아웃 컨테이너 (Card 자식 묶음). composition 자체 추상
 * + S2 참조(`react-spectrum.adobe.com/CardView`) — RAC/starter 에 `CardView` 없음(S2 전용).
 * factory(`DisplayComponents.ts::createCardViewDefinition`)가 자식 Card×3 을 자동 생성한다.
 *
 * **ADR-912 R7 G1-b (container shell catalog cutover, 2026-06-15)**:
 *   구 `CardView.spec.ts`(render.shapes=`()=>[]` 투명 컨테이너, skipCSSGeneration:false → 자체
 *   generated/CardView.css)는 시각 분기가 없는 빈 셸이었다(AvatarGroup R7 G1-a 동형). generate-css
 *   virtual 전환으로 DOM CSS source 를 `COMPONENT_RULES_TABLE.CardView`(variant transparent + sizes
 *   sm/md/lg)로 이전했고, 본 catalog 등록으로 Skia 시각도 buildCatalogShapes generic box shell 로
 *   이전하여 spec 의존을 끊는다.
 *
 * **시각 = generic shell(자식 Card 가 내용 렌더) + factory props.style layout**: container layout
 *   (`display:flex` / `flexWrap:wrap` / `gap` / `width`)은 factory `props.style` SSOT(ADR-907 Layer B,
 *   Skia/Taffy 직접 read). catalog rule.sizes 는 gap 미보유 — virtual CSS 에서 size별 gap 미emit 가
 *   정본(container gap 은 factory `CardView.props.style.gap` SSOT). renderCardView 가 gap 을 inline
 *   style 로 적용 → generated CSS gap 은 `@layer` 라 inline 에 덮여 dead 였음 → 시각 손실 0.
 *
 * **DOM 렌더 = renderCardView self-compose 위임 (2026-06-27)**: factory 가 자식 Card×3 을 생성하므로
 *   CardView 는 자식을 렌더하는 self-compose 컨테이너다. renderCardView 가 `context.childrenByParent`
 *   로 자식 Card 를 flex grid 안에 `children.map(renderElement)` 렌더한다. 따라서 `renderer:"div"`
 *   generic fallback 으로 두면 DELEGATING_INTERNAL_RENDERERS 매칭(renderer 기준)을 못 타 generic
 *   fall-through 로 빠지고, flattenNodeChildrenByParent 보강을 못 받아 자식 Card 가 통째 미렌더된다
 *   (Preview 빈 div, Skia 는 자식 직접 렌더 → 비대칭). ButtonGroup/TableView/AvatarGroup 동형 — 고유
 *   renderer id(`"cardview"`) + renderFacetDeclaration delegating-internal 등록으로 renderCardView 위임 활성화.
 *   isSpecOrCatalogBacked + `react-aria-CardView` className + `data-size` 보존 → generated CSS 매칭 불변.
 *
 * D1: composition `<div>` (internal source, generic DOM). role="grid" 는 D2 prop(staticAttrs 미사용 —
 *     factory/renderer 가 부여).
 * D2: layout/variant/size/density/columns/gap(appearance) + selectionMode/selectionStyle(state) surface.
 * D3: 시각(variant transparent + radius 0)은 theme rule(COMPONENT_RULES_TABLE.CardView).
 *     Skia generic box shell ↔ DOM `react-aria-CardView[data-size]` 시각 대칭.
 */
export const cardViewBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    // 2026-06-27: "div" → "cardview". factory 가 자식 Card×3 을 생성하고 renderCardView 가
    //   context.childrenByParent 로 그 자식을 flex grid 안에 렌더하는 self-compose 컨테이너다(ButtonGroup/
    //   TableView/AvatarGroup 동형). renderer:"div" 는 DELEGATING_INTERNAL_RENDERERS 매칭(renderer 기준)을
    //   못 타 generic fall-through 로 빠지고 flattenNodeChildrenByParent 보강을 못 받아 자식 Card 미렌더
    //   (Skia 비대칭). 고유 renderer id + renderFacetDeclaration delegating-internal 등록으로 위임 활성화.
    renderer: "cardview",
  },
  props: {
    accepts: {
      layout: {
        kind: "enum",
        label: "Layout",
        section: "appearance",
        default: "grid",
        options: [
          { value: "grid", label: "Grid" },
          { value: "waterfall", label: "Waterfall" },
        ],
      },
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "default",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      density: {
        kind: "enum",
        label: "Density",
        section: "appearance",
        default: "regular",
        options: [
          { value: "compact", label: "Compact" },
          { value: "regular", label: "Regular" },
          { value: "spacious", label: "Spacious" },
        ],
      },
      columns: {
        kind: "number",
        label: "Columns",
        section: "appearance",
        default: 3,
      },
      gap: {
        kind: "number",
        label: "Gap",
        section: "appearance",
        default: 16,
      },
      selectionMode: {
        kind: "enum",
        label: "Selection Mode",
        section: "state",
        default: "none",
        options: [
          { value: "none", label: "None" },
          { value: "single", label: "Single" },
          { value: "multiple", label: "Multiple" },
        ],
      },
      selectionStyle: {
        kind: "enum",
        label: "Selection Style",
        section: "state",
        default: "checkbox",
        options: [
          { value: "checkbox", label: "Checkbox" },
          { value: "highlight", label: "Highlight" },
        ],
      },
    },
    toRacProps: "default",
  },
};

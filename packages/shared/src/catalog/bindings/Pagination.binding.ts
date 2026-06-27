import type { PrimitiveBinding } from "../types";

/**
 * Pagination — 페이지네이션 컨테이너 (이전/페이지 N개/다음 Button 묶음). composition 자체 추상.
 * factory(`NavigationComponents.ts::createPaginationDefinition`)가 자식 Button×5(←/1/2/3/→)를
 * 자동 생성한다 → 런타임은 항상 `_hasChildren=true`.
 *
 * **ADR-912 R7 G1-c (container shell catalog cutover, 2026-06-15)**:
 *   구 `Pagination.spec.ts`의 `render.shapes` 는 `_hasChildren=false` 분기에서 prev/page-button N개/
 *   next + 텍스트를 standalone 으로 그렸으나, factory 가 자식 Button 5개를 자동 생성하므로 런타임
 *   경로는 항상 `_hasChildren=true` → 컨테이너 box(flex row)만 live, standalone 버튼군은 dead.
 *   AvatarGroup/CardView/TableView(R7 G1-a/b) box-only shell 과 동형. generate-css virtual 전환으로
 *   DOM CSS source 를 `COMPONENT_RULES_TABLE.Pagination`(variant default/accent + sizes sm/md/lg)로
 *   이전, 본 catalog 등록으로 Skia 시각도 buildCatalogShapes generic box shell 로 이전한다.
 *
 * **staticSelectors 보존**: 구 spec 의 `composition.staticSelectors` 7개(.pagination-controls /
 *   .pagination-info / .pagination-ellipsis / .react-aria-Button[data-current] 활성 페이지 강조 등)는
 *   자식 Button 대상 descendant CSS 라 box shell 만으로는 누락된다 → generate-css `TEXT_LEAF_META`
 *   의 `composition.staticSelectors` 메타로 전달(Link `composition.rootSelectors` 선례 동형) → CSSGenerator
 *   가 그대로 emit. virtual CSS = 구 generated/Pagination.css 와 시각 동일.
 *
 * **시각 = generic shell(자식 Button 이 페이지 버튼 렌더) + factory props.style layout**: container
 *   layout(`display:flex` / `flexDirection:row` / `alignItems:center` / `gap:6`)은 factory `props.style`
 *   SSOT(ADR-907 Layer B, Skia/Taffy 직접 read). catalog rule.sizes 는 gap 미보유 — container gap 은
 *   factory `Pagination.props.style.gap` SSOT.
 *
 * **DOM 렌더 = renderPagination self-compose 위임 (2026-06-27)**: factory 가 자식 Button×5(←/1/2/3/→)를
 *   생성하므로 Pagination 은 자식을 렌더하는 self-compose 컨테이너다. renderPagination 이
 *   `context.childrenByParent` 로 자식 Button 을 `<nav>` 안에 `children.map(renderElement)` 렌더한다.
 *   따라서 `renderer:"div"` generic fallback 으로 두면 DELEGATING_INTERNAL_RENDERERS 매칭(renderer 기준)을
 *   못 타 generic fall-through 로 빠지고, flattenNodeChildrenByParent 보강을 못 받아 자식 Button 이 통째
 *   미렌더된다(Preview 빈 nav, Skia 는 자식 직접 렌더 → 비대칭). ButtonGroup/TableView/AvatarGroup/CardView
 *   동형 — 고유 renderer id(`"pagination"`) + renderFacetDeclaration delegating-internal 등록으로 위임 활성화.
 *   isSpecOrCatalogBacked + `react-aria-Pagination` className + `data-size` 보존 → generated CSS 매칭 불변.
 *
 * D1: composition `<nav>` (internal source, generic DOM). role="navigation" / aria-label="Pagination"
 *     은 D2 prop(factory/renderer 가 부여).
 * D2: variant/size(appearance) + totalPages/currentPage(content) surface.
 * D3: 시각(variant fill + radius)은 theme rule(COMPONENT_RULES_TABLE.Pagination).
 *     Skia generic box shell ↔ DOM `react-aria-Pagination[data-size]` 시각 대칭.
 */
export const paginationBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    // 2026-06-27: "div" → "pagination". factory 가 자식 Button×5(←/1/2/3/→)를 생성하고 renderPagination 이
    //   context.childrenByParent 로 그 자식을 <nav> 안에 렌더하는 self-compose 컨테이너다(ButtonGroup/
    //   TableView/AvatarGroup/CardView 동형). renderer:"div" 는 DELEGATING_INTERNAL_RENDERERS 매칭(renderer
    //   기준)을 못 타 generic fall-through 로 빠지고 flattenNodeChildrenByParent 보강을 못 받아 자식 Button
    //   미렌더(Skia 비대칭). 고유 renderer id + renderFacetDeclaration delegating-internal 등록으로 위임 활성화.
    //   D1 nav semantic(role="navigation"/aria-label)은 renderPagination + generated CSS 가 부여.
    renderer: "pagination",
  },
  props: {
    accepts: {
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
      totalPages: {
        kind: "number",
        label: "Total Pages",
        section: "content",
        default: 5,
      },
      currentPage: {
        kind: "number",
        label: "Current Page",
        section: "content",
        default: 1,
      },
    },
    toRacProps: "default",
  },
};

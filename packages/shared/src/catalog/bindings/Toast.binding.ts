import type { PrimitiveBinding } from "../types";

/**
 * Toast — 토스트 알림 컨테이너 (Heading + Description 자식). composition 자체 추상 (RAC Toast 는
 * imperative API — useToast/ToastProvider). factory(`FormComponents.ts::createToastDefinition`)가
 * 자식 Heading + Description 을 자동 생성한다 → 런타임은 항상 `_hasChildren=true` (box-shell,
 * Pagination/CardView 동형).
 *
 * **ADR-912 R7 G1-c (container shell catalog cutover, 2026-06-15)**:
 *   구 `Toast.spec.ts`의 `render.shapes` 는 bg roundRect + border + 메시지 text 를 그렸으나, factory
 *   가 Heading/Description 자식을 자동 생성하므로 런타임 경로는 항상 `_hasChildren=true` → 컨테이너
 *   box(bg+border)만 live, standalone 메시지 text 는 dead. AvatarGroup/CardView/TableView/Pagination
 *   box-shell 과 동형 — 순수 box-shell(escape 불필요). bg/border = buildCatalogShapes(variant fill +
 *   colors.border, COMPONENT_RULES_TABLE.Toast).
 *
 * **좌측 accent bar 제거 (RAC 정본 정렬, 사용자 결정 2026-06-15)**: 구 Toast.spec.render.shapes 의
 *   좌측 accent bar(rect 3px)는 RAC 공식 Toast(react-aria.adobe.com/Toast — flex+center+gap+단색
 *   배경+close 버튼, accent bar 없음) 미준수 자체 변형이었다(feedback-catalog-unrepresentable-is-
 *   nonstandard-variant). cutover 시 Skia/DOM 양쪽에서 제거 → 순수 box-shell. (variant 4종/close
 *   버튼/flex center 등 추가 RAC 정합은 surface 최소화로 별도 이슈 — 본 cutover scope 외.)
 *
 * **시각 = generic box shell(bg+border) + 자식 Heading/Description text**: container layout
 *   (`display:flex` / `flexDirection:column` / `gap:4` / `padding`)은 factory `props.style` SSOT
 *   (ADR-907 Layer B, Skia/Taffy 직접 read).
 *
 * **DOM 렌더 = renderToast self-compose 위임 (2026-06-27)**: Toast 는 dedicated renderer
 *   `renderToast`(LayoutRenderers.tsx)가 `<div role="alert">` + 자식 + `data-variant`/`data-position`
 *   을 렌더하는데, factory 가 자식 Heading/Description 을 생성하고 renderToast 가
 *   `context.childrenByParent` 로 그 자식을 렌더하는 self-compose 컨테이너다. 따라서 `renderer:"div"`
 *   로 두면 DELEGATING_INTERNAL_RENDERERS 매칭(renderer 기준)을 못 타 generic fall-through 로 빠지고,
 *   flattenNodeChildrenByParent 보강을 못 받아 childrenByParent 가 비어 자식 Heading/Description 이 통째
 *   미렌더된다(Skia 는 자식 직접 렌더 → 비대칭). ButtonGroup/Pagination 동형 — 고유 renderer id
 *   (`"toast"`) + renderFacetDeclaration delegating-internal 등록으로 renderToast 위임 활성화. (Toast 는
 *   palette 미노출 imperative 알림이라 즉시 발현 빈도는 낮으나 imperative/AI/import element 생성 + 향후
 *   palette 노출 대비 선제 등록 + 6종 동형 일관성.) className 은 isSpecOrCatalogBacked 가 `react-aria-Toast`
 *   부여 → generated CSS(Toast.css, variant fill) 매칭.
 *
 * D1: composition `<div role="alert">` (internal source, dedicated renderToast). aria-live 등은 renderer 부여.
 * D2: variant/size(appearance) + defaultTitle/defaultDescription/timeout(content) surface.
 * D3: 시각(variant fill + border + radius)은 theme rule(COMPONENT_RULES_TABLE.Toast).
 *     Skia generic box shell ↔ DOM `react-aria-Toast[data-variant]` 시각 대칭.
 */
export const toastBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    // 2026-06-27: "div" → "toast". factory 가 자식 Heading/Description 을 생성하고 renderToast 가
    //   context.childrenByParent 로 그 자식을 <div role="alert"> 안에 렌더하는 self-compose 컨테이너다
    //   (ButtonGroup/Pagination 동형). renderer:"div" 는 DELEGATING_INTERNAL_RENDERERS 매칭(renderer
    //   기준)을 못 타 generic fall-through 로 빠지고 flattenNodeChildrenByParent 보강을 못 받아 자식
    //   Heading/Description 미렌더(Skia 비대칭). 고유 renderer id + renderFacetDeclaration delegating-
    //   internal 등록으로 위임 활성화. D1 alert semantic(role="alert"/aria-live)은 renderToast 가 부여.
    renderer: "toast",
  },
  props: {
    accepts: {
      defaultTitle: {
        kind: "string",
        label: "Default Title",
        section: "content",
      },
      defaultDescription: {
        kind: "string",
        label: "Default Description",
        section: "content",
      },
      timeout: {
        kind: "number",
        label: "Default Timeout (ms)",
        section: "content",
        default: 5000,
      },
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "info",
      },
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

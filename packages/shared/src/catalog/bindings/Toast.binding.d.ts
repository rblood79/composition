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
 * **DOM parity**: Toast 는 dedicated renderer `renderToast`(LayoutRenderers.tsx:1132)가 `<div
 *   role="alert">` + 자식 + `data-variant`/`data-position` 을 렌더(Pagination renderPagination 동형).
 *   className 은 isSpecOrCatalogBacked(catalog 등록 후 true) 경로가 `react-aria-Toast` 부여 → generated
 *   CSS(Toast.css, variant fill) 매칭.
 *
 * D1: composition `<div role="alert">` (internal source, dedicated renderToast). aria-live 등은 renderer 부여.
 * D2: variant/size(appearance) + defaultTitle/defaultDescription/timeout(content) surface.
 * D3: 시각(variant fill + border + radius)은 theme rule(COMPONENT_RULES_TABLE.Toast).
 *     Skia generic box shell ↔ DOM `react-aria-Toast[data-variant]` 시각 대칭.
 */
export declare const toastBinding: PrimitiveBinding;
//# sourceMappingURL=Toast.binding.d.ts.map
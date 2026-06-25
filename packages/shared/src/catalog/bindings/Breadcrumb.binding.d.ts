import type { PrimitiveBinding } from "../types";
/**
 * Breadcrumb — Breadcrumbs projection 의 단일 경로 조각 (라벨 + separator).
 *
 * **ADR-912 projection 3 cutover (2026-06-15, Pattern B + replace escape)**: Breadcrumb 은 catalog
 *   미등록 상태에서 `Breadcrumb.spec.render.shapes`(라벨 text + 비-마지막 separator › text)가 Skia
 *   시각 유일 source 였다. catalog 등록으로 rule(`COMPONENT_RULES_TABLE.Breadcrumb`: variants.default
 *   base fill + colors.text/textHover + sizes.{fontSize/height/borderRadius}) + `breadcrumb_crumb`
 *   skiaPrimitive(replace, label+separator 위치 누적)으로 이전.
 *   - label/separator text 위치가 label 폭만큼 우측 누적이라 buildCatalogShapes single-text(좌측
 *     고정) 가정과 충돌 → replace 로 escape 가 자체 생성(spec 좌표 공식 1:1).
 *   - isLast(→accent fw600) / separator(›)는 `_isLast`/`_separator` 데이터 분기(appendBreadcrumbRow
 *     Projection 주입). 컴포넌트 식별 분기 0(ADR-142 §3).
 *
 * **Skia = breadcrumb_crumb replace**: Breadcrumb 은 render-space projection 노드
 *   (appendBreadcrumbRowProjection → type:"Breadcrumb" SceneNode)다. buildSpecNodeData 가
 *   `isCatalogCutover("Breadcrumb")` → breadcrumb_crumb replace(box 미생성, label+separator 만).
 *
 * **DOM = 부모 Breadcrumbs self-compose (독립 노드 0)**: renderBreadcrumbs(RAC `<Breadcrumbs>
 *   <Breadcrumb><Link>`)가 합성. canonical 문서에 Breadcrumb element 가 없다(Breadcrumbs.props.items
 *   직접 → projection 전용 런타임 SceneNode) → DOM 변화 0. 발효 가치는 Skia 대칭 한정.
 *
 * D1: composition — DOM 은 RAC `<Breadcrumbs>`/`<Breadcrumb>`/`<Link>` 이 self-compose +
 *     ARIA(role=listitem, aria-current). RAC D1/ARIA 권위 보존.
 * D2: children(label) + href + size 편집 surface.
 * D3: 시각(라벨 색/크기/굵기 + separator)은 theme rule + breadcrumb_crumb escape.
 *     Skia escape ↔ DOM RAC self-compose 시각 대칭.
 *
 * source.renderer "breadcrumb" 은 DOM 에서 호출되지 않는다(부모 Breadcrumbs self-compose) —
 * primitiveEntry 의 getPrimitiveBinding 타입 계약 충족용. canonical Breadcrumb element 가 없어
 * DELEGATING 등록 불요.
 */
export declare const breadcrumbBinding: PrimitiveBinding;
//# sourceMappingURL=Breadcrumb.binding.d.ts.map
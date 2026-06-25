/**
 * ADR-142 family ④(collections) — Breadcrumbs primitive 의 `PrimitiveBinding`.
 *
 * composition wrapper(`Breadcrumbs.tsx`)가 useResolvedCollectionItems(dataBinding/items →
 * crumb rows)로 채우고 RAC Breadcrumbs + Breadcrumb/Link 합성(internal source, delegating
 * renderBreadcrumbs). Skia generic 발효 — appendBreadcrumbRowProjection 이 Breadcrumbs.props.items
 * 를 직접 읽어 crumb projection 노드 전개(ADR-912 영역 B (A)).
 *
 * **Tag/Tab 과 차이**: 중간 컨테이너 없음(Breadcrumbs→Breadcrumb 1단 직접) → propagation 불요.
 *   crumb 시각은 generic box+text 아니라 Breadcrumb.spec.render.shapes 유지(separator/isLast 로직).
 */
import type { PrimitiveBinding } from "../types";
export declare const breadcrumbsBinding: PrimitiveBinding;
//# sourceMappingURL=Breadcrumbs.binding.d.ts.map
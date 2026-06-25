/**
 * ADR-142 family ①(primitives/actions) — Badge leaf primitive 의 `PrimitiveBinding`.
 *
 * Badge 는 RAC controller 가 없는 composition 내부 leaf — `<span data-variant data-size
 * data-fill-style>text</span>`(Badge.tsx:78-93). 실측상 **조립이 아닌 styled box+text leaf**
 * (Badge.spec archetype:"simple", roundRect+text — Button 과 동일 모델). inventory §3 의
 * "composed/reusable" 분류 근거('Skeleton 합성')는 isLoading 조건부 대체일 뿐 조립 아님 →
 * 실측 우선(precision)으로 leaf 처리. Icon 에 이은 두 번째 `internal` source.
 *
 * D1: composition 내부 `<span>` (RAC primitive 아님 — internal source).
 * D2: children/variant/fillStyle(bold·subtle·outline)/size/isDot/isPulsing 편집 surface.
 * D3: 시각(배경/텍스트)은 theme/tokens data-* rules. Skia 는 buildCatalogShapes box+text.
 */
import type { PrimitiveBinding } from "../types";
export declare const badgeBinding: PrimitiveBinding;
//# sourceMappingURL=Badge.binding.d.ts.map
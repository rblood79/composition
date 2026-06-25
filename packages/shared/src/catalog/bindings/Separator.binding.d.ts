/**
 * ADR-142 family ①(primitives/actions) — Separator leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * Separator 는 순수 box leaf(divider) — children/icon 합성 없음. R4 특수 shape(arc/track/
 * wheel) 무관. de-risk 파일럿: box leaf 의 binding + generic 4경로 패턴 확립용.
 *
 * D1: RAC `Separator` 가 `<hr role="separator" aria-orientation>` 를 emit(orientation
 *     prop → aria-orientation 자동, RAC 권위). 본 binding 은 orientation 을 RAC props 로 통과.
 * D2: variant(7종)/size(sm·md·lg)/orientation 이 편집 surface.
 * D3: 시각(선 색/두께)은 theme/tokens data-* rules — variant/size 는 data-* 라우팅(toRacProps).
 *     선은 box+text 가 아닌 비-DOM-trivial primitive → Skia 는 `skiaPrimitive: "divider"`
 *     draw module(renderers/skiaPrimitives.ts)이 선색으로 채운 얇은 rect 로 그린다.
 */
import type { PrimitiveBinding } from "../types";
export declare const separatorBinding: PrimitiveBinding;
//# sourceMappingURL=Separator.binding.d.ts.map
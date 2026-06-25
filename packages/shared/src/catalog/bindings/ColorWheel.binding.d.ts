/**
 * ADR-142/912 — ColorWheel leaf RAC primitive 의 `PrimitiveBinding` (box-only cutover).
 *
 * 사용자 방침(2026-06-11): Color 계열은 빌더 완성 후 제일 나중에 ProgressCircle 구조로 진짜 구현
 * (react-aria.adobe.com/ColorWheel 레퍼런스). 지금은 spec 제거 + catalog cutover 등록(6 registry
 * collapse)을 위해 box 영역만 등록한다.
 *
 * D1: RAC `<ColorWheel outerRadius innerRadius>` + `<ColorWheelTrack>` + `<ColorThumb>` (원형 hue 휠).
 * D3: box-only — 원형 wheel / track / thumb 는 generic buildCatalogShapes(box)로 재현 안 함
 *     (의도적 손실). 후속 작업에서 ProgressCircle 류 arc 구조로 복원.
 */
import type { PrimitiveBinding } from "../types";
export declare const colorWheelBinding: PrimitiveBinding;
//# sourceMappingURL=ColorWheel.binding.d.ts.map
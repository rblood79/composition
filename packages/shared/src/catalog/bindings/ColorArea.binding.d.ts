/**
 * ADR-142/912 — ColorArea leaf RAC primitive 의 `PrimitiveBinding` (box-only cutover).
 *
 * 사용자 방침(2026-06-11): Color 계열은 빌더 완성 후 제일 나중에 ProgressCircle 구조로 진짜 구현.
 * 지금은 spec 제거 + catalog cutover 등록(6 registry collapse)을 위해 box 영역만 등록한다.
 *
 * D1: RAC `<ColorArea>` + `<ColorThumb>` (2D gradient + thumb).
 * D3: box-only — 2D gradient / thumb 는 generic buildCatalogShapes(box)로 재현 안 함(의도적 손실).
 */
import type { PrimitiveBinding } from "../types";
export declare const colorAreaBinding: PrimitiveBinding;
//# sourceMappingURL=ColorArea.binding.d.ts.map
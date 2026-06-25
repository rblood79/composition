/**
 * ADR-142 family ⑥(overlays) — Popover primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) primitive. composition wrapper(`Popover.tsx`)가 RAC Popover + OverlayArrow
 * 합성(internal source). 자식 Heading/Description 은 canonical children(SHELL_ONLY).
 *
 * **Skia generic 발효 (ADR-142 Inc3, 2026-06-01)**: bg/border 는 buildCatalogShapes(box+text)가
 * variant fill(`{color.layer-2}`)로 그리고, drop shadow + V-arrow 는 skiaPrimitive draw module
 * (`popover_shadow` prepend / `popover_arrow` append)로 합성한다. arrow 는 `!props.showArrow`
 * 일 때 표시(기본). 값은 module 내부 상수 — spec runtime 참조 0(#8).
 */
import type { PrimitiveBinding } from "../types";
export declare const popoverBinding: PrimitiveBinding;
//# sourceMappingURL=Popover.binding.d.ts.map
/**
 * ADR-142 family ⑥(overlays) — Modal primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) primitive. composition wrapper(`Modal.tsx`)가 RAC ModalOverlay/Modal +
 * focus trap 합성(internal source). 자식(Dialog 등)은 canonical children.
 *
 * **Skia generic 발효 (ADR-142 Inc3, 2026-06-01)**: render.shapes=[] (portal 시각 없음).
 * buildCatalogShapes 가 variant fill transparent shell 만 그림 — 시각 무해(안 보임), legacy []
 * 와 시각 동일. backdrop 은 ModalOverlay 가 별도 담당 → skiaPrimitive 불필요.
 */
import type { PrimitiveBinding } from "../types";
export declare const modalBinding: PrimitiveBinding;
//# sourceMappingURL=Modal.binding.d.ts.map
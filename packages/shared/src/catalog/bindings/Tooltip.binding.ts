/**
 * ADR-142 family ⑥(overlays) — Tooltip primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) primitive. composition wrapper(`Tooltip.tsx`)가 RAC Tooltip + OverlayArrow(svg)
 * 합성(internal source). 자식 Description 은 canonical children(SHELL_ONLY). bg+text 는
 * buildCatalogShapes generic, arrow(showArrow=true 시) 는 `tooltip_arrow` skiaPrimitive(append)
 * 로 재현(ADR-912 단계 5 (1b) — skiaLegacy 제거).
 */

import type { PrimitiveBinding } from "../types";

export const tooltipBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "tooltip",
  },
  // ADR-912 단계 5 (1b): bg+text 는 buildCatalogShapes generic, V-arrow(showArrow=true 한정)는
  // tooltip_arrow skiaPrimitive(append) 합성. showArrow 미설정 시 draw fn 이 null → arrow 미렌더.
  skiaPrimitive: "tooltip_arrow",
  props: {
    accepts: {
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

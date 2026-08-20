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
      // design-data 감사 (2026-08-20): D3 rules table 에 variants 4종
      //   (neutral/info/positive/negative) + generated CSS `[data-variant]` 4규칙이
      //   이미 있고 renderTooltip 도 `data-variant` 를 emit 하는데, accepts 선언만
      //   없어 프로퍼티 패널에서 편집 불가였다 (D2 표면 단절). Spectrum tooltip 은
      //   variant 를 정식 옵션으로 규정 (dd neutral/informative/negative + RSP variant).
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "neutral",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): renderTooltip 기소비 —
      //   RAC Tooltip 공식 배치 prop (placement/offset/crossOffset/shouldFlip/containerPadding).
      placement: {
        kind: "enum",
        label: "Placement",
        section: "appearance",
        options: [
          { value: "top", label: "Top" },
          { value: "bottom", label: "Bottom" },
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
          { value: "top start", label: "Top Start" },
          { value: "top end", label: "Top End" },
          { value: "bottom start", label: "Bottom Start" },
          { value: "bottom end", label: "Bottom End" },
        ],
      },
      offset: { kind: "number", label: "Offset", section: "appearance" },
      crossOffset: {
        kind: "number",
        label: "Cross Offset",
        section: "appearance",
      },
      shouldFlip: {
        kind: "boolean",
        label: "Should Flip",
        section: "appearance",
        default: true,
      },
      containerPadding: {
        kind: "number",
        label: "Container Padding",
        section: "appearance",
      },
    },
    toRacProps: "default",
  },
};

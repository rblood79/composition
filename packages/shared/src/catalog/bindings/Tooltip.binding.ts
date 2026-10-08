/**
 * ADR-142 family ⑥(overlays) — Tooltip primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) primitive. composition wrapper(`Tooltip.tsx`)가 RAC Tooltip 을 그리고 자식 노드
 * (OverlayArrow · Description) 를 순서대로 담는다 (SHELL_ONLY). bg+text 는 buildCatalogShapes
 * generic. 화살표는 자식 `OverlayArrow` 노드다 (ADR-256 Phase 8a — 옛 Skia `tooltip_arrow`
 * primitive 는 뗐다: 읽던 `showArrow` 가 accepts 에 없어 Canvas 에 그려진 적이 없다).
 */

import type { PrimitiveBinding } from "../types";

export const tooltipBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "tooltip",
  },
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
        // RAC/HTML 기본과 같은 값 — 패널이 비어 보이지 않게 (2026-09-16)
        default: "top",
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
      offset: {
        kind: "number",
        // RAC/HTML 기본과 같은 값 — 패널이 비어 보이지 않게 (2026-09-16)
        default: 0,
        label: "Offset",
        section: "appearance",
      },
      crossOffset: {
        kind: "number",
        // RAC/HTML 기본과 같은 값 — 패널이 비어 보이지 않게 (2026-09-16)
        default: 0,
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
        // RAC/HTML 기본과 같은 값 — 패널이 비어 보이지 않게 (2026-09-16)
        default: 12,
        label: "Container Padding",
        section: "appearance",
      },
    },
    toRacProps: "default",
  },
};

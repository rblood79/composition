/**
 * ADR-142 family ⑥(overlays) — Tooltip primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) primitive. composition wrapper(`Tooltip.tsx`)가 RAC Tooltip 을 그리고 자식 노드
 * (OverlayArrow · Description) 를 순서대로 담는다 (`rulePaint.ts` `SHELL_ONLY_TYPES`). Canvas 상자는
 * rule(`COMPONENT_RULES_TABLE.Tooltip`). 화살표는 자식 `OverlayArrow` 노드다 (ADR-256 Phase 8a — 옛 Skia `tooltip_arrow`
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
      //   이미 있고 shared Tooltip 도 `data-variant` 를 emit 하는데, accepts 선언만
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
        default: "M",
      },
      // S2 1.8 (2026-10-14 D2 정렬): the placement props (`placement` · `offset` · `crossOffset` ·
      //   `shouldFlip` · `containerPadding`) are the TooltipTrigger's — S2 `TooltipTrigger` takes them
      //   and hands them to its Tooltip by context (shared `TooltipTrigger` → `TooltipPlacementContext`).
    },
    toRacProps: "default",
  },
};

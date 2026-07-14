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

export const popoverBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "popover",
  },
  props: {
    accepts: {
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      hideArrow: {
        kind: "boolean",
        label: "Hide Arrow",
        section: "appearance",
      },
      containFocus: {
        kind: "boolean",
        label: "Contain Focus",
        section: "state",
      },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): RAC Popover 공식 배치 prop —
      //   placement/crossOffset/shouldFlip/containerPadding 은 renderPopover 기소비,
      //   offset 은 배선 동반.
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
  // shadow(base 앞) + arrow(base 뒤) 합성. box+text 는 buildCatalogShapes 가 담당.
  skiaPrimitive: ["popover_shadow", "popover_arrow"],
};

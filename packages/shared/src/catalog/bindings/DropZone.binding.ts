/**
 * ADR-142 family ⑥(overlays) — DropZone primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) primitive. composition wrapper(`DropZone.tsx`, `INTERNAL_RENDERERS.dropzone`)가
 * RAC DropZone + label/description/drop 영역 합성(internal source). drop 시각(dashed border/hover
 * 등)은 ComponentRuleVariant 의 textWeight/borderStyle 보편 D3 속성으로 표현 → Canvas 도 같은
 * rule 로 그린다 (skiaLegacy 제거, ADR-912 단계 4).
 */

import type { PrimitiveBinding } from "../types";

export const dropZoneBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "dropzone",
  },
  props: {
    accepts: {
      label: {
        kind: "string",
        label: "Label",
        section: "content",
        default: "Drop files here",
      },
      description: {
        kind: "string",
        label: "Description",
        section: "content",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      // S2 1.8.0 DropZone `isFilled` · `replaceMessage` (2026-10-10): 채워진 영역 위로 끌 때
      //   교체 배너 (S2 `renderProps.isDropTarget && props.isFilled`). 배너는 DOM 에 상주하고
      //   RAC `data-drop-target` 시트 (rule rootSelectors) 가 끄는 동안만 보인다 — Canvas 는
      //   끄는 중 상태를 그리지 않는다.
      isFilled: { kind: "boolean", label: "Filled", section: "state" },
      replaceMessage: {
        kind: "string",
        label: "Replace Message",
        section: "content",
      },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): RAC 공식 prop — `DropZone.tsx` 가 RAC DropZone 에 넘긴다.
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};

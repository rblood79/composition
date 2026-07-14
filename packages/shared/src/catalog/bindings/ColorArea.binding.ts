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

export const colorAreaBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "ColorArea",
  },
  rac: {
    primitive: "ColorArea",
    parts: ["colorThumb"],
    slots: [],
    states: ["isDisabled"],
    renderProps: ["isDisabled"],
    dataAttributes: ["data-disabled"],
  },
  props: {
    accepts: {
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      // RAC/RSP 정합 감사 (2026-07-15) 판정: colorSpace/xChannel/yChannel 은 RAC 공식이나
      //   renderColorArea 가 정적 gradient div (실 RAC ColorArea 미사용) 라 소비 경로 부재 —
      //   dead 편집 UI 방지를 위해 미추가 (TagGroup orientation 제거와 동일 근거).
    },
    toRacProps: "default",
  },
};

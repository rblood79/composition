/**
 * ADR-142 family ①(primitives/actions) — Separator leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * Separator 는 순수 box leaf(divider) — children/icon 합성 없음. R4 특수 shape(arc/track/
 * wheel) 무관. de-risk 파일럿: box leaf 의 binding + generic 4경로 패턴 확립용.
 *
 * D1: RAC `Separator` 가 `<hr role="separator" aria-orientation>` 를 emit(orientation
 *     prop → aria-orientation 자동, RAC 권위). 본 binding 은 orientation 을 RAC props 로 통과.
 * D2: variant(7종)/size(sm·md·lg)/orientation 이 편집 surface.
 * D3: 시각(선 색/두께)은 theme/tokens data-* rules — variant/size 는 data-* 라우팅(toRacProps).
 *     선 자체는 fill.alpha:0 + border 색의 얇은 box 로, Skia 는 buildCatalogShapes 가 그린다.
 */

import type { PrimitiveBinding } from "../types";

export const separatorBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "Separator",
  },
  rac: {
    primitive: "Separator",
    parts: ["separator"],
    slots: [],
    states: [],
    renderProps: [],
    dataAttributes: [],
  },
  props: {
    accepts: {
      // RAC Separator props — orientation 은 aria-orientation 으로 RAC 가 자동 매핑(D1).
      orientation: {
        kind: "enum",
        label: "Orientation",
        section: "appearance",
        default: "horizontal",
        options: [
          { value: "horizontal", label: "Horizontal" },
          { value: "vertical", label: "Vertical" },
        ],
      },
      // 시각 차원 → data-variant / data-size (theme 가 값 집합 + 선 색/두께 제공)
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "default",
      },
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

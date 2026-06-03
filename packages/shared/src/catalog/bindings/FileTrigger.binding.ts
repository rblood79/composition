/**
 * ADR-142 family ①(primitives/actions) — FileTrigger leaf RAC primitive 의 `PrimitiveBinding`.
 * (ADR-912 단계 5 선행-1: catalog 미등록 leaf 등록 — RAC source, generic box+text 커버.)
 *
 * RAC `<FileTrigger>` 는 파일 선택 trigger wrapper(숨은 `<input type=file>` + 자식 Button).
 * composition 에서는 button-like leaf 로 렌더 — FileTrigger.spec 이 roundRect+border+text
 * (Button 동형 box+text leaf, value-dependent 시각 없음 → skiaPrimitive 불필요).
 *
 * D1: RAC `FileTrigger` → 파일 입력 trigger. RAC 가 파일 선택/접근성 권위.
 * D2: children(label text)/variant/size + acceptedFileTypes/allowsMultiple/acceptDirectory +
 *     defaultCamera + isDisabled.
 * D3: 시각(배경/테두리/텍스트)은 theme/tokens data-* rules. Skia 는 buildCatalogShapes box+text.
 */

import type { PrimitiveBinding } from "../types";

export const fileTriggerBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "FileTrigger",
  },
  rac: {
    primitive: "FileTrigger",
    parts: ["button"],
    slots: [],
    states: ["isDisabled"],
    renderProps: ["isDisabled"],
    dataAttributes: ["data-disabled"],
  },
  props: {
    accepts: {
      children: { kind: "string", label: "Text", section: "content" },
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
      allowsMultiple: {
        kind: "boolean",
        label: "Allow Multiple",
        section: "state",
      },
      acceptDirectory: {
        kind: "boolean",
        label: "Accept Directory",
        section: "state",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};

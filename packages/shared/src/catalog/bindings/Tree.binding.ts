/**
 * ADR-142 family ⑤(Tree·Table) — Tree primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. composition wrapper(`Tree.tsx`)가
 * useCollectionData(dataBinding → tree nodes, ADR-132)로 채우고 RAC Tree + TreeItem 재귀 합성
 * (internal source). 재귀 2D collection 렌더는 RAC 담당.
 *
 * **DOM-only cutover (skiaLegacy:true)**: DOM/Inspector 는 catalog generic(wrapper + nodes),
 * Skia 만 legacy render.shapes 유지(재귀 tree 렌더 Skia generic 미지원, 전 family 후 일괄).
 */

import type { PrimitiveBinding } from "../types";

export const treeBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "tree",
  },
  props: {
    accepts: {
      dataBinding: { kind: "binding", label: "Data", section: "content" },
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
      selectionMode: {
        kind: "enum",
        label: "Selection Mode",
        section: "state",
        default: "single",
        options: [
          { value: "none", label: "None" },
          { value: "single", label: "Single" },
          { value: "multiple", label: "Multiple" },
        ],
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};

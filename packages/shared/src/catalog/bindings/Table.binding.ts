/**
 * ADR-142 family ⑤(Tree·Table) — Table primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. composition wrapper(`Table.tsx`, default
 * export)가 useCollectionData(dataBinding → rows, ADR-132) + columns 로 채우고 RAC Table +
 * TableHeader/Column/Row/Cell 2D 합성(internal source). 2D collection 렌더는 RAC 담당.
 *
 * **DOM-only cutover (skiaLegacy:true)**: DOM/Inspector 는 catalog generic(wrapper + rows/columns),
 * Skia 만 legacy render.shapes 유지(2D table 렌더 Skia generic 미지원, 전 family 후 일괄).
 * columns 는 columnMapping/binding 데이터라 generic Inspector kind:"binding" 로 표현.
 */

import type { PrimitiveBinding } from "../types";

export const tableBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "table",
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
        default: "none",
        options: [
          { value: "none", label: "None" },
          { value: "single", label: "Single" },
          { value: "multiple", label: "Multiple" },
        ],
      },
    },
    toRacProps: "default",
  },
};

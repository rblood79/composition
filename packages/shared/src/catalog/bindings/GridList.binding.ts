/**
 * ADR-142 family ④(collections) — GridList primitive 의 `PrimitiveBinding`.
 *
 * composition wrapper(`GridList.tsx`)가 useCollectionData(dataBinding → items)로 채우고
 * RAC GridList + GridListItem 합성(internal source). Skia generic 발효(skiaLegacy 제거, ADR-912 단계 4 C1).
 */

import type { PrimitiveBinding } from "../types";

export const gridListBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "gridlist",
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

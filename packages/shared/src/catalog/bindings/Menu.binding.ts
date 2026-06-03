/**
 * ADR-142 family ④(collections) — Menu primitive 의 `PrimitiveBinding`.
 *
 * composition wrapper(`Menu.tsx`/MenuButton)가 useCollectionData(dataBinding → items)로 채우고
 * RAC Menu + MenuItem 합성(internal source). Skia generic 발효(skiaLegacy 제거, ADR-912 단계 4).
 */

import type { PrimitiveBinding } from "../types";

export const menuBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "menu",
  },
  props: {
    accepts: {
      dataBinding: { kind: "binding", label: "Data", section: "content" },
      label: { kind: "string", label: "Trigger Label", section: "content" },
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
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};

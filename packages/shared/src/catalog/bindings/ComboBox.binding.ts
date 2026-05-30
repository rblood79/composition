/**
 * ADR-142 family ④(collections) — ComboBox primitive 의 `PrimitiveBinding`.
 *
 * composition wrapper(`ComboBox.tsx`)가 useCollectionData(dataBinding → items)로 채우고
 * RAC ComboBox + Label/Input/Button/Popover/ListBox 합성(internal source). DOM-only(skiaLegacy:true).
 */

import type { PrimitiveBinding } from "../types";

export const comboBoxBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "combobox",
  },
  props: {
    accepts: {
      dataBinding: { kind: "binding", label: "Data", section: "content" },
      label: { kind: "string", label: "Label", section: "content" },
      description: {
        kind: "string",
        label: "Description",
        section: "content",
      },
      placeholder: {
        kind: "string",
        label: "Placeholder",
        section: "content",
      },
      iconName: { kind: "icon", label: "Icon", section: "content" },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};

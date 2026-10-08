import type { PrimitiveBinding } from "../types";

/**
 * Group — RAC `Group` (ADR-256 Phase 6a — Decision 8): a `div[role=group]` grouping related
 * controls. The reference assemblies put it around a field's control (`NumberField > Group >
 * Button + Input + Button`, ComboBox · DatePicker) and in a Table column header. Its render props
 * (`isHovered` · `isFocusWithin` · `isFocusVisible` · `isDisabled` · `isInvalid`) are a state frame
 * for the `showWhen` nodes inside.
 *
 * D1: RAC's `Group` as is (role `group` · `region` · `presentation`).
 * D2: RAC `GroupProps` — `role` · `isDisabled` · `isInvalid` · `isReadOnly`.
 * D3: no paint of its own (`COMPONENT_RULES_TABLE.Group` is a `container` — the Canvas draws no
 *     variant fill for it; `Group.css` adds none); a field's part
 *     rule gives its control box. Layout grouping is a frame, not a Group (ADR-130).
 */
export const groupBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "group",
  },
  props: {
    accepts: {
      role: {
        kind: "enum",
        label: "Role",
        section: "content",
        default: "group",
        options: [
          { value: "group", label: "Group" },
          { value: "region", label: "Region" },
          { value: "presentation", label: "Presentation" },
        ],
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isInvalid: { kind: "boolean", label: "Invalid", section: "state" },
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
    },
    toRacProps: "default",
  },
};

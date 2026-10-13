import type { PrimitiveBinding } from "../types";

/**
 * ADR-259 Phase 3 — S2 `ContextualHelp`: a quiet icon-only Button that opens a Popover of help
 * (`ContextualHelp > Button > Icon + Popover > Heading[slot=title] + Content + Footer`). The DOM is
 * RAC `DialogTrigger` (no element — S2 `ContextualHelp.tsx:195-216`); the Canvas lays it out as
 * `display: contents` and leaves its closed Popover out (`TRIGGER_OVERLAY_CHILDREN`).
 *
 * D2 (S2 1.8.0): `variant` names the help (`help` · `info` — the Button's glyph and accessible name),
 * `size` is the Button's (XS · S — inside a field's label row the field's size gives it, S2
 * `Field.tsx:182`), `isOpen` · `defaultOpen` are the DialogTrigger's. The Popover's place
 * (`placement` · `offset` · …) is the origin's, bound to its Popover node.
 */
export const contextualHelpBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "contextualhelp" },
  props: {
    accepts: {
      variant: {
        kind: "enum",
        label: "Variant",
        section: "appearance",
        default: "help",
        options: [
          { value: "help", label: "Help" },
          { value: "info", label: "Info" },
        ],
      },
      size: {
        kind: "enum",
        label: "Size",
        section: "appearance",
        default: "XS",
        options: [
          { value: "XS", label: "XS" },
          { value: "S", label: "S" },
        ],
      },
      isOpen: { kind: "boolean", label: "Open", section: "state" },
      defaultOpen: {
        kind: "boolean",
        label: "Initially Open",
        section: "state",
      },
    },
    toRacProps: "default",
  },
};

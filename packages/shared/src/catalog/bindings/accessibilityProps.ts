import type { PropContract } from "../types";

export const RAC_SLOT_PROP = {
  kind: "string",
  label: "Slot",
  section: "content",
  editorHidden: true,
} satisfies PropContract;

export const ARIA_LABELING_PROPS = {
  "aria-label": {
    kind: "string",
    label: "Accessible Label",
    section: "content",
  },
  "aria-labelledby": {
    kind: "string",
    label: "Labelled By",
    section: "content",
  },
  "aria-describedby": {
    kind: "string",
    label: "Described By",
    section: "content",
  },
  "aria-details": { kind: "string", label: "Details", section: "content" },
} satisfies Record<string, PropContract>;

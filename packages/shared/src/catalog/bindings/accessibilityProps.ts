import type { PropContract } from "../types";

export const RAC_SLOT_PROP = {
  kind: "string",
  label: "Slot",
  section: "content",
  editorHidden: true,
} satisfies PropContract;

export const ARIA_LABELING_PROPS = {
  // (Edited in the Properties Accessibility section — every type's axis; a Content field would show
  //  the same prop twice, 2026-09-15 · `contractFieldDuplicates`. It stays accepted for RAC.)
  "aria-label": {
    kind: "string",
    label: "Accessible label",
    section: "content",
    editorHidden: true,
  },
  // (2026-11-11 사용자 결정 「숨김」: developer HTML · ARIA attributes — accepted, not offered in the panel.)
  "aria-labelledby": {
    editorHidden: true,
    kind: "string",
    label: "Labelled by",
    section: "content",
  },
  "aria-describedby": {
    editorHidden: true,
    kind: "string",
    label: "Described by",
    section: "content",
  },
  "aria-details": {
    kind: "string",
    label: "Details",
    section: "content",
    editorHidden: true,
  },
} satisfies Record<string, PropContract>;

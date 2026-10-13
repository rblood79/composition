import type { PrimitiveBinding } from "../types";

/**
 * ADR-259 Phase 3 — a field's label row (S2 `FieldLabel`'s `div` — `Field.tsx:96-117`): the field's
 * Label and its ContextualHelp on one line. It takes the Label's place in the field's layout (the
 * label column of a side label, the first row of a top one — S2 gives the row `gridArea: label`), so
 * the field rule's Label placement reaches it (`catalogFieldLabelSelector` — the generated CSS and
 * the Canvas part rules). Part lookups pass through it (`PART_FRAME_TYPES`): the Label in it stays
 * the field's label (RAC Label context · necessity mark · text owner).
 *
 * D1: no role (S2's is a plain `div`). D2: no props — the field's size passes it to its Label and
 * ContextualHelp (`CATALOG_SIZE_PASS_THROUGH`). D3: the FieldLabel rule (a row, centered).
 */
export const fieldLabelBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "fieldlabel" },
  props: {
    accepts: {},
    toRacProps: "default",
  },
};

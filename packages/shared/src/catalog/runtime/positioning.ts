/**
 * ADR-275 Decision 1 — two predicates over one storage (`layout.position` + `inset*`):
 *
 * - **out of flow** (`catalogIsOutOfFlow`): the resolved box is absolute — a rule-placed part
 *   (ListBoxItem icon) as well as an authored box. Flow surfaces read this (grid auto rows ·
 *   spacing handles · track layer · sibling make-room · flow drop).
 * - **authored absolute** (`catalogIsAuthoredAbsolute`): an author placed the box (its own or a
 *   template's authored layout). Edit surfaces read this (Canvas move · Position section · paste ·
 *   align). A rule-placed part is out of flow but not authored, and its Canvas move stays refused.
 *
 * Phase 7 (사용자 결정 6): `fixed` is out of flow too, and an author-placed box — placed in the page
 * viewport, not its parent (`catalogIsAuthoredFixed`). Surfaces that move or place a box read
 * `catalogIsAuthoredPlaced` and take the containing block by kind; the parent-as-containing-block
 * surfaces (the DOM's positioned parent · align / distribute) stay absolute only.
 */
interface PositionedRecord {
  readonly layout: Readonly<Record<string, string>>;
  readonly authoredLayout?: Readonly<Record<string, string>>;
}

export const catalogIsOutOfFlow = (record: PositionedRecord): boolean =>
  record.layout.position === "absolute" || record.layout.position === "fixed";

export const catalogIsAuthoredAbsolute = (record: PositionedRecord): boolean =>
  record.authoredLayout?.position === "absolute";

export const catalogIsAuthoredFixed = (record: PositionedRecord): boolean =>
  record.authoredLayout?.position === "fixed";

export const catalogIsAuthoredPlaced = (record: PositionedRecord): boolean =>
  catalogIsAuthoredAbsolute(record) || catalogIsAuthoredFixed(record);

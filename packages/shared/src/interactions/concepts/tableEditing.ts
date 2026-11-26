import type { InteractionConcept } from "./types";

/**
 * ADR-317 Phase 4 (사용자 결정 1 「Table When 하나」) — a Table's cells written by its viewer at
 * once: a paste · a cut · a clear (「Paste」) or a fill (「Fill handle」) — the session's several-cell
 * write (`editTableCells`), one event a write. RAC's Table has no such callback (S2 TableView
 * neither — breakdown §3 F10), so the name is a composition extension its spec gives the Table's
 * RAC props (`componentInteractionSpecs.ts`). One event object: `keys` (the rows written, by item
 * key), `items` (those rows' items now — what a save sends) and `cells` (each written
 * `{key, field}`). A rule that saves them (`callEndpoint`) clears their edit marks when the server
 * takes it (사용자 결정 6 — the event carries the write's edit number, `CATALOG_EVENT_EDITS`).
 */
export const cellsChange = {
  id: "cellsChange",
  racDoc: "ADR-317 — Table 「Paste」 · 「Fill handle」 several-cell write",
  racType: "composition Table extension",
  events: ["onCellsChange"],
  argFields: true,
  args: { onCellsChange: ["keys", "items", "cells"] },
  conditions: [],
} as const satisfies InteractionConcept;

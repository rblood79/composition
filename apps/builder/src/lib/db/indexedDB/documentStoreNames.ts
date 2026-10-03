/**
 * ADR-235 — the incremental canonical document object stores (head + parts). The adapter's schema
 * creates them; the old canonical documents store (`documentsStore.legacy.ts`) reads and writes them.
 */
export const DOCUMENT_PARTS = "document_parts";
export const DOCUMENT_HEADS = "document_heads";

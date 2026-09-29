import { writeFileSync } from "node:fs";

/**
 * ADR-248 evidence files under `docs/adr/design/` (JSON records carry the HEAD they ran at, PNGs
 * the rendered legs). A plain test run only checks; `ADR248_WRITE_EVIDENCE=1` refreshes the
 * committed evidence (user decision 2026-09-30 — refresh when committing, not on every run).
 */
export const WRITE_EVIDENCE = process.env.ADR248_WRITE_EVIDENCE === "1";

export function writeEvidence(...args: Parameters<typeof writeFileSync>): void {
  if (WRITE_EVIDENCE) writeFileSync(...args);
}

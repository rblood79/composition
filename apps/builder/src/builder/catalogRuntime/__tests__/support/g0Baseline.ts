import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * ADR-248 G0 frozen old-app outputs (`docs/adr/design/248-baseline/`). They are kept local only
 * (user decision 2026-09-30 — not in the repository), so a checkout without them skips the tests
 * that compare against them instead of failing on a missing file.
 */
export const G0_BASELINE_DIR = resolve(
  process.cwd(),
  "../../docs/adr/design/248-baseline",
);

/** True where the local G0 baseline is absent (a fresh clone): the frozen-output tests skip. */
export const G0_BASELINE_ABSENT = !existsSync(G0_BASELINE_DIR);

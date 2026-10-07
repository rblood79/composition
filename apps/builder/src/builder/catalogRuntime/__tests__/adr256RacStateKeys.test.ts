/**
 * ADR-256 Decision 7 — the state keys each RAC part gives (`showWhen`'s owners) are the installed
 * RAC's run, never a hand table: mount RAC again (`adr256-g0-rac-inventory.mjs`, jsdom) and require
 * the generated module (`packages/shared/src/catalog/generated/racStateKeys.ts`) to equal what the
 * generator builds from that run, and the generator's key list to be `CATALOG_STATE_KEYS`:
 *
 *   node apps/builder/scripts/adr256-g0-rac-inventory.mjs <inv.json>
 *   node apps/builder/scripts/adr256-gen-rac-state-keys.mjs <inv.json> packages/shared/src/catalog/generated/racStateKeys.ts
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOG_STATE_KEYS } from "../../../../../../packages/shared/src/catalog/document/types";
import {
  RAC_STATE_KEYS,
  RAC_STATE_KEYS_VERSION,
} from "../../../../../../packages/shared/src/catalog/generated/racStateKeys";

const REPO = resolve(__dirname, "../../../../../..");

describe("ADR-256 — RAC state key table = the installed RAC's run", () => {
  it("regenerating from a fresh RAC mount gives the committed table", async () => {
    const out = join(mkdtempSync(join(tmpdir(), "adr256-")), "inv.json");
    execFileSync(
      process.execPath,
      [join(REPO, "apps/builder/scripts/adr256-g0-rac-inventory.mjs"), out],
      { cwd: REPO, stdio: "pipe" },
    );
    const inventory = JSON.parse(readFileSync(out, "utf8"));
    const { buildRacStateKeys, STATE_KEYS } = await import(
      join(REPO, "apps/builder/scripts/adr256-gen-rac-state-keys.mjs")
    );
    expect(STATE_KEYS).toEqual([...CATALOG_STATE_KEYS]);
    expect(RAC_STATE_KEYS_VERSION).toBe(inventory.racVersion);
    expect(RAC_STATE_KEYS).toEqual(buildRacStateKeys(inventory));
  }, 120_000);
});

/**
 * ADR-256 Decision 4 — the named-slot provider table is the installed RAC's run, never a hand
 * table: mount RAC again (`adr256-g0-rac-inventory.mjs`, jsdom) and require the generated module
 * (`packages/shared/src/catalog/generated/racSlotProviders.ts`) to equal what the generator builds
 * from that run. A RAC upgrade that moves a slot fails here until the table is regenerated:
 *
 *   node apps/builder/scripts/adr256-g0-rac-inventory.mjs <inv.json>
 *   node apps/builder/scripts/adr256-gen-rac-slots.mjs <inv.json> packages/shared/src/catalog/generated/racSlotProviders.ts
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  RAC_SLOT_PROVIDERS,
  RAC_SLOT_PROVIDERS_VERSION,
} from "../../../../../../packages/shared/src/catalog/generated/racSlotProviders";

const REPO = resolve(__dirname, "../../../../../..");

describe("ADR-256 — RAC slot provider table = the installed RAC's run", () => {
  it("regenerating from a fresh RAC mount gives the committed table", async () => {
    const out = join(mkdtempSync(join(tmpdir(), "adr256-")), "inv.json");
    execFileSync(
      process.execPath,
      [join(REPO, "apps/builder/scripts/adr256-g0-rac-inventory.mjs"), out],
      { cwd: REPO, stdio: "pipe" },
    );
    const inventory = JSON.parse(readFileSync(out, "utf8"));
    const { buildRacSlotProviders } = await import(
      join(REPO, "apps/builder/scripts/adr256-gen-rac-slots.mjs")
    );
    expect(RAC_SLOT_PROVIDERS_VERSION).toBe(inventory.racVersion);
    expect(RAC_SLOT_PROVIDERS).toEqual(buildRacSlotProviders(inventory));
  }, 120_000);
});

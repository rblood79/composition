import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as commands from "..";

/**
 * ADR-248 Phase 4b coverage manifest: every old document-writing name in the Builder (2026-09-30
 * inventory — store actions, wrappers, domain functions, panel handlers, history machinery, data
 * store) has a disposition, and every command it maps to exists in the command layer.
 */
interface Entry {
  name: string;
  source: string;
  family: string;
  disposition: string;
  commands?: string[];
  note?: string;
}
const manifest = JSON.parse(
  readFileSync(
    new URL(
      "../../../../../../docs/adr/design/248-phase4b-command-coverage.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { dispositions: Record<string, string>; entries: Entry[] };

describe("ADR-248 Phase 4b command coverage", () => {
  it("classifies every old writer (unclassified 0)", () => {
    expect(manifest.entries.length).toBeGreaterThanOrEqual(270);
    const unknown = manifest.entries.filter(
      (entry) => !(entry.disposition in manifest.dispositions),
    );
    expect(unknown).toEqual([]);
    const names = manifest.entries.map(
      (entry) => `${entry.name}@${entry.source}`,
    );
    expect(new Set(names).size).toBe(names.length);
  });

  it("maps command dispositions to commands that exist", () => {
    const exported = new Set(Object.keys(commands));
    const missing = manifest.entries.flatMap((entry) =>
      entry.disposition !== "command"
        ? []
        : entry.commands
          ? entry.commands
              .filter((name) => !exported.has(name))
              .map((name) => `${entry.name}→${name}`)
          : entry.note?.includes("compositionRoot.execute")
            ? []
            : [`${entry.name}→(none)`],
    );
    expect(missing).toEqual([]);
    const counts: Record<string, number> = {};
    for (const entry of manifest.entries)
      counts[entry.disposition] = (counts[entry.disposition] ?? 0) + 1;
    console.info("[adr248-4b-coverage]", JSON.stringify(counts));
  });
});

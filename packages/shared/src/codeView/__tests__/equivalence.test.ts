import { describe, expect, it } from "vitest";
// @ts-expect-error — a plain ESM script (no types): the same judge `node scripts/…` runs.
import { judge } from "../../../../../scripts/code-view-equivalence.mjs";

/**
 * ADR-284 G6 — the acceptance set: each example rebuilt in the builder generates code whose data
 * flow facts equal the reference fixture's (breakdown §7a — the comparison's states, exclusions with
 * their reasons, the normalizations N1 ~ N13). The generated golden files come from
 * `apps/builder/src/preview/catalog/__tests__/adr284CodeView.test.tsx`.
 */
interface Result {
  name: string;
  pass: boolean;
  compared: string[];
  missing: string[];
  extra: string[];
}

describe("ADR-284 G6 — code view ≡ the reference examples' data flow", () => {
  const { results } = judge() as { results: Result[] };

  it("covers the five examples with data flow (tabs · ripple have none)", () => {
    expect(results.map((result) => result.name).sort()).toEqual([
      "emoji-picker",
      "ios-list",
      "kanban",
      "photos",
      "plants",
    ]);
  });

  for (const name of ["plants", "photos", "kanban", "ios-list", "emoji-picker"])
    it(`${name}: the same facts`, () => {
      const result = results.find((item) => item.name === name)!;
      expect({ missing: result.missing, extra: result.extra }).toEqual({
        missing: [],
        extra: [],
      });
      // (A comparison that compares nothing passes vacuously — each covers its data flow.)
      expect(result.compared.length).toBeGreaterThan(2);
    });
});

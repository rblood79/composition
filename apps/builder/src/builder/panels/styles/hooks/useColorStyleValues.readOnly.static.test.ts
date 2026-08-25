import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("ADR-912 Phase 3 panel paint read boundary", () => {
  it("canonical/history/DB mutation과 RAF scheduling을 포함하지 않는다", () => {
    const sources = [
      "useColorStyleValues.ts",
      "useElementStyleContext.ts",
      "../utils/specPresetResolver.ts",
      "../utils/styleValueHelpers.ts",
    ]
      .map((file) => readFileSync(resolve(here, file), "utf8"))
      .join("\n");

    expect(sources).not.toMatch(
      /requestAnimationFrame\s*\(|cancelAnimationFrame\s*\(/,
    );
    expect(sources).not.toMatch(
      /updateSelected[A-Za-z]*\s*\(|updateStyle[A-Za-z]*\s*\(|useStyleActions\s*\(|useOptimizedStyleActions\s*\(/,
    );
    expect(sources).not.toMatch(
      /canonicalDocumentStore\.setState\s*\(|useCanonicalDocumentStore\.setState\s*\(/,
    );
    expect(sources).not.toMatch(/from ["'][^"']*(history|database|supabase)/i);
  });

  it("paint owner와 dynamic cache 경계를 한 곳으로 고정한다", () => {
    const adapterSource = readFileSync(
      resolve(here, "../utils/specPresetResolver.ts"),
      "utf8",
    );
    const panelSources = [
      readFileSync(resolve(here, "useColorStyleValues.ts"), "utf8"),
      readFileSync(resolve(here, "../utils/styleValueHelpers.ts"), "utf8"),
    ].join("\n");

    expect(adapterSource.match(/resolveCatalogPaint\(/g)).toHaveLength(1);
    expect(adapterSource).not.toMatch(
      /appearancePresetCache|typographyPresetCache/,
    );
    expect(panelSources).not.toContain("withAccentOverride");
  });
});

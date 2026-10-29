import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ADR-291 G3 (사용자 결정 2026-10-29 「serialize 를 Properties 패널에서 떼어 내자」) — the filter
 * section is on the first screen (Properties panel); the view request serializer (~1.9 KB gz) loads
 * only when a connection shows an API collection's request (`viewSerializer.ts`).
 */
describe("ADR-291 G3 — the filter section loads the serializer lazily", () => {
  it("CatalogFilterSection has no value import of collections/view/serialize", () => {
    const source = readFileSync(
      resolve(__dirname, "../CatalogFilterSection.tsx"),
      "utf8",
    );
    const imports = [
      ...source.matchAll(
        /^import\s+(?!type\b)[^;]*?\bfrom\s+["']([^"']+)["']/gms,
      ),
    ].map((match) => match[1]!);
    expect(imports.filter((path) => /collections\/view\/serialize$/.test(path))).toEqual([]);
  });

  it("the loader brings the serializer by dynamic import", () => {
    const source = readFileSync(resolve(__dirname, "../viewSerializer.ts"), "utf8");
    expect(source).toMatch(/import\(\s*"[^"]*collections\/view\/serialize"\s*,?\s*\)/);
  });
});

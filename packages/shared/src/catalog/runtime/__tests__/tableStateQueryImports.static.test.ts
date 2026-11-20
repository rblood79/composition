import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ADR-315 Phase 3 — the Table state's translation · judgment modules are read on the Builder's
 * first screen (the panel's notices ask `catalogTableSliceServable`). A value import of the
 * request serializer from them brought the serializer and the row intake behind it
 * (`normalizeRows` · `outgoing` · `parseJsonLossless`) into the Builder's initial bundle:
 * +6,082 B gzip (2026-11-20, `adr209-bundle-closure.mjs`) — ADR-313 keeps the intake off the
 * first screen. Types may come from it (erased).
 */
const ROOT = resolve(__dirname, "../../../../../..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");

describe("the Table state modules do not load the request serializer", () => {
  it.each([
    "packages/shared/src/catalog/runtime/tableStateQuery.ts",
    "packages/shared/src/catalog/runtime/tableRowSlices.ts",
    "packages/shared/src/catalog/runtime/tableState.ts",
    "packages/shared/src/collections/view/rowFilter.ts",
    "packages/shared/src/collections/view/fuzzy.ts",
    "packages/shared/src/collections/view/querySuffixes.ts",
  ])("%s", (path) => {
    const source = read(path);
    const imports = [
      ...source.matchAll(
        /^(import|export)\s+(type\s+)?[^;]*?from\s+"([^"]+)";/gms,
      ),
    ];
    for (const [, , typeOnly, from] of imports)
      if (/view\/serialize$|\/intake\//.test(from!))
        expect(typeOnly, `${path} ← ${from}`).toBeTruthy();
  });
});

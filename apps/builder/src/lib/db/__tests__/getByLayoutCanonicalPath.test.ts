import { describe, expect, it } from "vitest";

describe("ADR-116 direct cutover: legacy element layout index removed", () => {
  it("IndexedDB adapter no longer exposes getByLayout or creates layout_id index", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const adapter = await fs.readFile(
      path.resolve(__dirname, "../indexedDB/adapter.ts"),
      "utf-8",
    );
    const types = await fs.readFile(
      path.resolve(__dirname, "../types.ts"),
      "utf-8",
    );

    expect(adapter).not.toMatch(/\bgetByLayout\s*:/);
    expect(types).not.toMatch(/\bgetByLayout\s*\(/);
    expect(adapter).not.toMatch(/createIndex\(\s*["']layout_id["']/);
    expect(adapter).not.toMatch(
      /getAllByIndex<Element>\(\s*["']elements["']\s*,\s*["']layout_id["']/,
    );
  });
});

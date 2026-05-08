import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ADR-120 Phase 1 elementLoader persistence contract", () => {
  it("derives lazy page elements from the canonical document, not legacy stores", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementLoader.ts"),
      "utf-8",
    );

    expect(source).toContain("loadFromCanonicalDocument");
    expect(source).toContain("deriveProjectRenderModelFromDocument");
    expect(source).not.toContain("getDB");
    expect(source).not.toContain("supabase");
    expect(source).not.toContain("db.elements.getByPage");
    expect(source).not.toContain("db.elements.insertMany");
  });
});

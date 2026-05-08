import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ADR-120 Phase 1 dashboard local lifecycle contract", () => {
  it("does not seed or delete local pages/elements/layouts mirror stores", async () => {
    const source = await readFile(resolve(__dirname, "../index.tsx"), "utf-8");

    expect(source).toContain("db.documents.put(");
    expect(source).toContain("db.documents.delete(");
    expect(source).not.toContain("db.pages.insert(");
    expect(source).not.toContain("db.elements.insert(bodyElement)");
    expect(source).not.toContain("db.pages.getByProject(");
    expect(source).not.toContain("db.elements.getByPage(");
    expect(source).not.toContain("db.layouts.getByProject(");
    expect(source).not.toContain("db.layouts.delete(");
  });
});

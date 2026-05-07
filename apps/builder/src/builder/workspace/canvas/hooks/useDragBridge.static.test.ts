import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("useDragBridge persistence contract", () => {
  it("does not issue per-id DB updates for canonical projection descendants", async () => {
    const source = await readFile(
      resolve(__dirname, "useDragBridge.ts"),
      "utf-8",
    );

    expect(source).toContain("db.elements.updateMany(updates)");
    expect(source).toContain("persistActiveCanonicalDocument(db)");
    expect(source).not.toContain("db.elements.update(id");
  });
});

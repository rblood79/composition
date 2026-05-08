import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("useDragBridge persistence contract", () => {
  it("does not issue per-id DB updates for canonical projection descendants", async () => {
    const source = await readFile(
      resolve(__dirname, "useDragBridge.ts"),
      "utf-8",
    );

    expect(source).toContain("persistActiveCanonicalDocument(db)");
    expect(source).not.toContain("db.elements.updateMany(");
    expect(source).not.toContain("db.elements.update(id");
  });

  it("uses canonical-primary move as the drop commit path", async () => {
    const source = await readFile(
      resolve(__dirname, "useDragBridge.ts"),
      "utf-8",
    );

    expect(source).toContain("moveElementCanonicalPrimary(");
    expect(source).not.toContain("state.moveElementToContainer(");
    expect(source).not.toContain("state.batchUpdateElementOrders(");
  });
});

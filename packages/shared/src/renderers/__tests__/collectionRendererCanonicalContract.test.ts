import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("CollectionRenderers canonical runtime contract", () => {
  it("does not send legacy UPDATE_ELEMENTS snapshots back to Builder", async () => {
    const source = await readFile(
      resolve(__dirname, "../CollectionRenderers.tsx"),
      "utf-8",
    );

    expect(source).not.toContain('type: "UPDATE_ELEMENTS"');
    expect(source).not.toContain("elements: updatedElements");
  });
});

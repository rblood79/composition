import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("canonical-only boundary", () => {
  it("does not restore the removed legacy document reverse projection", async () => {
    await expect(
      access(resolve(__dirname, "../exportLegacyDocument.ts")),
    ).rejects.toThrow();
  });

});

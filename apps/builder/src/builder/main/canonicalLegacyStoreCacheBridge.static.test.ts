import { describe, expect, it } from "vitest";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("canonical legacy store cache bridge removal", () => {
  it("keeps recoverElementsSnapshot and the transition bridge out of Builder runtime", async () => {
    // (ADR-248 4e: the Builder runtime is CatalogBuilderCore — the old BuilderCore retired.)
    const builderCoreSource = await readFile(
      resolve(__dirname, "CatalogBuilderCore.tsx"),
      "utf-8",
    );

    await expect(
      access(resolve(__dirname, "canonicalLegacyStoreCacheBridge.ts")),
    ).rejects.toThrow();

    expect(builderCoreSource).not.toContain("canonicalLegacyStoreCacheBridge");
    expect(builderCoreSource).not.toContain("recoverElementsSnapshot(");
  });
});

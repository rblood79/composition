import { describe, expect, it } from "vitest";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("canonical legacy store cache bridge removal", () => {
  it("keeps recoverElementsSnapshot and the transition bridge out of Builder runtime", async () => {
    const builderCoreSource = await readFile(
      resolve(__dirname, "BuilderCore.tsx"),
      "utf-8",
    );

    await expect(
      access(resolve(__dirname, "canonicalLegacyStoreCacheBridge.ts")),
    ).rejects.toThrow();

    expect(builderCoreSource).not.toContain(
      "startCanonicalLegacyStoreCacheBridge",
    );
    expect(builderCoreSource).not.toContain("canonicalLegacyStoreCacheBridge");
    expect(builderCoreSource).not.toContain("recoverElementsSnapshot(");
  });

  it("removes recoverElementsSnapshot from the store action surface", async () => {
    const storeSource = await readFile(
      resolve(__dirname, "../stores/elements.ts"),
      "utf-8",
    );

    expect(storeSource).not.toContain("recoverElementsSnapshot");
    await expect(
      access(resolve(__dirname, "canonicalLegacyStoreCacheBridge.ts")),
    ).rejects.toThrow();
  });
});

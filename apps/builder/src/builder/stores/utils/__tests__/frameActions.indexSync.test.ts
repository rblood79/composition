import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("frame mutation index sync contract", () => {
  it("rebuilds derived indexes after reusable frame deletion cascades page bindings", async () => {
    const source = await readFile(
      resolve(__dirname, "../frameActions.ts"),
      "utf-8",
    );

    const deleteFrameIndex = source.indexOf(
      "export async function deleteReusableFrame",
    );
    const cascadeIndex = source.indexOf(
      "await applyDeleteReusableFrameCanonicalPrimary",
      deleteFrameIndex,
    );
    const rebuildIndex = source.indexOf(
      "getLiveElementsState()._rebuildIndexes();",
      cascadeIndex,
    );

    expect(deleteFrameIndex).toBeGreaterThanOrEqual(0);
    expect(cascadeIndex).toBeGreaterThan(deleteFrameIndex);
    expect(rebuildIndex).toBeGreaterThan(cascadeIndex);
  });
});

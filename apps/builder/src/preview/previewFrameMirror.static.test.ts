import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const previewFiles = [
  "components/CanonicalNodeRenderer.tsx",
] as const;

describe("preview frame mirror contract", () => {
  it("routes page/frame ownership through frameMirror or frameElementLoader", async () => {
    for (const file of previewFiles) {
      const source = await readFile(resolve(__dirname, file), "utf-8");

      expect(source).not.toContain("getLegacyLayoutId");
      expect(source).not.toContain("withLegacyLayoutId");
      expect(source).not.toContain("hasLegacyLayoutId");
      expect(source).not.toContain("matchesLegacyLayoutId");
      expect(source).not.toContain("legacyToCanonical");
    }
  });

  it("does not expose page order_num on the preview runtime page contract", async () => {
    const storeTypes = await readFile(
      resolve(__dirname, "store/types.ts"),
      "utf-8",
    );

    expect(storeTypes).not.toContain("order_num");
  });

});

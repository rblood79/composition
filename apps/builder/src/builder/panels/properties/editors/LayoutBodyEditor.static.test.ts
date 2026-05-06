import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("LayoutBodyEditor visible naming", () => {
  it("exposes only frame preset controls for frame body properties", async () => {
    const source = await readFile(
      resolve(__dirname, "LayoutBodyEditor.tsx"),
      "utf-8",
    );

    expect(source).toContain('<PropertySection title="Frame Preset">');
    expect(source).toContain("getActiveCanonicalElementSnapshot");
    expect(source).not.toContain('<PropertySection title="Layout Preset">');
    expect(source).not.toContain("LayoutSlugEditor");
    expect(source).not.toContain('<PropertySection title="Layout">');
    expect(source).not.toContain("PropertyCustomId");
    expect(source).not.toContain('label="Class Name"');
  });
});

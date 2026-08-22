import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("subtree command patch architecture", () => {
  it("does not fall back to full command/map rebuild APIs", () => {
    const source = readFileSync(
      resolve(__dirname, "subtreeCommandPatch.ts"),
      "utf8",
    );

    expect(source).not.toContain("buildRenderCommandStream");
    expect(source).not.toContain("getCachedCommandStream");
    expect(source).not.toContain("batchUpdate");
    expect(source).not.toContain(".splice(");
    expect(source).toContain("presentationRevision");
    expect(source).toContain("baseCanonicalRevision");
    expect(source).toContain("clipContextByElement");
    expect(source).toContain("zOrderKeyByElement");
    expect(source).toContain("removeElement");
    expect(source).toContain("updateElement");
  });
});

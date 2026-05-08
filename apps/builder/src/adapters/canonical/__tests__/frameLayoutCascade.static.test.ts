import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("frameLayoutCascade canonical-only boundary", () => {
  it("does not keep unused reusable frame duplication through legacy projection", async () => {
    const source = await readFile(
      resolve(__dirname, "../frameLayoutCascade.ts"),
      "utf-8",
    );

    expect(source).not.toContain('from "./exportLegacyDocument"');
    expect(source).not.toContain(["exportLegacyDocument", "("].join(""));
    expect(source).not.toContain(
      "duplicateReusableFrameElementsCanonicalPrimary",
    );
    expect(source).not.toContain(
      ["state.", "elements", "Map.values()"].join(""),
    );
  });
});

import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("skiaFramePipeline page-resolved render tree contract", () => {
  it("uses rendererInput.renderNodesMap for command-stream and overlay lookup", async () => {
    const source = await readFile(
      resolve(__dirname, "skiaFramePipeline.ts"),
      "utf-8",
    );

    expect(source).toContain("rendererInput.renderNodesMap.get(cid)");
    expect(source).toMatch(
      /buildSharedSceneDerivedData\(\s*treeBoundsMap,\s*rendererInput\.renderNodesMap,/,
    );
  });
});

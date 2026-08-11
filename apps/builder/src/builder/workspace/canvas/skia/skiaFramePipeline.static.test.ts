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

  it("reads page position presentation when the cached content node renders", async () => {
    const source = await readFile(
      resolve(__dirname, "skiaFramePipeline.ts"),
      "utf-8",
    );

    const renderTimeSnapshotReads = source.match(
      /renderSkia\(canvas, bounds\) \{\s*const currentPagePositionSnapshot =\s*getPagePositionPresentationSnapshot\(\);/g,
    );

    expect(renderTimeSnapshotReads).toHaveLength(2);
    expect(source).not.toContain("pagePositionSnapshot?:");
    expect(source).not.toContain("pagePositionSnapshot ??");
  });
});

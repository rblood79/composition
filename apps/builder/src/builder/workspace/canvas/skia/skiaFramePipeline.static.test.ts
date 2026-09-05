import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("skiaFramePipeline page-resolved render tree contract", () => {
  it("uses rendererInput.renderNodesMap for command-stream and overlay lookup", async () => {
    const source = await readFile(
      resolve(__dirname, "skiaFramePipeline.ts"),
      "utf-8",
    );

    expect(source).toMatch(
      /readChildren\(\s*filteredChildIds,\s*rendererInput.renderNodesMap,/,
    );
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

    // 1 = command stream contentNode (구 tree fallback closure 는 2026-08-14 제거)
    expect(renderTimeSnapshotReads).toHaveLength(1);
    expect(source).not.toContain("pagePositionSnapshot?:");
    expect(source).not.toContain("pagePositionSnapshot ??");
  });
});

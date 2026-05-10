import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("BuilderCanvas canonical projection contract", () => {
  it("uses a canonical scene model instead of rebuilding projection in render memo paths", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderCanvas.tsx"),
      "utf-8",
    );

    expect(source).toContain("useActiveCanonicalDocument");
    expect(source).toContain("buildCanonicalSceneModel");
    expect(source).not.toContain("useCanonicalElements");
    expect(source).not.toContain("canonicalDocumentToElements");
    expect(source).toContain(
      "return buildCanonicalSceneModel(activeCanonicalDocument);",
    );
    expect(source).toContain("buildLegacyCanvasSceneGraph");
    expect(source).not.toContain("getSceneModelElementsLegacy");
    expect(source).not.toContain("getSceneModelElementsMapLegacy");
    expect(source).not.toContain("getSceneModelChildrenByParentLegacy");
    expect(source).toMatch(
      new RegExp(
        [
          "const sceneNodes =\\s*",
          "canonicalSceneModel\\?\\.sceneNodes \\?\\? legacySceneGraph\\.nodes",
        ].join(""),
      ),
    );
    expect(source).toMatch(
      /const sceneNodesMap =\s*canonicalSceneModel\?\.sceneNodesMap \?\? legacySceneGraph\.nodesMap;/,
    );
    expect(source).toMatch(
      /const sceneChildrenByParent =\s*canonicalSceneModel\?\.sceneChildrenByParent \?\?\s*legacySceneGraph\.childrenByParent;/,
    );
    expect(source).toContain(
      "const scenePageIndex = canonicalSceneModel?.pageIndex ?? pageIndex;",
    );
    expect(source).not.toContain("return rebuildPageIndex(");
    expect(source).not.toContain(
      ["useStore((state) => state.", "elements", "Map)"].join(""),
    );
    expect(source).not.toContain(
      ["useStore((state) => state.", "children", "Map)"].join(""),
    );
    expect(source).toContain("pageIndex: scenePageIndex,");
    expect(source).not.toContain("selectCanonicalDocument");
  });

  it("resolves canvas context menu targets from the interactive canonical map", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderCanvas.tsx"),
      "utf-8",
    );

    expect(source).toContain(
      "const hitElementsMap = getInteractiveElementsMap();",
    );
    expect(source).toContain(
      "const hitElement = hitElementsMap.get(elementId);",
    );
    const staleContextMenuFallback = [
      "state",
      "elementsMap.get(elementId) ?? hitElementsMap.get(elementId)",
    ].join(".");
    const staleContextMenuArgument = ["state", "elementsMap,"].join(".");

    expect(source).not.toContain(staleContextMenuFallback);
    expect(source).not.toContain(staleContextMenuArgument);
  });

  it("tags scene snapshots with canonical vs legacy-bootstrap source", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderCanvas.tsx"),
      "utf-8",
    );

    expect(source).toContain(
      'source: canonicalSceneModel ? "canonical" : "legacy-bootstrap"',
    );
  });
});

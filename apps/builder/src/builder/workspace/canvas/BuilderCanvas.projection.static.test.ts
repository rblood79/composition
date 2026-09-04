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
    // canonical scene model 호출부는 collections 외에 collectionWindows(ADR-150 A2
    // 가상화) + activeBreakpoint(ADR-154 Bug3 responsive projection) 를 넘기는
    // 멀티라인 객체로 확장됨 — 첫 인자가 activeCanonicalDocument 인 계약만 고정 검증한다.
    expect(source).toContain(
      "return buildCanonicalSceneModel(activeCanonicalDocument, {",
    );
    expect(source).not.toContain("buildLegacyCanvasSceneGraph");
    expect(source).not.toContain("getSceneModelElementsLegacy");
    expect(source).not.toContain("getSceneModelElementsMapLegacy");
    expect(source).not.toContain("getSceneModelChildrenByParentLegacy");
    expect(source).toMatch(
      new RegExp(
        [
          "const sceneNodes =\\s*",
          "canonicalSceneModel\\?\\.sceneNodes \\?\\? EMPTY_SCENE_NODES",
        ].join(""),
      ),
    );
    expect(source).toMatch(
      /const sceneNodesMap =\s*canonicalSceneModel\?\.sceneNodesMap \?\? EMPTY_SCENE_NODES_MAP;/,
    );
    expect(source).toMatch(
      /const sceneChildrenByParent =\s*canonicalSceneModel\?\.sceneChildrenByParent \?\?\s*EMPTY_SCENE_CHILDREN_MAP;/,
    );
    expect(source).toContain(
      "const scenePageIndex = canonicalSceneModel?.pageIndex ?? EMPTY_PAGE_INDEX;",
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
      resolve(__dirname, "contextMenu/canvasContextMenuEntry.ts"),
      "utf-8",
    );

    expect(source).toContain(
      "const hitElementsMap = getInteractiveElementsMap();",
    );
    expect(source).toContain(
      "const hitElement = elementId ? hitElementsMap.get(elementId) : undefined;",
    );
    const staleContextMenuFallback = [
      "state",
      "elementsMap.get(elementId) ?? hitElementsMap.get(elementId)",
    ].join(".");
    const staleContextMenuArgument = ["state", "elementsMap,"].join(".");

    expect(source).not.toContain(staleContextMenuFallback);
    expect(source).not.toContain(staleContextMenuArgument);
  });

  it("uses render-resolved interaction maps for hit-test and drag read models", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderCanvas.tsx"),
      "utf-8",
    );

    expect(source).toContain("skiaRendererInput.interactionNodesMap");
    expect(source).toContain("skiaRendererInput.interactionChildrenMap");
    expect(source).not.toContain(
      "interactiveElementsMapRef.current = skiaRendererInput.sceneNodesMap",
    );
    expect(source).not.toContain(
      "interactiveChildrenMapRef.current = skiaRendererInput.sceneChildrenByParent",
    );
  });

  it("keeps page/body fallback selection when projected Slot chrome is hit", async () => {
    const source = await readFile(
      resolve(__dirname, "hooks/useCentralCanvasPointerHandlers.ts"),
      "utf-8",
    );
    const slotGuardBlock = source.match(
      /if \(interactionTarget\.kind === "slot-guard"\) \{[\s\S]*?return;\n {6}\}/,
    )?.[0];

    expect(slotGuardBlock).toBeTruthy();
    expect(slotGuardBlock).toContain("resolveBodySelection({");
    expect(slotGuardBlock).toContain("handleElementClickRef.current");
    expect(slotGuardBlock).toContain("setCurrentPageId(bodySelection.pageId)");
    expect(slotGuardBlock).toContain("setSelectedElements([])");
  });

  it("tags scene snapshots as canonical even before document readiness", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderCanvas.tsx"),
      "utf-8",
    );

    expect(source).toContain('source: "canonical"');
    expect(source).not.toContain("legacy-bootstrap");
  });

  it("uses the transient viewport presentation for live page culling", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderCanvas.tsx"),
      "utf-8",
    );

    expect(source).toContain("getViewportPresentationSnapshot");
    expect(source).toContain("subscribeViewportPresentation");
    expect(source).toContain("buildVisiblePageSet({");
    expect(source).toContain("visiblePageIdsOverride:");
  });

  it("selects the page before starting a title drag", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderCanvas.tsx"),
      "utf-8",
    );
    const titleDragBlock = source.slice(
      source.indexOf("// Page title drag hit-test"),
      source.indexOf("if (canvasGestureSession.isOwnedByAnotherPointer"),
    );
    const claimIndex = titleDragBlock.indexOf(
      "canvasGestureSession.tryClaimPage",
    );
    const selectIndex = titleDragBlock.indexOf(
      "setCurrentPageId(bounds.pageId);",
    );
    const dragIndex = titleDragBlock.indexOf("startPageDrag(");

    expect(claimIndex).toBeGreaterThanOrEqual(0);
    expect(selectIndex).toBeGreaterThan(claimIndex);
    expect(dragIndex).toBeGreaterThan(selectIndex);
  });

  it("uses current breakpoint positions when page drag presentation is inactive", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderCanvas.tsx"),
      "utf-8",
    );

    expect(source).toContain("readPagePositionForInteraction");
    expect(source).not.toContain(
      "pagePositionReader: (pageId) => readPagePosition(pageId)",
    );
  });
});

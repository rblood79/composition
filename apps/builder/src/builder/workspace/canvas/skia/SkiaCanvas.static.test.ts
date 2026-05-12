import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("SkiaCanvas render invalidation contract", () => {
  it("invalidates content and command stream cache when rendererInput changes", async () => {
    const source = await readFile(
      resolve(__dirname, "SkiaCanvas.tsx"),
      "utf-8",
    );

    expect(source).toMatch(
      /import \{ invalidateCommandStreamCache \} from "\.\/renderCommands";/,
    );

    const effectBlock = source.match(
      /useEffect\(\(\) => \{[\s\S]*?rendererInputRef\.current = rendererInput;[\s\S]*?invalidateCommandStreamCache\(\);[\s\S]*?rendererRef\.current\?\.invalidateContent\(\);[\s\S]*?\}, \[rendererInput\]\);/,
    );

    expect(
      effectBlock,
      "rendererInput 변경 시 Skia content/cache invalidation effect 가 필요합니다.",
    ).not.toBeNull();
  });

  it("feeds StoreRenderBridge from page-resolved rendererInput maps", async () => {
    const source = await readFile(
      resolve(__dirname, "SkiaCanvas.tsx"),
      "utf-8",
    );

    expect(source).toContain(
      "getElements: () => rendererInputRef.current.renderNodesMap,",
    );
    expect(source).toContain(
      "getChildrenMap: () => rendererInputRef.current.childrenMap,",
    );
    expect(source).toContain("rendererInput.renderNodesMap,");
    expect(source).toContain("rendererInput.childrenMap,");
    expect(source).toContain(
      "getScrollElementsMap: () => rendererInputRef.current.renderNodesMap,",
    );
    expect(source).not.toContain(
      "getElements: () => useStore.getState().elementsMap,",
    );
    expect(source).not.toContain(
      "getChildrenMap: () => useStore.getState().childrenMap,",
    );
    expect(source).toContain("storeRenderBridgeRef.current?.sync(");
    expect(source).not.toContain(
      "let prevElements = useStore.getState().elementsMap;",
    );
    expect(source).not.toContain(
      "let prevChildren = useStore.getState().childrenMap;",
    );
    expect(source).not.toContain("state.elementsMap !== prevElements");
    expect(source).not.toContain("state.childrenMap !== prevChildren");
  });

  it("uses frameAreas for frame titles and suppresses page titles in layout mode", async () => {
    const source = await readFile(
      resolve(__dirname, "SkiaCanvas.tsx"),
      "utf-8",
    );

    expect(source).toContain(
      "const frameAreasRef = useRef(rendererInput.frameAreas);",
    );
    expect(source).toContain(
      "frameAreasRef.current = rendererInput.frameAreas;",
    );
    expect(source).toContain("frameAreas: frameAreasRef.current,");
    expect(source).toContain('currentRendererInput.editMode === "layout"');
  });
});

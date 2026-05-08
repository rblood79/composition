import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("FramesTab frame selection race guard", () => {
  it("selects immediately and ignores stale async frame loads", async () => {
    const source = await readFile(resolve(__dirname, "FramesTab.tsx"), "utf-8");

    expect(source).toContain("const frameSelectRequestRef = React.useRef(0);");
    expect(source).toMatch(
      /const requestId = frameSelectRequestRef\.current \+ 1;/,
    );
    expect(source).toMatch(
      /frameSelectRequestRef\.current = requestId;[\s\S]*selectReusableFrame\(frameId\);[\s\S]*setEditModeLayoutId\(frameId\);/,
    );
    expect(source).toMatch(
      /if \(requestId !== frameSelectRequestRef\.current\) \{[\s\S]*return;[\s\S]*\}/,
    );
  });

  it("does not replace live frame elements with an empty descendant load", async () => {
    const source = await readFile(resolve(__dirname, "FramesTab.tsx"), "utf-8");

    expect(source).toContain("loadFrameElements");
    expect(source).toContain("useCanonicalFrameElementScopes");
    expect(source).toContain("frameScope.elementIds.has(element.id)");
    expect(source).toMatch(/const frameElements = await loadFrameElements\(/);
    expect(source).toMatch(/mergeElementsCanonicalPrimary\(frameElements\);/);
    expect(source).not.toContain(
      "const storeSetElements = useStore.getState().setElements;",
    );
    expect(source).not.toMatch(
      /filter\(\s*\(el\) => el\.layout_id !== selectedReusableFrameId/,
    );
  });

  it("uses active canonical document without rebuilding projection for frame list", async () => {
    const source = await readFile(resolve(__dirname, "FramesTab.tsx"), "utf-8");

    expect(source).toContain("useCanonicalReusableFrameLayouts");
    expect(source).not.toContain("selectCanonicalDocument");
    expect(source).not.toContain("useLayoutsStore");
  });

  it("derives hydration fallback from store elements instead of subscribing to elementsMap", async () => {
    const source = await readFile(resolve(__dirname, "FramesTab.tsx"), "utf-8");

    expect(source).toContain("if (canonicalElements) return EMPTY_ELEMENTS;");
    expect(source).toContain("const { elements: legacyElements } = state;");
    expect(source).toContain("return legacyElements ?? EMPTY_ELEMENTS;");
    expect(source).toContain("const hydratedElementsMap = useMemo");
    expect(source).not.toContain("useStore((state) => state.elementsMap)");
  });

  it("does not add an extra layouts-tab wrapper around Frames sections", async () => {
    const source = await readFile(resolve(__dirname, "FramesTab.tsx"), "utf-8");

    expect(source).not.toContain('className="layouts-tab"');
    expect(source).toContain("<>");
    expect(source).toContain("<FrameList");
    expect(source).toContain("<FrameElementTree");
  });

  it("renders Frames/Layers children through shared TreeBase primitives", async () => {
    const frameListSource = await readFile(
      resolve(__dirname, "FrameList.tsx"),
      "utf-8",
    );
    const frameElementTreeSource = await readFile(
      resolve(__dirname, "FrameElementTree.tsx"),
      "utf-8",
    );

    expect(frameListSource).toContain('from "../tree/TreeBase"');
    expect(frameListSource).toContain("<TreeBase<FrameListNode>");
    expect(frameElementTreeSource).toContain('from "../tree/TreeBase"');
    expect(frameElementTreeSource).toContain("<TreeBase<FrameElementTreeNode>");
    expect(frameElementTreeSource).toContain(
      "<VirtualizedTree<FrameElementTreeNode>",
    );
    expect(frameListSource).toContain('className="frame-tree"');
    expect(frameElementTreeSource).toContain('className="frame-tree"');
    expect(frameElementTreeSource).toContain(
      'className="frame-tree frame-tree--virtualized"',
    );
    expect(frameListSource).not.toContain("frame-list-tree");
    expect(frameElementTreeSource).not.toContain("frame-layer-tree");
    expect(frameElementTreeSource).not.toContain("renderTree(");
  });
});

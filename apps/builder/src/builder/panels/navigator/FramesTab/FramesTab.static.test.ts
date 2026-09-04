import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("FramesTab frame selection race guard", () => {
  it("selects canonical frames synchronously without an async mirror load", async () => {
    const source = await readFile(resolve(__dirname, "FramesTab.tsx"), "utf-8");

    expect(source).toMatch(
      /selectReusableFrame\(frameId\);[\s\S]*setEditModeLayoutId\(frameId\);[\s\S]*selectFrameBody\(frameId\);/,
    );
    expect(source).not.toContain("frameSelectRequestRef");
    expect(source).not.toContain("loadFrameElements");
  });

  it("does not merge a legacy frame mirror into the canonical document", async () => {
    const source = await readFile(resolve(__dirname, "FramesTab.tsx"), "utf-8");

    expect(source).toContain("useCanonicalFrameElementScopes");
    expect(source).toContain("frameScope.elementIds.has(element.id)");
    expect(source).not.toContain("mergeElementsCanonicalPrimary");
    expect(source).not.toContain("collectHydratedFrameElements");
    expect(source).not.toContain("hasHydratedFrameElements");
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

  it("reads the selected canonical frame scope without store array/map subscriptions", async () => {
    const source = await readFile(resolve(__dirname, "FramesTab.tsx"), "utf-8");

    expect(source).toContain("useCanonicalPanelElements");
    expect(source).not.toContain("useCanonicalElements");
    expect(source).toContain("collectCanonicalFrameElements");
    expect(source).not.toContain("canonicalElementsById");
    expect(source).not.toContain("legacyElements");
    expect(source).not.toContain("hydratedElementsMap");
    expect(source).not.toContain("useStore((state) => state.elementsMap)");
  });

  it("stacks Frames sections in the shared SectionSplitStack without an extra layouts-tab wrapper", async () => {
    const source = await readFile(resolve(__dirname, "FramesTab.tsx"), "utf-8");

    expect(source).not.toContain('className="layouts-tab"');
    expect(source).toContain("<SectionSplitStack");
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

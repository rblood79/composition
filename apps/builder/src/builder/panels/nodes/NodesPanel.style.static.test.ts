import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const NODE_SECTION_FILES = [
  "PagesSection.tsx",
  "LayersSection.tsx",
  "FramesTab/FrameList.tsx",
  "FramesTab/FrameElementTree.tsx",
];

describe("NodesPanel shared panel style contract", () => {
  it("uses the common panel shell and content classes", async () => {
    const panelSource = await readFile(
      resolve(__dirname, "NodesPanel.tsx"),
      "utf-8",
    );
    const tabsSource = await readFile(
      resolve(__dirname, "NodesPanelTabs.tsx"),
      "utf-8",
    );

    expect(panelSource).toContain(
      'className="panel nodes-panel nodes-panel--new-tree"',
    );
    expect(panelSource).toContain(
      'className="panel-contents nodes-panel-content"',
    );
    expect(tabsSource).toContain('className="panel-header nodes-panel-tabs"');
  });

  it.each(NODE_SECTION_FILES)(
    "%s uses the shared Section component",
    async (file) => {
      const source = await readFile(resolve(__dirname, file), "utf-8");

      expect(source).toContain("Section");
      expect(source).toContain('className="node-tree-section"');
      expect(source).toContain("collapsible={false}");
      expect(source).not.toContain("PanelHeader");
      expect(source).not.toContain('className="section-content elements"');
    },
  );

  it("keeps shared section padding while preserving the tree guide and icons", async () => {
    const css = await readFile(resolve(__dirname, "NodesPanel.css"), "utf-8");
    const itemSources = await Promise.all(
      [
        "tree/PageTree/PageTreeItemContent.tsx",
        "tree/LayerTree/LayerTreeItemContent.tsx",
        "FramesTab/FrameList.tsx",
        "FramesTab/FrameElementTree.tsx",
      ].map((file) => readFile(resolve(__dirname, file), "utf-8")),
    );

    expect(css).not.toMatch(/\.section-content\s*\{[^}]*all:\s*unset/s);
    expect(css).toContain(
      "linear-gradient(to left, var(--border) 1px, transparent 1px)",
    );
    expect(css).not.toMatch(
      /--(?:color-(?:primary|secondary)|text-(?:primary|secondary))[^);]*/,
    );
    for (const source of itemSources) {
      expect(source).toContain("elementItemIndent");
      expect(source).toContain("elementItemIcon");
    }
  });

  it("matches the inspector control height and radius for tree rows", async () => {
    const css = await readFile(resolve(__dirname, "NodesPanel.css"), "utf-8");
    const layerTreeSource = await readFile(
      resolve(__dirname, "tree/LayerTree/LayerTree.tsx"),
      "utf-8",
    );
    const frameTreeSource = await readFile(
      resolve(__dirname, "FramesTab/FrameElementTree.tsx"),
      "utf-8",
    );

    expect(css).toMatch(
      /\.nodes-panel-content \.react-aria-TreeItem \{[^}]*min-height: var\(--inspector-control-size\);[^}]*border-radius: var\(--radius-md\);/s,
    );
    expect(css).toMatch(
      /\.elementItem \{[^}]*min-height: var\(--inspector-control-size\);[^}]*border-radius: var\(--radius-md\);/s,
    );
    expect(css).toMatch(
      /\.elementItemIndent \{[^}]*height: var\(--inspector-control-size\);/s,
    );
    expect(layerTreeSource).toContain("itemHeight={28}");
    expect(frameTreeSource).toContain("itemHeight={28}");
  });
});

import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const NODE_SECTION_FILES = [
  "PagesSection.tsx",
  "LayersSection.tsx",
  "FramesTab/FrameList.tsx",
  "FramesTab/FrameElementTree.tsx",
];

describe("NavigatorPanel shared panel style contract", () => {
  it("uses the common panel shell and content classes", async () => {
    const panelSource = await readFile(
      resolve(__dirname, "NavigatorPanel.tsx"),
      "utf-8",
    );
    const tabsSource = await readFile(
      resolve(__dirname, "NavigatorPanelTabs.tsx"),
      "utf-8",
    );

    expect(panelSource).toContain(
      'className="panel navigator-panel navigator-panel--new-tree"',
    );
    expect(panelSource).toContain(
      'className="panel-contents navigator-panel-content"',
    );
    expect(panelSource).toContain("<PanelHeader");
    expect(panelSource).toContain('panelId="nodes"');
    expect(panelSource).toContain(
      'className="panel-tabs navigator-panel-tabs"',
    );
    expect(panelSource).toContain(
      'className="panel-header panel-tabrow navigator-panel-tabrow"',
    );
    expect(tabsSource).toContain(
      'className="panel-tablist navigator-panel-tablist"',
    );
    expect(tabsSource).toContain('className="panel-tab navigator-panel-tab"');
    expect(panelSource).toContain("selectedKey={activeTab}");
    expect(panelSource).toContain("onSelectionChange={handleTabChange}");
    expect(panelSource).toContain('id="pages"');
    expect(panelSource).toContain('id="layouts"');
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

  it("keeps only equal-width distribution as the local tab override", async () => {
    const css = await readFile(
      resolve(__dirname, "NavigatorPanel.css"),
      "utf-8",
    );

    expect(css).toMatch(/\.navigator-panel-tab \{[^}]*flex: 1 1 0;/s);
    expect(css).not.toMatch(/\.navigator-panel-tab \{[^}]*justify-content:/s);
  });

  it("keeps shared section padding while preserving the tree guide and icons", async () => {
    const css = await readFile(
      resolve(__dirname, "NavigatorPanel.css"),
      "utf-8",
    );
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
    const css = await readFile(
      resolve(__dirname, "NavigatorPanel.css"),
      "utf-8",
    );
    const layerTreeSource = await readFile(
      resolve(__dirname, "tree/LayerTree/LayerTree.tsx"),
      "utf-8",
    );
    const frameTreeSource = await readFile(
      resolve(__dirname, "FramesTab/FrameElementTree.tsx"),
      "utf-8",
    );

    expect(css).toMatch(
      /\.navigator-panel-content \.react-aria-TreeItem \{[^}]*min-height: var\(--inspector-control-size\);[^}]*border-radius: var\(--radius-md\);/s,
    );
    expect(css).toMatch(
      /\.elementItem \{[^}]*min-height: var\(--inspector-control-size\);[^}]*padding-inline: var\(--spacing\);[^}]*border-radius: var\(--radius-md\);/s,
    );
    expect(css).toMatch(
      /\.elementItemIndent \{[^}]*height: var\(--inspector-control-size\);/s,
    );
    expect(css).toMatch(
      /\.elementItemActions \.iconButton \{[^}]*width: var\(--text-xl\);[^}]*height: var\(--text-xl\);[^}]*padding: 0 var\(--spacing\);/s,
    );
    expect(layerTreeSource).toContain("itemHeight={28}");
    expect(frameTreeSource).toContain("itemHeight={28}");
  });

  it("uses the shared Builder interaction states for tree rows", async () => {
    const css = await readFile(
      resolve(__dirname, "NavigatorPanel.css"),
      "utf-8",
    );

    expect(css).toMatch(
      /\.elementItem:hover \{[^}]*background-color: color-mix\(in srgb, var\(--fg\) 8%, transparent\);/s,
    );
    expect(css).toMatch(
      /\.react-aria-TreeItem\[data-pressed\] \.elementItem \{[^}]*background-color: color-mix\(in srgb, var\(--fg\) 12%, transparent\);/s,
    );
    expect(css).toMatch(
      /\.elementItem\.active \{[^}]*background-color: var\(--accent-subtle\);/s,
    );
    expect(css).toMatch(
      /\.elementItem\.focused \{[^}]*outline: 2px solid var\(--focus-ring\);[^}]*outline-offset: -2px;/s,
    );
    expect(css).toContain(".elementItem:focus-within .elementItemActions {");
    expect(css).not.toContain(
      '.react-aria-TreeItem[aria-selected="true"] .elementItem',
    );
    expect(css).not.toMatch(
      /\.elementItem\.active \{[^}]*(?:box-shadow|outline):/s,
    );
  });

  it("keeps authoring trees outside the public Tree style scope", async () => {
    const [treeBaseSource, virtualizedTreeSource, pagesSource] =
      await Promise.all([
        readFile(resolve(__dirname, "tree/TreeBase/TreeBase.tsx"), "utf-8"),
        readFile(
          resolve(__dirname, "tree/TreeBase/VirtualizedTree.tsx"),
          "utf-8",
        ),
        readFile(resolve(__dirname, "PagesSection.tsx"), "utf-8"),
      ]);

    expect(treeBaseSource).toContain('from "react-aria-components"');
    expect(treeBaseSource).not.toContain("@composition/shared/components/Tree");
    expect(treeBaseSource).not.toContain("data-composition-tree");
    expect(virtualizedTreeSource).toContain("className={`virtual-tree-item");
    expect(virtualizedTreeSource).not.toContain("data-composition-tree");
    expect(pagesSource).toContain('className="elementItem active"');
  });
});

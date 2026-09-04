import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const NODE_SECTION_FILES = [
  "PagesSection.tsx",
  "LayersSection.tsx",
  "FramesTab/FrameList.tsx",
  "FramesTab/FrameElementTree.tsx",
];

// 네 섹션 전부 접기 가능 + persist id (Navigator UX 2·3단계). 헤더 전체 토글과
// SectionSplitStack 이 같은 id 를 읽는다.
const COLLAPSIBLE_SECTION_FILES: Record<string, string> = {
  "PagesSection.tsx": "id={NAVIGATOR_SECTION_IDS.pages}",
  "LayersSection.tsx": "id={NAVIGATOR_SECTION_IDS.layers}",
  "FramesTab/FrameList.tsx": "id={NAVIGATOR_SECTION_IDS.frames}",
  "FramesTab/FrameElementTree.tsx": "id={NAVIGATOR_SECTION_IDS.frameLayers}",
};

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
      'className={panelContents("navigator-panel-content")}',
    );
    expect(panelSource).toContain("<PanelHeader");
    expect(panelSource).toContain('panelId="navigator"');
    // 헤더 close 앞의 전체 접기/펼치기 — Pages/Layers Section id 집합을 그대로 읽는다
    expect(panelSource).toContain("<SectionGroupToggleButton");
    expect(panelSource).toContain("NAVIGATOR_PAGES_TAB_SECTION_IDS");
    expect(panelSource).toContain("NAVIGATOR_LAYOUTS_TAB_SECTION_IDS");
    expect(panelSource).not.toContain("isDisabled={activeTab");
    // 구조 클래스는 공용 단일 이름만 쓴다 — CSS 규칙이 없는 `navigator-panel-tabs/tabrow/tablist`
    // twin 은 2026-08-30 탭 통일에서 제거됐다 (panelTabs.static.test.ts 가 재도입을 막는다).
    expect(panelSource).toContain('className="panel-tabs"');
    expect(panelSource).toContain('className="panel-header panel-tabrow"');
    expect(tabsSource).toContain('className="panel-tablist"');
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
      expect(source).toContain(COLLAPSIBLE_SECTION_FILES[file]);
      expect(source).not.toContain("collapsible={false}");
      expect(source).not.toContain("PanelHeader");
      expect(source).not.toContain('className="section-content elements"');
    },
  );

  it("both tabs stack their two sections in the shared SectionSplitStack", async () => {
    const panelSource = await readFile(
      resolve(__dirname, "NavigatorPanel.tsx"),
      "utf-8",
    );
    const framesSource = await readFile(
      resolve(__dirname, "FramesTab/FramesTab.tsx"),
      "utf-8",
    );

    expect(panelSource).toContain("<SectionSplitStack");
    expect(panelSource).toContain("storageKey={NAVIGATOR_SPLIT_STORAGE_KEYS.pages}");
    expect(panelSource).toContain("topId={NAVIGATOR_SECTION_IDS.pages}");
    expect(panelSource).toContain("bottomId={NAVIGATOR_SECTION_IDS.layers}");
    expect(framesSource).toContain("<SectionSplitStack");
    expect(framesSource).toContain("storageKey={NAVIGATOR_SPLIT_STORAGE_KEYS.layouts}");
    expect(framesSource).toContain("topId={NAVIGATOR_SECTION_IDS.frames}");
    expect(framesSource).toContain("bottomId={NAVIGATOR_SECTION_IDS.frameLayers}");

    // 탭 컨텐츠는 스크롤 컨테이너가 아니다 — 각 섹션이 따로 스크롤한다
    const css = await readFile(
      resolve(__dirname, "NavigatorPanel.css"),
      "utf-8",
    );
    expect(css).toMatch(/\.navigator-panel-content \{[^}]*overflow: hidden;/s);
  });

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
      /\.navigator-panel-content \.react-aria-TreeItem \{[^}]*min-height: var\(--control-size\);[^}]*border-radius: var\(--radius-md\);/s,
    );
    expect(css).toMatch(
      /\.elementItem \{[^}]*min-height: var\(--control-size\);[^}]*padding-inline: var\(--spacing\);[^}]*border-radius: var\(--radius-md\);/s,
    );
    expect(css).toMatch(
      /\.elementItemIndent \{[^}]*height: var\(--control-size\);/s,
    );
    // 크기는 `styles/modules/builder-control-size.css` 의 기본 티어(28px)가 소유한다 —
    // 구 `--text-xl` 고정(20px)은 티어 밖 세 번째 크기였다 (controlSize.static.test.ts).
    expect(css).toMatch(
      /\.elementItemActions \.iconButton \{[^}]*border-radius: var\(--radius-md\);/s,
    );
    expect(css).not.toMatch(
      /\.elementItemActions \.iconButton \{[^}]*(width|height): var\(--text-xl\);/s,
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

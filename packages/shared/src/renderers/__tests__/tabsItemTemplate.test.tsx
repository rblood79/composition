import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type {
  PreviewElement,
  RenderContext,
  TagItemTemplate,
} from "../../types/renderer.types";
import { renderTabs } from "../LayoutRenderers";

/**
 * ADR-233 Phase 1 — Preview `renderTabs` 가 Tab 항목 template (Components 페이지
 * `component-tab-item-*` origin) 을 적용하는 DOM 계약. builder Skia `appendTabRowProjection` 과 같은 규칙:
 *  - rootStyles.base 는 모든 Tab inline style, selected 는 선택된 Tab 에만 overlay
 *  - template null = 기존 Tab 그대로 (inline style 없음)
 */

const ITEMS = [
  { id: "t1", title: "One" },
  { id: "t2", title: "Two" },
];

function makeContext(
  element: PreviewElement,
  tabTemplate: TagItemTemplate | null,
): RenderContext {
  const panels: PreviewElement = {
    id: "tabs-1__panels",
    type: "TabPanels",
    props: {},
    parent_id: element.id,
  };
  const panelChildren: PreviewElement[] = ITEMS.map((item) => ({
    id: `tabs-1__panel-${item.id}`,
    type: "TabPanel",
    props: { itemId: item.id },
    parent_id: panels.id,
  }));
  const all = [element, panels, ...panelChildren];
  return {
    elements: all,
    elementsById: new Map(all.map((e) => [e.id, e] as const)),
    childrenByParent: new Map([
      [element.id, [panels]],
      [panels.id, panelChildren],
    ]),
    updateElementProps: () => {},
    batchUpdateElementProps: () => {},
    setElements: () => {},
    renderElement: () => null,
    tabTemplate,
  };
}

function html(tabTemplate: TagItemTemplate | null): string {
  const tabs: PreviewElement = {
    id: "tabs-1",
    type: "Tabs",
    props: { items: ITEMS, defaultSelectedKey: "t2" },
  };
  return renderToStaticMarkup(
    <>{renderTabs(tabs, makeContext(tabs, tabTemplate))}</>,
  );
}

/** Tab 의 여는 태그 (data-key 로 찾는다 — selected Tab 은 안에 indicator div 가 있다). */
function tabTag(markup: string, key: string): string {
  const found = markup.match(new RegExp(`<div[^>]*data-key="${key}"[^>]*>`));
  expect(found, `Tab ${key}`).not.toBeNull();
  return found![0];
}

describe("ADR-233 — renderTabs Tab 항목 template", () => {
  const template: TagItemTemplate = {
    composition: null,
    selectedComposition: null,
    rootStyles: {
      base: { paddingLeft: 20, fontWeight: 700 },
      selected: { borderColor: "#ff0000" },
    },
  };

  it("base style 은 모든 Tab, selected overlay 는 선택된 Tab 에만", () => {
    const markup = html(template);
    const one = tabTag(markup, "t1");
    const two = tabTag(markup, "t2");
    expect(one).toContain("padding-left:20px");
    expect(one).toContain("font-weight:700");
    // 생성 CSS 고정 높이 (md 29) 대신 auto + 하한 29 (Skia 와 같은 shared 규칙).
    expect(one).toContain("height:auto");
    expect(one).toContain("min-height:29px");
    expect(one).not.toContain("border-color");
    expect(two).toContain('data-selected="true"');
    expect(two).toContain("padding-left:20px");
    expect(two).toContain("border-color:#ff0000");
  });

  it("template null 이면 Tab 에 inline style 이 없다 (종전)", () => {
    const markup = html(null);
    expect(tabTag(markup, "t1")).not.toContain("style=");
    expect(tabTag(markup, "t2")).not.toContain("style=");
  });
});

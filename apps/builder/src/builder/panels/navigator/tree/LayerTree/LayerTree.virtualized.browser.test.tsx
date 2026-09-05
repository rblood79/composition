import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { I18nProvider } from "@/i18n";
import { ContextMenuProvider } from "../../../../components/overlay/contextMenu";
import type { PanelNode } from "../../../panelNode";
import { LayerTree } from "./LayerTree";
import { LAYER_TREE_ROW_SIZE_PX } from "./virtualization";
import { TreeBase } from "../TreeBase/TreeBase";
import "@composition/shared/components/styles/theme/shared-tokens.css";
import "@composition/shared/components/styles/theme/builder-system.css";
import "../../NavigatorPanel.css";
import "../../../../components/panel/SectionSplitStack.css";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const { renderContent } = vi.hoisted(() => ({ renderContent: vi.fn() }));
vi.mock("./LayerTreeItemContent", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("./LayerTreeItemContent")>();
  return {
    ...original,
    LayerTreeItemContent: (
      props: React.ComponentProps<typeof original.LayerTreeItemContent>,
    ) => {
      renderContent();
      return <original.LayerTreeItemContent {...props} />;
    },
  };
});

let root: Root | undefined;
let host: HTMLDivElement;
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  host?.remove();
  renderContent.mockClear();
});

function fixture(count: number): PanelNode[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index === 0 ? "body" : `node-${index}`,
    type: index === 0 ? "body" : "Text",
    parent_id: index === 0 ? null : "body",
    props: { children: `Layer ${index}` },
  }));
}

async function mount(
  elements: PanelNode[],
  selectedElementId: string | null = null,
) {
  if (!root) {
    host = document.createElement("div");
    host.className = "navigator-panel-content";
    // viewport만 고정하고 행 높이는 실제 Builder token/CSS에서 읽는다.
    host.style.width = "320px";
    document.body.append(host);
    root = createRoot(host);
  }
  await act(async () => {
    root!.render(
      <I18nProvider>
        <ContextMenuProvider>
          <div className="split-pane">
            <section className="section" data-section-id="navigator-layers">
              <div
                className="section-content"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: 320,
                }}
              >
                <LayerTree
                  elements={elements}
                  expandedKeys={new Set(["body"])}
                  selectedElementId={selectedElementId}
                  onSelectionChange={() => {}}
                  onItemDelete={async () => {}}
                />
              </div>
            </section>
          </div>
        </ContextMenuProvider>
      </I18nProvider>,
    );
  });
  await vi.waitFor(() =>
    expect(host.querySelectorAll('[role="row"]').length).toBeGreaterThan(0),
  );
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

it("600/5k 실제 LayerTree에서 가시 행과 선택 renderContent 비용을 제한한다", async () => {
  const counts: number[] = [];
  for (const size of [600, 5000]) {
    const elements = fixture(size);
    await mount(elements);
    const tree = host.querySelector<HTMLElement>(
      ".layer-tree--rac-virtualized",
    );
    expect(tree).not.toBeNull();
    const rows = tree!.querySelectorAll<HTMLElement>('[role="row"]');
    counts.push(rows.length);
    expect(rows.length).toBeLessThanOrEqual(18);
    expect(tree!.clientHeight).toBe(320);
    expect(getComputedStyle(tree!).overflowY).toBe("auto");
    expect(
      getComputedStyle(host.querySelector(".section-content")!).overflowY,
    ).toBe("hidden");
    for (const row of rows) {
      expect(row.getBoundingClientRect().height).toBe(LAYER_TREE_ROW_SIZE_PX);
      expect(
        row.querySelector(".elementItem")!.getBoundingClientRect().height,
      ).toBe(LAYER_TREE_ROW_SIZE_PX);
    }
    renderContent.mockClear();
    for (let index = 1; index <= 10; index++) {
      await mount(elements, `node-${index}`);
      const selected = tree!.querySelector(`[data-key="node-${index}"]`)!;
      expect(selected.getAttribute("aria-selected")).toBe("true");
      expect(selected.querySelector(".elementItem.active")).not.toBeNull();
      expect(tree!.querySelectorAll(".elementItem.active").length).toBe(1);
    }
    expect(renderContent.mock.calls.length).toBeLessThanOrEqual(180);
    await act(async () => root!.unmount());
    root = undefined;
    host.remove();
  }
  expect(Math.abs(counts[0] - counts[1])).toBeLessThanOrEqual(1);
}, 60_000);

it("화면 밖 End/Home 포커스와 typeahead는 RAC 경로로 스크롤한다", async () => {
  await mount(fixture(600));
  const tree = host.querySelector<HTMLElement>(".layer-tree--rac-virtualized")!;
  await act(async () => {
    await userEvent.click(tree.querySelector('[data-key="node-1"]')!);
    await userEvent.keyboard("{End}");
  });
  await vi.waitFor(() =>
    expect(document.activeElement?.getAttribute("data-key")).toBe("node-599"),
  );
  expect(tree.scrollTop).toBeGreaterThan(0);
  await act(async () => {
    await userEvent.keyboard("{Home}");
  });
  await vi.waitFor(() =>
    expect(document.activeElement?.getAttribute("data-key")).toBe("body"),
  );
  expect(tree.scrollTop).toBe(0);
  await act(async () => {
    await userEvent.keyboard("t");
  });
  await vi.waitFor(() =>
    expect(document.activeElement?.getAttribute("data-key")).toBe("node-1"),
  );
});

it("opt-in하지 않은 공용 TreeBase는 전체 행을 유지한다", async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const items = Array.from({ length: 40 }, (_, index) => ({
    id: `plain-${index}`,
    parentId: null,
    depth: 0,
    hasChildren: false,
  }));
  await act(async () => {
    root!.render(
      <TreeBase
        aria-label="Non-virtualized consumer"
        items={items}
        getKey={(node) => node.id}
        getTextValue={(node) => node.id}
        renderContent={(node) => <span>{node.id}</span>}
      />,
    );
  });
  expect(host.querySelectorAll('[role="row"]')).toHaveLength(40);
  expect(host.querySelector(".layer-tree--rac-virtualized")).toBeNull();
});

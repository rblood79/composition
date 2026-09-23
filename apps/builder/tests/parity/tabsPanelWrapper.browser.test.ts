import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Root } from "react-dom/client";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import { useStore } from "@/builder/stores";
import { paletteCreationTree, layoutTree } from "./adr923ProductionTrees";
import { mountProductionRoot } from "./adr923PreviewLeg";

vi.mock("@/builder/factories/utils/elementCreation", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/builder/factories/utils/elementCreation")
    >();
  return { ...actual, addElementsToStore: () => [] };
});

/**
 * Tabs 의 TabPanels 래퍼 (2026-09-18, ADR-223 후속 3) — Preview `renderTabs` 는 RAC `<Tabs>` 안에 TabList 와
 * TabPanel 을 **직계**로 그리고 canonical `TabPanels` 상자는 그리지 않는다 (`renderTabPanels` → null). 그런데
 * Canvas 는 TabPanels 래퍼에 padding 12 (catalog `TabPanels.sizes.md.paddingX/Y` + implicitStyles 주입) 를
 * 실어 TabPanel 이 (12, 12) 에 놓이고 Tabs 높이가 77 (DOM 53) 이었다 — DOM 에 상자가 없는 래퍼의 padding 은
 * Skia 전용 채널이다. 정본 = TabPanel 자기 padding 12 (양쪽 공통), 래퍼는 0.
 *
 * 오라클: 팔레트 Tabs production 트리 → preview 실렌더 (root 높이 · TabPanel 의 Tabs 기준 y) vs production
 * `calculateFullTreeLayout` (같은 트리, 폭 400).
 */

const roots: Root[] = [];
let host: HTMLElement | undefined;
let dom: { tabsH: number; panelY: number; panelH: number } | undefined;
let pipe: { tabsH: number; panelY: number; panelH: number } | undefined;
// ADR-234 Phase 3c — Tab instance 폭 (label 이 Tab 글자를 상속: DOM CSS inherit ↔ Canvas resolver).
let tabW: { dom: number[]; pipe: number[] } | undefined;

beforeAll(async () => {
  await initEngineWasm();
  useStore.setState({ elements: [], elementsMap: new Map() });
  const style = document.createElement("style");
  style.id = "tabs-bundle";
  style.textContent = bundleCss;
  document.head.appendChild(style);
  injectPreviewBaseStyles(document);
  host = document.createElement("div");
  host.style.cssText = "position:absolute;top:0;left:0;width:400px;";
  document.body.appendChild(host);

  const tree = await paletteCreationTree("Tabs", "tabs-wrapper");
  // ADR-234 Phase 3c — Tab instance 의 label (Text) 까지 그리도록 canonical 폴백.
  const mounted = await mountProductionRoot(
    host,
    roots,
    tree.elements,
    "page",
    true,
  );
  if (!mounted) throw new Error("Tabs: DOM root 없음");
  await new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r())),
  );
  const tabs = host.querySelector<HTMLElement>(".react-aria-Tabs");
  const panel = host.querySelector<HTMLElement>(".react-aria-TabPanel");
  if (!tabs || !panel) throw new Error("Tabs / TabPanel DOM 없음");
  const domTabs = Array.from(host.querySelectorAll<HTMLElement>(".react-aria-Tab"));
  const tr = tabs.getBoundingClientRect();
  const pr = panel.getBoundingClientRect();
  dom = { tabsH: tr.height, panelY: pr.y - tr.y, panelH: pr.height };

  const root = tree.elements[0];
  const run = layoutTree(root.id, tree.elements, 400, -1);
  const tabsBox = run.layout.get(root.id);
  const panelsEl = tree.elements.find((e) => e.type === "TabPanels");
  const panelEl = tree.elements.find((e) => e.type === "TabPanel");
  const panelsBox = panelsEl ? run.layout.get(panelsEl.id) : undefined;
  const panelBox = panelEl ? run.layout.get(panelEl.id) : undefined;
  if (!tabsBox || !panelsBox || !panelBox)
    throw new Error("layout: Tabs / TabPanels / TabPanel box 없음");
  tabW = {
    dom: domTabs.map((t) => t.getBoundingClientRect().width),
    pipe: tree.elements
      .filter((e) => e.type === "Tab")
      .map((e) => run.layout.get(e.id)?.width ?? -1),
  };
  // ComputedLayout 은 부모 기준 — TabPanel 의 Tabs 기준 y = TabPanels.y + TabPanel.y
  pipe = {
    tabsH: tabsBox.height,
    panelY: panelsBox.y + panelBox.y,
    panelH: panelBox.height,
  };
  console.log(
    `TABSWRAP dom=${JSON.stringify(dom)} pipe=${JSON.stringify(pipe)}`,
  );
});

afterAll(() => {
  for (const r of roots) r.unmount();
  host?.remove();
  document.getElementById("tabs-bundle")?.remove();
});

describe("Tabs — TabPanels 래퍼는 DOM 에 상자가 없다 (padding 0)", () => {
  it("Tabs 높이 DOM = layout (Δ ≤ 1)", () => {
    expect(
      Math.abs(dom!.tabsH - pipe!.tabsH),
      `dom ${dom!.tabsH} pipe ${pipe!.tabsH}`,
    ).toBeLessThanOrEqual(1);
  });
  it("TabPanel 의 Tabs 기준 y 와 높이 DOM = layout (Δ ≤ 1)", () => {
    expect(
      Math.abs(dom!.panelY - pipe!.panelY),
      `y dom ${dom!.panelY} pipe ${pipe!.panelY}`,
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(dom!.panelH - pipe!.panelH),
      `h dom ${dom!.panelH} pipe ${pipe!.panelH}`,
    ).toBeLessThanOrEqual(1);
  });
  it("ADR-234 Phase 3c — Tab instance 폭 DOM = layout (Δ ≤ 1, label 이 Tab 글자 상속)", () => {
    expect(tabW!.dom.length, JSON.stringify(tabW)).toBe(tabW!.pipe.length);
    expect(tabW!.dom.length).toBeGreaterThan(0);
    tabW!.dom.forEach((w, i) => {
      expect(Math.abs(w - tabW!.pipe[i]!), JSON.stringify(tabW)).toBeLessThanOrEqual(1);
    });
  });
});

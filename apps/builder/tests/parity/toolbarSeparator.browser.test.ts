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
 * Toolbar 안 Separator (2026-09-18, ADR-223 후속 4) — 팔레트 Toolbar (reusable origin: Button×3 + vertical
 * Separator) 를 preview 로 실렌더한 DOM vs production layout.
 *
 * 종전 발산 2: (a) implicitStyles 가 Separator margin 을 orientation 과 무관하게 **상하** 에 실어 vertical
 * separator 가 row cross 를 키웠다 (Toolbar 29 / DOM 22) · (b) catalog `Toolbar.composition.staticSelectors`
 * (`.react-aria-Toolbar .react-aria-Separator` — align-self stretch · vertical margin 0 10px) 는 DOM 전용
 * 채널이라 좌우 간격이 Skia 8 / DOM 18 이었다. 버튼 폭은 텍스트 측정 (CanvasKit vs DOM) 차가 있어 x 는
 * 누적 tolerance 로 잰다 — 이 케이스의 축은 root 높이 · separator y · separator 좌우 간격이다.
 */

const roots: Root[] = [];
let host: HTMLElement | undefined;
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
let dom: { root: Box; buttons: Box[]; sep: Box } | undefined;
let pipe: { root: Box; buttons: Box[]; sep: Box } | undefined;

beforeAll(async () => {
  await initEngineWasm();
  useStore.setState({ elements: [], elementsMap: new Map() });
  const style = document.createElement("style");
  style.id = "toolbar-bundle";
  style.textContent = bundleCss;
  document.head.appendChild(style);
  injectPreviewBaseStyles(document);
  host = document.createElement("div");
  host.style.cssText = "position:absolute;top:0;left:0;width:400px;";
  document.body.appendChild(host);

  const tree = await paletteCreationTree("Toolbar", "toolbar-sep");
  const mounted = await mountProductionRoot(host, roots, tree.elements);
  if (!mounted) throw new Error("Toolbar: DOM root 없음");
  await new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r())),
  );
  const rootEl = host.querySelector<HTMLElement>(".react-aria-Toolbar");
  if (!rootEl) throw new Error(".react-aria-Toolbar 없음");
  const rr = rootEl.getBoundingClientRect();
  const rel = (el: Element): Box => {
    const r = el.getBoundingClientRect();
    return { x: r.x - rr.x, y: r.y - rr.y, w: r.width, h: r.height };
  };
  const sepEl = rootEl.querySelector(".react-aria-Separator");
  if (!sepEl) throw new Error(".react-aria-Separator 없음");
  dom = {
    root: { x: 0, y: 0, w: rr.width, h: rr.height },
    buttons: [...rootEl.querySelectorAll(".react-aria-Button")].map(rel),
    sep: rel(sepEl),
  };

  const root = tree.elements[0];
  const run = layoutTree(root.id, tree.elements, 400, -1);
  const box = (id: string): Box => {
    const l = run.layout.get(id);
    if (!l) throw new Error(`layout 없음: ${id}`);
    return { x: l.x, y: l.y, w: l.width, h: l.height };
  };
  const buttons = tree.elements.filter((e) => e.type === "Button");
  const sep = tree.elements.find((e) => e.type === "Separator");
  if (!sep) throw new Error("Separator 없음");
  const rb = box(root.id);
  pipe = {
    root: { x: 0, y: 0, w: rb.w, h: rb.h },
    buttons: buttons.map((b) => box(b.id)),
    sep: box(sep.id),
  };
  console.log(
    `TOOLBARSEP dom=${JSON.stringify(dom)} pipe=${JSON.stringify(pipe)}`,
  );
});

afterAll(() => {
  for (const r of roots) r.unmount();
  host?.remove();
  document.getElementById("toolbar-bundle")?.remove();
});

describe("Toolbar — vertical Separator 의 margin 축과 Toolbar staticSelectors 가 layout 에 닿는다", () => {
  it("Toolbar 높이 = 버튼 행 (separator 상하 margin 이 cross 를 키우지 않는다)", () => {
    expect(
      Math.abs(dom!.root.h - pipe!.root.h),
      `h dom ${dom!.root.h} pipe ${pipe!.root.h}`,
    ).toBeLessThanOrEqual(1);
  });

  it("Separator y/h — align-self stretch + 명시 height 20 → cross-start", () => {
    expect(Math.abs(dom!.sep.y - pipe!.sep.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(dom!.sep.h - pipe!.sep.h)).toBeLessThanOrEqual(1);
  });

  it("Separator 좌우 간격 = gap 8 + margin 10 (앞 버튼 오른쪽 → separator, separator → 뒤 버튼)", () => {
    const gapBefore = (s: { buttons: Box[]; sep: Box }) =>
      s.sep.x - (s.buttons[1].x + s.buttons[1].w);
    const gapAfter = (s: { buttons: Box[]; sep: Box }) =>
      s.buttons[2].x - (s.sep.x + s.sep.w);
    expect(
      Math.abs(gapBefore(dom!) - gapBefore(pipe!)),
      `before dom ${gapBefore(dom!)} pipe ${gapBefore(pipe!)}`,
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(gapAfter(dom!) - gapAfter(pipe!)),
      `after dom ${gapAfter(dom!)} pipe ${gapAfter(pipe!)}`,
    ).toBeLessThanOrEqual(1);
  });
  // root 폭은 재지 않는다 — layoutTree 의 root 는 available (400) 을 그대로 받아 fit-content 가 아니고,
  //   버튼 폭도 텍스트 측정 (CanvasKit vs DOM) 차가 있다 (memory: reference-parity-harness-font-asymmetry).
});

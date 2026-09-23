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
 * ADR-234 Phase 3e — 팔레트 GridList = origin 의 GridListItem instance 자식 3 (Label · Description), 2열 grid.
 *
 * DOM 은 `GridList.css` (카드 padding 12/16 · gap 2 · label 600 · description muted, 둘 다 Text 기본 16) 로,
 * Canvas 는 implicitStyles slot 주입으로 같은 상자를 낸다. 오라클: production Preview 경로 (트리 전체
 * CanonicalNodeRenderer) 실렌더 vs production `calculateFullTreeLayout` (같은 트리, 폭 400) — GridList 기준
 * 카드 x · y · 폭 · 높이, 카드 기준 slot 자식 x · y · 높이.
 */

type Box = { x: number; y: number; w: number; h: number };

const roots: Root[] = [];
let host: HTMLElement | undefined;
const dom = new Map<string, Box>();
const pipe = new Map<string, Box>();
let itemIds: string[] = [];
let slotIds: Array<{ item: string; id: string; role: string }> = [];

beforeAll(async () => {
  await initEngineWasm();
  useStore.setState({ elements: [], elementsMap: new Map() });
  const style = document.createElement("style");
  style.id = "gridlist-bundle";
  style.textContent = bundleCss;
  document.head.appendChild(style);
  injectPreviewBaseStyles(document);
  host = document.createElement("div");
  host.style.cssText = "position:absolute;top:0;left:0;width:400px;";
  document.body.appendChild(host);

  const tree = await paletteCreationTree("GridList", "static-gridlist");
  const byParent = (id: string) =>
    tree.elements.filter((e) => e.parent_id === id);
  itemIds = byParent(tree.root.id)
    .filter((e) => e.type === "GridListItem")
    .map((e) => e.id);
  slotIds = itemIds.flatMap((item) =>
    byParent(item).map((c) => ({
      item,
      id: c.id,
      role: String((c.props as Record<string, unknown>).slot ?? ""),
    })),
  );

  const mounted = await mountProductionRoot(
    host,
    roots,
    tree.elements,
    "page",
    false,
    true,
  );
  if (!mounted) throw new Error("GridList: DOM root 없음");
  await new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r())),
  );
  const rectOf = (id: string): DOMRect | undefined =>
    host!
      .querySelector<HTMLElement>(
        `[data-element-id="${id}"]:not([style*="display: contents"])`,
      )
      ?.getBoundingClientRect();
  const rootRect = host!
    .querySelector<HTMLElement>(
      `[data-element-id="${tree.root.id}"]:not([data-canonical-id])`,
    )!
    .getBoundingClientRect();
  for (const item of itemIds) {
    const ir = rectOf(item);
    if (!ir) continue;
    dom.set(item, {
      x: ir.left - rootRect.left,
      y: ir.top - rootRect.top,
      w: ir.width,
      h: ir.height,
    });
    for (const s of slotIds.filter((x) => x.item === item)) {
      const r = rectOf(s.id);
      if (r) {
        dom.set(s.id, {
          x: r.left - ir.left,
          y: r.top - ir.top,
          w: r.width,
          h: r.height,
        });
      }
    }
  }

  const run = layoutTree(tree.root.id, tree.elements, 400, -1);
  for (const id of [...itemIds, ...slotIds.map((s) => s.id)]) {
    const l = run.layout.get(id);
    if (l) pipe.set(id, { x: l.x, y: l.y, w: l.width, h: l.height });
  }
  console.log(
    "ADR234P3E",
    JSON.stringify({
      dom: Object.fromEntries(dom),
      pipe: Object.fromEntries(pipe),
    }),
  );
});

afterAll(() => {
  for (const r of roots) r.unmount();
  host?.remove();
  document.getElementById("gridlist-bundle")?.remove();
});

describe("ADR-234 Phase 3e — 정적 GridList 카드 상자 DOM = layout", () => {
  it("팔레트 GridList 는 GridListItem 3 · 각 label/description 자식", () => {
    expect(itemIds).toHaveLength(3);
    expect(slotIds).toHaveLength(6);
  });

  it("카드의 GridList 기준 x · y · 폭 · 높이 (Δ ≤ 1 — 2열 grid)", () => {
    for (const id of itemIds) {
      const d = dom.get(id)!;
      const p = pipe.get(id)!;
      for (const k of ["x", "y", "w", "h"] as const) {
        expect(Math.abs(d[k] - p[k]), `${id} ${k}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("slot 자식의 카드 기준 x · y · 높이 (Δ ≤ 1)", () => {
    for (const s of slotIds) {
      const d = dom.get(s.id)!;
      const p = pipe.get(s.id)!;
      expect(Math.abs(d.x - p.x), `${s.id} x`).toBeLessThanOrEqual(1);
      expect(Math.abs(d.y - p.y), `${s.id} y`).toBeLessThanOrEqual(1);
      expect(Math.abs(d.h - p.h), `${s.id} h`).toBeLessThanOrEqual(1);
    }
  });
});

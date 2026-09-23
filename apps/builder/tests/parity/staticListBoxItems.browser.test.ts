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
 * ADR-234 Phase 3d — 팔레트 ListBox = origin 의 ListBoxItem instance 자식 3 (Icon · Label · Description).
 *
 * DOM 은 항목 CSS (`ListBox.css` — `[slot="icon"]` 절대 위치 · `:has([slot="icon"])` 왼쪽 여백 · description
 * 12/16) 로, Canvas 는 implicitStyles slot 주입 + 엔진 absolute (containing block = padding box) 로 같은 상자를
 * 낸다. 오라클: production Preview 경로 (트리 전체 CanonicalNodeRenderer) 실렌더 vs production
 * `calculateFullTreeLayout` (같은 트리, 폭 400) — 항목 높이 · 항목 기준 slot 자식 x/y/높이 (icon 은 폭도).
 */

type Box = { x: number; y: number; w: number; h: number };

const roots: Root[] = [];
let host: HTMLElement | undefined;
const dom = new Map<string, Box>();
const pipe = new Map<string, Box>();
let itemIds: string[] = [];
let slotIds: Array<{ item: string; id: string; role: string }> = [];
let iconSvgSizes: Array<[number, number]> = [];

beforeAll(async () => {
  await initEngineWasm();
  useStore.setState({ elements: [], elementsMap: new Map() });
  const style = document.createElement("style");
  style.id = "listbox-bundle";
  style.textContent = bundleCss;
  document.head.appendChild(style);
  injectPreviewBaseStyles(document);
  host = document.createElement("div");
  host.style.cssText = "position:absolute;top:0;left:0;width:400px;";
  document.body.appendChild(host);

  const tree = await paletteCreationTree("ListBox", "static-listbox");
  const byParent = (id: string) =>
    tree.elements.filter((e) => e.parent_id === id);
  itemIds = byParent(tree.root.id)
    .filter((e) => e.type === "ListBoxItem")
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
  if (!mounted) throw new Error("ListBox: DOM root 없음");
  await new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r())),
  );
  const rectOf = (id: string): DOMRect | undefined =>
    host!
      .querySelector<HTMLElement>(
        `[data-element-id="${id}"]:not([style*="display: contents"])`,
      )
      ?.getBoundingClientRect();
  for (const item of itemIds) {
    const ir = rectOf(item);
    if (!ir) continue;
    dom.set(item, { x: 0, y: 0, w: ir.width, h: ir.height });
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

  iconSvgSizes = slotIds
    .filter((s) => s.role === "icon")
    .map((s) => {
      const r = host!
        .querySelector(`[data-element-id="${s.id}"] > svg`)
        ?.getBoundingClientRect();
      return [r?.width ?? -1, r?.height ?? -1];
    });

  const run = layoutTree(tree.root.id, tree.elements, 400, -1);
  for (const id of [...itemIds, ...slotIds.map((s) => s.id)]) {
    const l = run.layout.get(id);
    if (l) pipe.set(id, { x: l.x, y: l.y, w: l.width, h: l.height });
  }
  console.log(
    "ADR234P3D",
    JSON.stringify({
      dom: Object.fromEntries(dom),
      pipe: Object.fromEntries(pipe),
    }),
  );
});

afterAll(() => {
  for (const r of roots) r.unmount();
  host?.remove();
  document.getElementById("listbox-bundle")?.remove();
});

describe("ADR-234 Phase 3d — 정적 ListBox 항목 상자 DOM = layout", () => {
  it("팔레트 ListBox 는 ListBoxItem 3 · 각 icon/label/description slot 자식", () => {
    expect(itemIds).toHaveLength(3);
    expect(slotIds.map((s) => s.role)).toEqual([
      "icon",
      "label",
      "description",
      "icon",
      "label",
      "description",
      "icon",
      "label",
      "description",
    ]);
  });

  it("항목 높이 (Δ ≤ 1)", () => {
    for (const id of itemIds) {
      expect(
        Math.abs(dom.get(id)!.h - pipe.get(id)!.h),
        id,
      ).toBeLessThanOrEqual(1);
    }
  });

  it("slot 자식의 항목 기준 x · y · 높이 (Δ ≤ 1) — icon 은 폭도 (padding box 기준 absolute)", () => {
    for (const s of slotIds) {
      const d = dom.get(s.id)!;
      const p = pipe.get(s.id)!;
      expect(Math.abs(d.x - p.x), `${s.role} x`).toBeLessThanOrEqual(1);
      expect(Math.abs(d.y - p.y), `${s.role} y`).toBeLessThanOrEqual(1);
      expect(Math.abs(d.h - p.h), `${s.role} h`).toBeLessThanOrEqual(1);
      if (s.role === "icon") {
        expect(Math.abs(d.w - p.w), "icon w").toBeLessThanOrEqual(1);
      }
    }
  });

  it("icon glyph (svg) 가 slot 상자 16 을 채운다 — 이관 전 행의 `<Icon fontSize 16>` 과 같은 크기", () => {
    expect(iconSvgSizes).toEqual([
      [16, 16],
      [16, 16],
      [16, 16],
    ]);
  });
});

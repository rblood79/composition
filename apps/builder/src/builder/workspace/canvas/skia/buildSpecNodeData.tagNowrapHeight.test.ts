/**
 * Tag chip 텍스트 상자 높이 — nowrap 은 wrap 으로 재지 않는다 (2026-09-21 사용자 보고).
 *
 * "Label A" 처럼 공백이 있는 라벨은 chip content 폭이 글자 폭보다 1px 만 좁아도 Canvas 2D wrap 측정이
 * 2줄 (40) 로 잰다. 렌더 (nodeRendererText) 는 Tag 기본 nowrap 으로 한 줄을 그리되 그 상자
 * (paddingTop 0 · height 40) 중앙에 두어 글자가 6px 내려갔다. buildSpecNodeData 가 변환 **전에**
 * Tag/Badge 기본 nowrap 을 text shape 에 실어야 측정과 렌더가 같은 white-space 를 읽는다.
 */
import { describe, expect, it, vi } from "vitest";

// Canvas 2D mock — 글자당 8px (textMeasure.test.ts 와 같은 패턴). "Label A" = 56px.
const mockCtx = {
  font: "",
  letterSpacing: "0px",
  measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
};
vi.stubGlobal(
  "OffscreenCanvas",
  class {
    getContext() {
      return mockCtx;
    }
  },
);
Object.defineProperty(globalThis, "document", {
  value: {
    fonts: {
      check: vi.fn(() => true),
      load: vi.fn(() => Promise.resolve([])),
      ready: Promise.resolve(),
      addEventListener: vi.fn(),
    },
    createElement: vi.fn(() => ({ getContext: () => mockCtx })),
  },
  writable: true,
  configurable: true,
});
vi.stubGlobal("window", { dispatchEvent: vi.fn() });

import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import { buildSpecNodeData } from "./buildSpecNodeData";
import type { SkiaNodeData } from "./nodeRendererTypes";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";

function findText(node: SkiaNodeData | null | undefined): SkiaNodeData | null {
  if (!node) return null;
  if (node.text) return node;
  for (const child of node.children ?? []) {
    const found = findText(child);
    if (found) return found;
  }
  return null;
}

function buildTag(label: string, width: number): SkiaNodeData | null {
  const tag = {
    id: "t1",
    type: "Tag",
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    props: { children: label, style: { width: "fit-content" } },
  } as unknown as CanvasSceneNode;
  return buildSpecNodeData({
    element: tag,
    // md chip: border-box 30 (lineHeight 20 + paddingY 4×2 + border 1×2) · paddingX 12 → content 폭 = width − 26
    layout: { x: 0, y: 0, width, height: 30 } as ComputedLayout,
    theme: "light",
    elementsMap: new Map([[tag.id, tag]]),
  });
}

describe("Tag chip text box — nowrap 은 wrap 높이로 재지 않는다", () => {
  it("content 폭 (55) < 글자 폭 (56) 이어도 텍스트 상자는 1줄 높이 · 세로 중앙", () => {
    const text = findText(buildTag("Label A", 81));
    expect(text?.text?.whiteSpace).toBe("nowrap");
    // 1줄 (lineHeight 20) 을 상자 중앙에 — 종전엔 2줄 40 · paddingTop 0
    expect(text?.height).toBe(30);
    expect(text?.text?.paddingTop).toBe(5);
    expect(text?.text?.paddingBottom).toBe(5);
  });

  it("공백 없는 라벨 (넘쳐도 한 줄) 과 같은 상자", () => {
    const spaced = findText(buildTag("Label A", 81));
    const solid = findText(buildTag("LabelAA", 81));
    expect(spaced?.text?.paddingTop).toBe(solid?.text?.paddingTop);
    expect(spaced?.height).toBe(solid?.height);
  });
});

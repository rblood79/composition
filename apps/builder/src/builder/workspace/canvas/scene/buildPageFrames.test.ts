import { describe, expect, it } from "vitest";
import type { Page } from "../../../../types/core/store.types";
import type { CanvasSceneNode } from "./canvasSceneNode";
import { buildPageFrames } from "./buildSceneIndex";

const node = (
  id: string,
  type: string,
  page_id: string,
  style?: Record<string, unknown>,
): CanvasSceneNode =>
  ({ id, type, page_id, parent_id: null, props: style ? { style } : {} }) as unknown as CanvasSceneNode;

describe("buildPageFrames — 페이지 frame 크기는 body 저작 크기 (Styles Size) 를 따른다", () => {
  it("body height 1600px 인 페이지는 1920×1600, 나머지는 breakpoint 1920×1080", () => {
    const pages = [
      { id: "p1", title: "Home" },
      { id: "p2", title: "About" },
    ] as unknown as Page[];
    const elementsMap = new Map<string, CanvasSceneNode>([
      ["b1", node("b1", "body", "p1", { height: "1600px", overflow: "auto" })],
      ["t1", node("t1", "Text", "p1")],
      ["b2", node("b2", "body", "p2")],
    ]);
    const pageIndex = {
      elementsByPage: new Map([
        ["p1", new Set(["b1", "t1"])],
        ["p2", new Set(["b2"])],
      ]),
      rootsByPage: new Map(),
    };
    const frames = buildPageFrames(
      pages,
      pageIndex,
      elementsMap,
      { p1: { x: 0, y: 0 }, p2: { x: 0, y: 1160 } },
      1920,
      1080,
    );
    expect(frames.map((f) => [f.id, f.width, f.height])).toEqual([
      ["p1", 1920, 1600],
      ["p2", 1920, 1080],
    ]);
  });
});

describe("buildPageFrames — ADR-231 Components 페이지 frame 은 breakpoint 중립", () => {
  it("mobile 390×844 에서도 Components 는 1920 × max(1080, 발행 높이), 사용자 페이지는 390×844", () => {
    const pages = [
      {
        id: "page-components",
        title: "Components",
        slug: "/components",
        pageRole: "components",
        systemOwned: true,
      },
      { id: "p1", title: "Home" },
    ] as unknown as Page[];
    const elementsMap = new Map<string, CanvasSceneNode>([
      ["bc", node("bc", "body", "page-components", { overflow: "auto", display: "flex" })],
      ["b1", node("b1", "body", "p1")],
    ]);
    const pageIndex = {
      elementsByPage: new Map([
        ["page-components", new Set(["bc"])],
        ["p1", new Set(["b1"])],
      ]),
      rootsByPage: new Map(),
    };
    const positions = { "page-components": { x: -2000, y: 0 }, p1: { x: 0, y: 0 } };
    expect(
      buildPageFrames(pages, pageIndex, elementsMap, positions, 390, 844, new Map([["page-components", 3000]])).map(
        (f) => [f.id, f.width, f.height],
      ),
    ).toEqual([
      ["page-components", 1920, 3000],
      ["p1", 390, 844],
    ]);
    // 발행 전 (채널 없음) 은 floor 1080
    expect(
      buildPageFrames(pages, pageIndex, elementsMap, positions, 390, 844).map((f) => [f.id, f.width, f.height]),
    ).toEqual([
      ["page-components", 1920, 1080],
      ["p1", 390, 844],
    ]);
  });
});

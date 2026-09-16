import { describe, expect, it } from "vitest";
import { buildPageTitleBounds } from "./skiaOverlayHelpers";

/**
 * 페이지 드래그 히트 영역 = 헤더 띠 전체 (2026-09-17 사용자 요청 — 타이틀 글리프만
 * 잡히던 것을 띠 어디서나 잡히게). `textScene*` 는 inline 편집기용 글리프 box 그대로.
 */
describe("buildPageTitleBounds — 헤더 띠 전체가 드래그 히트 영역", () => {
  const measured = { titleWidth: 60, textX: 8, textTop: -22, textHeight: 12 };

  it("zoom 1: sceneRect 는 (x, y-32, width, 32), textScene* 는 글리프 box", () => {
    const b = buildPageTitleBounds(
      { pageId: "p1", x: 100, y: 200, width: 390 },
      measured,
      1,
    );
    expect(b).toEqual({
      pageId: "p1",
      sceneX: 100,
      sceneY: 168,
      sceneWidth: 390,
      sceneHeight: 32,
      textSceneX: 108,
      textSceneY: 178,
      textSceneWidth: 60,
      textSceneHeight: 12,
    });
  });

  it("zoom 2: 띠 높이는 scene 16 (화면 32 고정), 폭은 page width 그대로", () => {
    const b = buildPageTitleBounds(
      { pageId: "p1", x: 0, y: 0, width: 390 },
      measured,
      2,
    );
    expect(b.sceneY).toBe(-16);
    expect(b.sceneHeight).toBe(16);
    expect(b.sceneWidth).toBe(390);
    expect(b.textSceneX).toBe(4);
    expect(b.textSceneHeight).toBe(6);
  });
});

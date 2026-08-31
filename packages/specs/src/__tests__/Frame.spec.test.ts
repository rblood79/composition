import { describe, it, expect } from "vitest";
import { TAG_SPEC_MAP, getElementForTag } from "../runtime/tagToElement";
import { FrameSpec } from "../components/Frame.spec";

// ADR-130 Phase 1 — Gate G1
describe("FrameSpec (ADR-130)", () => {
  it("getSpecForTag('frame') !== undefined", () => {
    expect(TAG_SPEC_MAP["frame"]).toBeDefined();
    expect(TAG_SPEC_MAP["frame"]).toBe(FrameSpec);
  });

  it("getElementForTag('frame') === 'div'", () => {
    expect(getElementForTag("frame")).toBe("div");
  });

  it("FrameSpec.skipCSSGeneration === true", () => {
    expect(FrameSpec.skipCSSGeneration).toBe(true);
  });

  it("FrameSpec.name === 'frame'", () => {
    expect(FrameSpec.name).toBe("frame");
  });

  // ADR-198 (2026-08-31) — 이 함수가 `props.style` 을 읽지 않아 사용자가 칠한
  // 프레임 배경이 Skia 픽셀에 도달하지 못했다. frame 은 catalog 미등록이라
  // 여기가 Skia 가 그릴 것을 정하는 유일한 자리다.
  describe("render.shapes — 배경 (ADR-198)", () => {
    const bgOf = (props: Record<string, unknown>) =>
      FrameSpec.render
        .shapes(props as never, undefined as never, undefined as never)
        .find((s) => s.type === "roundRect" && s.id === "bg");

    it("배경색이 있으면 배경 box 를 낸다", () => {
      const bg = bgOf({ style: { backgroundColor: "#2F6FED" } });
      expect(bg).toMatchObject({
        type: "roundRect",
        id: "bg",
        x: 0,
        y: 0,
        width: "auto",
        height: "auto",
        fill: "#2F6FED",
        presentationRole: "background-fill",
      });
    });

    it("자식이 있어도 배경은 그대로 나온다", () => {
      // 회귀 방향이 중요하다: 예전에는 자식이 있으면 shape 자체를 0개 냈다.
      const bg = bgOf({
        style: { backgroundColor: "#2F6FED" },
        _hasChildren: true,
      });
      expect(bg).toBeDefined();
    });

    it("배경색이 없으면 배경 box 를 내지 않는다", () => {
      expect(bgOf({})).toBeUndefined();
      expect(bgOf({ style: {} })).toBeUndefined();
      expect(bgOf({ style: { backgroundColor: "transparent" } })).toBeUndefined();
      expect(bgOf({ style: { backgroundColor: "" } })).toBeUndefined();
    });

    it("borderRadius 를 배경 box 반경으로 옮긴다", () => {
      expect(bgOf({ style: { backgroundColor: "#FFF", borderRadius: 8 } })).toMatchObject({ radius: 8 });
      expect(bgOf({ style: { backgroundColor: "#FFF", borderRadius: "12px" } })).toMatchObject({ radius: 12 });
      // 해석 못 하는 표기는 0 — 임의 추측보다 사각 배경이 낫다
      expect(bgOf({ style: { backgroundColor: "#FFF", borderRadius: "50%" } })).toMatchObject({ radius: 0 });
    });

    it("자식이 없으면 container shape 도 함께 낸다", () => {
      const shapes = FrameSpec.render.shapes(
        { style: {} } as never,
        undefined as never,
        undefined as never,
      );
      expect(shapes.some((s) => s.type === "container")).toBe(true);
    });
  });
});

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

    it("테두리는 shape 으로 내지 않는다 — overlay 채널 하나 (ADR-219), bg box 는 낸다", () => {
      // ADR-198 때는 여기서 border shape 을 냈다. overlay 가 longhand 를 읽게 되면서
      // 두 채널이 같은 테두리를 두 번 그려 (반투명에서 드러남) shape 쪽을 걷어냈다.
      const shapes = FrameSpec.render.shapes(
        {
          style: {
            backgroundColor: "#2F6FED",
            borderTopWidth: "2px",
            borderRightWidth: "2px",
            borderBottomWidth: "2px",
            borderLeftWidth: "2px",
            borderTopStyle: "solid",
            borderRightStyle: "solid",
            borderBottomStyle: "solid",
            borderLeftStyle: "solid",
            borderTopColor: "#102A5C",
            borderRightColor: "#102A5C",
            borderBottomColor: "#102A5C",
            borderLeftColor: "#102A5C",
            borderRadius: "12px",
          },
        } as never,
        undefined as never,
        undefined as never,
      );
      expect(shapes.find((s) => s.type === "border")).toBeUndefined();
      expect(shapes.find((s) => s.id === "bg")).toMatchObject({ radius: 12 });
    });

    it("shorthand 표기도 읽는다 (store 는 longhand 를 쓰지만 둘 다 온다)", () => {
      const shapes = FrameSpec.render.shapes(
        {
          style: {
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: "#000000",
          },
        } as never,
        undefined as never,
        undefined as never,
      );
      // 배경이 없어도 테두리를 붙일 bg box 를 낸다 — 없으면 overlay stroke 가 붙을 곳이 없다.
      expect(shapes.find((s) => s.id === "bg")).toMatchObject({
        fill: "transparent",
      });
      expect(shapes.find((s) => s.type === "border")).toBeUndefined();
    });

    it("테두리가 없거나 그릴 수 없으면 (배경도 없을 때) bg box 를 내지 않는다", () => {
      const bg = (style: Record<string, unknown>) =>
        FrameSpec.render
          .shapes(
            { style } as never,
            undefined as never,
            undefined as never,
          )
          .find((s) => s.id === "bg");

      expect(bg({})).toBeUndefined();
      // 두께 0 / style none / 색 없음 — 각각 단독으로 테두리를 막는다
      expect(bg({ borderWidth: 0, borderColor: "#000" })).toBeUndefined();
      expect(
        bg({ borderWidth: 2, borderStyle: "none", borderColor: "#000" }),
      ).toBeUndefined();
      expect(bg({ borderWidth: 2, borderStyle: "solid" })).toBeUndefined();
      // 변 longhand 하나만 있어도 붙일 상자를 낸다
      expect(
        bg({ borderLeftWidth: 4, borderStyle: "solid", borderColor: "#000" }),
      ).toBeDefined();
    });

    it("한 변만 longhand 로 선언돼도 붙일 bg box 를 낸다 (그리기는 overlay 채널)", () => {
      const bg = FrameSpec.render
        .shapes(
          {
            style: {
              borderBottomWidth: "1px",
              borderBottomStyle: "solid",
              borderBottomColor: "#102A5C",
            },
          } as never,
          undefined as never,
          undefined as never,
        )
        .find((s) => s.id === "bg");
      expect(bg).toBeDefined();
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

/**
 * Border 편집기 계약 (companion write) 단위 테스트 — 2026-07-15.
 *
 * CSS `border-style` 초기값이 `none` 이라 borderColor/borderWidth 만 인라인으로 써도
 * DOM 은 테두리를 그리지 않는다. applyBorderCompanionDefaults 는 border 축 하나가
 * 설정될 때 나머지 축의 기본값(style:solid / width:1 / color:#d4d4d4)을 동반 기록해
 * DOM/Skia 4경로가 항상 동일한 3필드를 받도록 보장한다.
 */
import { describe, expect, it } from "vitest";
import { applyBorderCompanionDefaults } from "../utils/borderCompanionDefaults";

describe("applyBorderCompanionDefaults — border 편집기 계약", () => {
  it("borderColor 단독 설정 시 borderStyle:solid + borderWidth:1 동반 기록", () => {
    const style: Record<string, unknown> = { borderColor: "#ff0000" };
    applyBorderCompanionDefaults(style, "borderColor");
    expect(style).toEqual({
      borderColor: "#ff0000",
      borderStyle: "solid",
      borderWidth: 1,
    });
  });

  it("borderWidth 단독 설정 시 borderStyle:solid + borderColor 기본값 동반 기록", () => {
    const style: Record<string, unknown> = { borderWidth: 2 };
    applyBorderCompanionDefaults(style, "borderWidth");
    expect(style).toEqual({
      borderWidth: 2,
      borderStyle: "solid",
      borderColor: "#d4d4d4",
    });
  });

  it("borderStyle=dashed 단독 설정 시 width/color 기본값 동반 기록 (사용자 style 보존)", () => {
    const style: Record<string, unknown> = { borderStyle: "dashed" };
    applyBorderCompanionDefaults(style, "borderStyle");
    expect(style).toEqual({
      borderStyle: "dashed",
      borderWidth: 1,
      borderColor: "#d4d4d4",
    });
  });

  it("borderStyle=none 설정 시 width/color companion 을 주입하지 않는다 (테두리 숨김 의도)", () => {
    const style: Record<string, unknown> = { borderStyle: "none" };
    applyBorderCompanionDefaults(style, "borderStyle");
    expect(style).toEqual({ borderStyle: "none" });
  });

  it("borderColor 설정이지만 borderStyle=none 이 이미 있으면 width/color companion 주입 안 함", () => {
    const style: Record<string, unknown> = {
      borderStyle: "none",
      borderColor: "#ff0000",
    };
    applyBorderCompanionDefaults(style, "borderColor");
    // borderStyle 은 property 가 아니므로 none 유지 → none 게이트로 width companion 없음
    expect(style).toEqual({ borderStyle: "none", borderColor: "#ff0000" });
  });

  it("기존 사용자 값(width/style)이 있으면 덮어쓰지 않는다", () => {
    const style: Record<string, unknown> = {
      borderColor: "#00ff00",
      borderWidth: 5,
      borderStyle: "dotted",
    };
    applyBorderCompanionDefaults(style, "borderColor");
    expect(style).toEqual({
      borderColor: "#00ff00",
      borderWidth: 5,
      borderStyle: "dotted",
    });
  });

  it("border 무관 property 는 무시한다 (side-effect 없음)", () => {
    const style: Record<string, unknown> = { padding: 8 };
    applyBorderCompanionDefaults(style, "padding");
    expect(style).toEqual({ padding: 8 });
  });

  it("borderWidth:0 명시는 유효 값 — 덮어쓰지 않고 style/color companion 만 보완", () => {
    const style: Record<string, unknown> = { borderWidth: 0 };
    applyBorderCompanionDefaults(style, "borderWidth");
    expect(style).toEqual({
      borderWidth: 0,
      borderStyle: "solid",
      borderColor: "#d4d4d4",
    });
  });
});

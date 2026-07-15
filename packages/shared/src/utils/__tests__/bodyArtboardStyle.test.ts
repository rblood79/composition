import { describe, expect, it } from "vitest";
import type { CSSProperties } from "react";

import { resolveBodyArtboardStyle } from "../bodyArtboardStyle";

/**
 * D3 대칭 정합의 단일 소스 — builder Preview `CanonicalNodeRenderer` 와 publish
 * `ElementRenderer` 두 DOM consumer 가 공통 호출하는 로직. 라이브 실측(Chrome MCP)으로
 * min-height:100vh 가 body 박스를 Skia 아트보드(viewport 높이)에 채우는 것을 확인했고,
 * 본 테스트는 그 주입/보존 규칙을 렌더러 독립적으로 검증한다.
 */
describe("resolveBodyArtboardStyle", () => {
  it("height/minHeight 미지정 body 는 min-height:100vh 를 주입한다", () => {
    const out = resolveBodyArtboardStyle("body", { display: "block" });
    expect(out).toEqual({ display: "block", minHeight: "100vh" });
  });

  it("style 이 undefined 인 body 도 min-height:100vh 를 주입한다", () => {
    expect(resolveBodyArtboardStyle("body", undefined)).toEqual({
      minHeight: "100vh",
    });
  });

  it("사용자가 minHeight 를 명시하면 주입을 skip 하고 원본을 그대로 반환한다", () => {
    const style: CSSProperties = { display: "flex", minHeight: "500px" };
    const out = resolveBodyArtboardStyle("body", style);
    expect(out).toBe(style); // 동일 참조 — 새 객체 미생성
    expect(out!.minHeight).toBe("500px");
  });

  it("사용자가 height 를 명시하면 주입을 skip 한다", () => {
    const style: CSSProperties = { height: "600px" };
    const out = resolveBodyArtboardStyle("body", style);
    expect(out).toBe(style);
    expect(out!.minHeight).toBeUndefined();
  });

  it("body 가 아닌 타입은 원본 참조를 그대로 반환한다(주입 없음)", () => {
    const style: CSSProperties = { display: "block" };
    for (const type of ["frame", "Button", "Text", "div"]) {
      expect(resolveBodyArtboardStyle(type, style)).toBe(style);
    }
  });
});

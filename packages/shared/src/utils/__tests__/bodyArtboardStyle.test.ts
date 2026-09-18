import { describe, expect, it } from "vitest";
import type { CSSProperties } from "react";

import {
  resolveBodyDomClassName,
  resolveBodyDomPresentation,
} from "../bodyArtboardStyle";

/**
 * D3 대칭 정합의 단일 소스 — builder Preview `CanonicalNodeRenderer` 와 publish
 * `ElementRenderer` 두 DOM consumer 가 공통 호출하는 로직. 라이브 실측으로 page shell 제거 뒤
 * generated CSS의 `[data-body-viewport-fill] { height: 100vh }` 가 body 박스와 자식 % basis를
 * Preview viewport 높이에 맞추는 것을 확인했고,
 * 본 테스트는 그 data attribute 요청/저작값 보존 규칙을 렌더러 독립적으로 검증한다.
 */
describe("resolveBodyDomPresentation", () => {
  it("구 factory 기본 inline style을 제거하고 viewport fill 속성을 요청한다", () => {
    const out = resolveBodyDomPresentation("body", {
      display: "block",
      fontFamily: `"Pretendard", "Inter Variable", system-ui, sans-serif`,
      overflow: "auto",
    });
    expect(out).toEqual({ style: undefined, fillsViewport: true });
  });

  it("style이 undefined인 body도 viewport fill 속성을 요청한다", () => {
    expect(resolveBodyDomPresentation("body", undefined)).toEqual({
      style: undefined,
      fillsViewport: true,
    });
  });

  it("사용자가 minHeight를 명시하면 viewport fill을 끄고 저작값을 보존한다", () => {
    const style: CSSProperties = { display: "flex", minHeight: "500px" };
    expect(resolveBodyDomPresentation("body", style)).toEqual({
      style,
      fillsViewport: false,
    });
  });

  it("사용자가 height를 명시하면 viewport fill을 끈다", () => {
    const style: CSSProperties = { height: "600px" };
    expect(resolveBodyDomPresentation("body", style)).toEqual({
      style,
      fillsViewport: false,
    });
  });

  it("body가 아닌 타입은 원본 style 참조를 그대로 보존한다", () => {
    const style: CSSProperties = { display: "block" };
    for (const type of ["frame", "Button", "Text", "div"]) {
      const out = resolveBodyDomPresentation(type, style);
      expect(out.style).toBe(style);
      expect(out.fillsViewport).toBe(false);
    }
  });

  it("사용자 Body style은 legacy 기본값과 함께 있어도 보존한다", () => {
    expect(
      resolveBodyDomPresentation("body", {
        display: "block",
        overflow: "auto",
        padding: "24px",
        backgroundColor: "red",
      }),
    ).toEqual({
      style: { padding: "24px", backgroundColor: "red" },
      fillsViewport: true,
    });
  });
});

describe("resolveBodyDomClassName", () => {
  it("대소문자 infrastructure class를 하나의 Body class로 정규화한다", () => {
    expect(
      resolveBodyDomClassName(
        "body",
        "react-aria-body react-aria-Body hero-page hero-page",
      ),
    ).toBe("react-aria-Body hero-page");
  });

  it("canonical className이 없어도 Body CSS class를 방출한다", () => {
    expect(resolveBodyDomClassName("body", undefined)).toBe("react-aria-Body");
  });
});

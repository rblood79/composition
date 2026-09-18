import { describe, expect, it } from "vitest";
import type { CSSProperties } from "react";

import {
  resolveBodyDomClassName,
  resolveBodyDomPresentation,
} from "../bodyArtboardStyle";

/**
 * D3 대칭 정합의 단일 소스 — builder Preview `CanonicalNodeRenderer` 와 publish
 * `ElementRenderer` 두 DOM consumer 가 공통 호출하는 로직. 페이지 프레임 높이는 generated
 * Body CSS base `min-height: 100%` 가 담당하고 (2026-09-18 사용자 결정 — 조건부 data attribute
 * 와 inline 없음), 본 테스트는 legacy 기본값 제거/저작값 보존 규칙을 렌더러 독립적으로 검증한다.
 */
describe("resolveBodyDomPresentation", () => {
  it("구 factory 기본 inline style을 제거한다", () => {
    const out = resolveBodyDomPresentation("body", {
      display: "block",
      fontFamily: `"Pretendard", "Inter Variable", system-ui, sans-serif`,
      overflow: "auto",
    });
    expect(out).toEqual({ style: undefined });
  });

  it("style이 undefined인 body는 inline 0", () => {
    expect(resolveBodyDomPresentation("body", undefined)).toEqual({
      style: undefined,
    });
  });

  it("사용자가 minHeight/height를 명시하면 저작값을 그대로 보존한다 (CSS base min-height 를 inline 이 덮는다)", () => {
    const withMin: CSSProperties = { display: "flex", minHeight: "500px" };
    expect(resolveBodyDomPresentation("body", withMin)).toEqual({ style: withMin });
    const withHeight: CSSProperties = { height: "600px" };
    expect(resolveBodyDomPresentation("body", withHeight)).toEqual({
      style: withHeight,
    });
  });

  it("body가 아닌 타입은 원본 style 참조를 그대로 보존한다", () => {
    const style: CSSProperties = { display: "block" };
    for (const type of ["frame", "Button", "Text", "div"]) {
      const out = resolveBodyDomPresentation(type, style);
      expect(out.style).toBe(style);
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

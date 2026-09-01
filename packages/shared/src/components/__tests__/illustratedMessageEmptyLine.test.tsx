import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IllustratedMessage } from "../IllustratedMessage";

/**
 * ADR-923 r19m1 — canonical Preview 경로 (CanonicalNodeRenderer → 본 컴포넌트) 의 IllustratedMessage
 * 기본 글자. 종전 `heading || "No content"` 는 사용자가 비운 "" 를 기본 글자로 되살려 Skia
 * (`illustrated_message`, "" 는 줄 없음) 와 갈렸다. 세 표면 동일: 부재 → 기본 글자, "" → 줄 자체
 * 없음 (빈 div 도 flex gap 을 차지하므로 미렌더 — layout 높이 차감 · Skia y 접힘과 정합).
 */
describe("ADR-923 r19m1 — IllustratedMessage 컴포넌트 (canonical Preview 경로)", () => {
  const countLines = (markup: string) =>
    (markup.match(/<div/g) ?? []).length - 1; // 바깥 status div 제외

  it("부재 → 기본 글자 (Skia ?? 동일), 줄 3 (placeholder · heading · description)", () => {
    const markup = renderToStaticMarkup(<IllustratedMessage />);
    expect(markup).toContain("No content");
    expect(markup).toContain("There is nothing to display.");
    expect(countLines(markup)).toBe(3);
  });

  it("'' → 글자도 줄도 없음 (종전 || 로 기본 글자 부활)", () => {
    const markup = renderToStaticMarkup(
      <IllustratedMessage heading="" description="" />,
    );
    expect(markup).not.toContain("No content");
    expect(markup).not.toContain("There is nothing");
    expect(countLines(markup)).toBe(1); // placeholder 만
    const headingOnly = renderToStaticMarkup(
      <IllustratedMessage heading="" description="d" />,
    );
    expect(countLines(headingOnly)).toBe(2);
    expect(headingOnly).toContain(">d<");
  });
});

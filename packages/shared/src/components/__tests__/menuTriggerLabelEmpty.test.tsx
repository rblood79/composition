import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MenuButton } from "../Menu";

/**
 * ADR-923 r19m1 — 렌더러 (`renderMenu`, r18m1) 가 텍스트 원천 계약으로 낸 빈 label 을 컴포넌트의
 * `label || "Menu"` 가 다시 "Menu" 로 되살렸다 (Skia 는 기본 글자 없음). 계약 결과 그대로 — 부재도 "".
 */
describe("ADR-923 r19m1 — Menu trigger label 기본 글자 없음", () => {
  it("label '' → trigger 글자 없음 (종전 'Menu')", () => {
    const markup = renderToStaticMarkup(<MenuButton label="" items={[]} />);
    expect(markup).not.toContain(">Menu<");
  });
  it("label 부재 → 글자 없음 (계약: Menu 는 label → children, 둘 다 없으면 '')", () => {
    const markup = renderToStaticMarkup(<MenuButton items={[]} />);
    expect(markup).not.toContain(">Menu<");
  });
  it("label 있음 → 그대로", () => {
    const markup = renderToStaticMarkup(
      <MenuButton label="Actions" items={[]} />,
    );
    expect(markup).toContain("Actions");
  });
});

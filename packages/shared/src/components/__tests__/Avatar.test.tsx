import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Avatar } from "../Avatar";
import { resolveComponentRule } from "../../catalog/resolvers/resolveComponentRule";
import { colorTokenToCss } from "../../catalog/resolvers/colorTokenToCss";
import { toRacProps } from "../../catalog/outputs/toRacProps";
import { avatarBinding } from "../../catalog/bindings/Avatar.binding";

/**
 * ADR-912 진로 1번 Avatar proof slice (internal leaf catalog 발효, 2026-06-06).
 *
 * **circle bg / 이니셜 색 = rule(DOM/Skia 대칭)**: Avatar 의 circle 배경/이니셜 텍스트 색을
 *   resolveComponentRule("Avatar").variants.default.fill.default.base / .colors.text(TokenRef) →
 *   colorTokenToCss 로 변환해 인라인 적용. Skia escape(skiaPrimitives avatar)도 같은 rule 값을
 *   읽으므로 양쪽이 같은 source → 시각 대칭.
 *
 * **image | initials 분기**: src 있으면 img(objectFit cover), 없으면 initials(또는 alt 첫 2글자)
 *   span. RTL/jsdom 없이 react-dom/server renderToStaticMarkup 로 정적 출력 직접 검사.
 */

/** root div 의 background-color 인라인 값 추출 (circle bg). */
function rootBackgroundColor(html: string): string | null {
  const firstDiv = html.match(/<div style="([^"]*)"/);
  if (!firstDiv) return null;
  const bg = firstDiv[1].match(/background-color:([^;]+)/);
  return bg ? bg[1] : null;
}

/** root div 의 color 인라인 값 추출 (이니셜 텍스트 색). */
function rootColor(html: string): string | null {
  const firstDiv = html.match(/<div style="([^"]*)"/);
  if (!firstDiv) return null;
  // color: 만 매칭 (background-color: 제외 — 뒤에 - 가 안 오는 color)
  const c = firstDiv[1].match(/(?:^|;)color:([^;]+)/);
  return c ? c[1].trim() : null;
}

describe("Avatar — DOM circle bg / 이니셜 색 = rule (DOM/Skia 대칭)", () => {
  it("circle bg = rule fill default base ({color.neutral-subtle} → var(--bg-muted))", () => {
    const html = renderToStaticMarkup(<Avatar initials="AB" />);
    const rule = resolveComponentRule("Avatar");
    const expected = colorTokenToCss(
      rule?.variants?.default?.fill?.default?.base,
      "var(--bg-muted)",
    );
    expect(rootBackgroundColor(html)).toBe(expected);
    expect(rootBackgroundColor(html)).toBe("var(--bg-muted)");
  });

  it("이니셜 색 = rule variant.colors.text ({color.neutral} → var(--fg))", () => {
    const html = renderToStaticMarkup(<Avatar initials="AB" />);
    const rule = resolveComponentRule("Avatar");
    const expected = colorTokenToCss(
      rule?.variants?.default?.colors?.text,
      "var(--fg)",
    );
    expect(rootColor(html)).toBe(expected);
    expect(rootColor(html)).toBe("var(--fg)");
  });

  it("rule colors.text 가 variant.text 가 아닌 colors.text 에 있음 (잘못된 읽기 경로 회귀 방지)", () => {
    const rule = resolveComponentRule("Avatar");
    const variant = rule?.variants?.default as {
      text?: string;
      colors?: { text?: string };
    };
    // variant.text 는 타입상 미존재(undefined), colors.text 가 정본
    expect(variant?.text).toBeUndefined();
    expect(variant?.colors?.text).toBe("{color.neutral}");
  });
});

describe("Avatar — image | initials 분기", () => {
  it("src 있으면 img 렌더 (objectFit cover), span 없음", () => {
    const html = renderToStaticMarkup(
      <Avatar src="https://example.com/a.png" alt="User" />,
    );
    expect(html).toContain("<img");
    expect(html).toContain('src="https://example.com/a.png"');
    expect(html).toContain("object-fit:cover");
    expect(html).not.toContain("<span");
  });

  it("src 없으면 initials span (img 없음)", () => {
    const html = renderToStaticMarkup(<Avatar initials="JD" />);
    expect(html).toContain("<span>JD</span>");
    expect(html).not.toContain("<img");
  });

  it("initials 없으면 alt 첫 2글자 대문자 fallback", () => {
    const html = renderToStaticMarkup(<Avatar alt="kim" />);
    expect(html).toContain("<span>KI</span>");
  });

  it("initials/alt 모두 없으면 '?' fallback", () => {
    const html = renderToStaticMarkup(<Avatar />);
    expect(html).toContain("<span>?</span>");
  });
});

describe("Avatar — size → 지름·fontSize (rule sizes 정합)", () => {
  it("size md → width/height 32px, fontSize 14px", () => {
    const html = renderToStaticMarkup(<Avatar size="md" initials="AB" />);
    expect(html).toMatch(/width:32px/);
    expect(html).toMatch(/height:32px/);
    expect(html).toMatch(/font-size:14px/);
  });

  it("size xl → width/height 48px, fontSize 18px", () => {
    const html = renderToStaticMarkup(<Avatar size="xl" initials="AB" />);
    expect(html).toMatch(/width:48px/);
    expect(html).toMatch(/height:48px/);
    expect(html).toMatch(/font-size:18px/);
  });
});

/**
 * cutover DOM 경로 회귀 — toRacProps 경유 (StatusLight slice 2026-06-06 버그 선례 방지).
 *
 * **Why**: catalog 의 size kind 는 기본 data-attr 라우팅(`data-size`)이라, 그대로 두면 Avatar.tsx 의
 * size prop 이 undefined → 항상 default(md, 32px) 고정. binding `propPassthrough: ["size"]` 로 prop
 * 통과시켜 해소. 직접 prop 호출 test 는 이 통합 갭을 못 잡으므로 cutover 경로(toRacProps → spread)를
 * 그대로 재현해 고정한다.
 */
describe("Avatar — cutover DOM 경로 (toRacProps propPassthrough)", () => {
  function cutoverHtml(size: string, extra: Record<string, unknown> = {}) {
    const node = {
      id: "x",
      type: "Avatar",
      props: { size, ...extra },
    };
    const rest = toRacProps(node as never, avatarBinding);
    return renderToStaticMarkup(
      <Avatar {...(rest as Record<string, never>)} />,
    );
  }

  it("toRacProps 가 size 를 prop + data-size 둘 다 emit (propPassthrough)", () => {
    const node = { id: "x", type: "Avatar", props: { size: "xl" } };
    const racProps = toRacProps(node as never, avatarBinding);
    expect(racProps.size).toBe("xl"); // ← prop (회귀 방지 핵심)
    expect(racProps["data-size"]).toBe("xl"); // ← data-* 도 보존
  });

  it("cutover 경로에서 size 변경이 지름에 반영 (xl → 48px, default 32px 고정 아님)", () => {
    expect(cutoverHtml("xl", { initials: "AB" })).toMatch(/width:48px/);
    // 버그였다면 size prop undefined → 항상 32px
    expect(cutoverHtml("xl", { initials: "AB" })).not.toMatch(/width:32px/);
  });

  it("cutover 경로에서 data-size 가 root 에 passthrough (CSS/debug marker 보존)", () => {
    expect(cutoverHtml("xl", { initials: "AB" })).toContain('data-size="xl"');
  });

  it("cutover 경로에서 src image 렌더 (initials 분기 정상)", () => {
    const html = cutoverHtml("md", { src: "https://x.com/a.png", alt: "U" });
    expect(html).toContain("<img");
    expect(html).toContain("object-fit:cover");
  });
});

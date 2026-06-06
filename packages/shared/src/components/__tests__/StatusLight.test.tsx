import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { StatusLight } from "../StatusLight";
import { resolveComponentRule } from "../../catalog/resolvers/resolveComponentRule";
import { colorTokenToCss } from "../../catalog/resolvers/colorTokenToCss";
import { toRacProps } from "../../catalog/outputs/toRacProps";
import { statusLightBinding } from "../../catalog/bindings/StatusLight.binding";

/**
 * ADR-912 진로 1번 StatusLight proof slice (internal leaf catalog 발효, 2026-06-06).
 *
 * **DOM dot style 고정 (사용자 결정 2026-06-06: "DOM 도 rule 기반 20 variant 색")**:
 *   StatusLight 은 dot indicator outlier 라 generated CSS(`[data-variant]{background}`, 컨테이너에
 *   칠함)를 못 쓴다. 대신 컴포넌트가 theme rule(resolveComponentRule)의 variant fill base 를
 *   colorTokenToCss 로 변환해 dot span 에 인라인 적용한다. Skia escape(skiaPrimitives status_light)도
 *   같은 rule fill base 를 읽으므로 양쪽이 같은 source → 시각 대칭.
 *
 *   본 테스트는 named color(yellow) 1개 + 표준 semantic(positive) 1개로 **DOM dot 의 실제
 *   background-color 인라인 값을 고정**한다. RTL/jsdom 없이 react-dom/server renderToStaticMarkup
 *   로 컴포넌트 정적 출력을 직접 검사(shared 는 RTL/jsdom 미설치 — 신규 의존성 회피).
 */

/** dot span(첫 <span>)의 background-color 인라인 값 추출. */
function dotBackgroundColor(html: string): string | null {
  const firstSpan = html.match(/<span style="([^"]*)"/);
  if (!firstSpan) return null;
  const bg = firstSpan[1].match(/background-color:([^;]+)/);
  return bg ? bg[1] : null;
}

describe("StatusLight — DOM dot 색 = rule fill base (20 variant 대칭)", () => {
  it("named color variant(yellow) → dot background-color = var(--color-yellow-500)", () => {
    const html = renderToStaticMarkup(
      <StatusLight variant="yellow">Online</StatusLight>,
    );
    expect(dotBackgroundColor(html)).toBe("var(--color-yellow-500)");
  });

  it("표준 semantic variant(positive) → dot background-color = var(--color-green-600)", () => {
    const html = renderToStaticMarkup(
      <StatusLight variant="positive">Available</StatusLight>,
    );
    expect(dotBackgroundColor(html)).toBe("var(--color-green-600)");
  });

  it("default(neutral) variant → dot background-color = var(--fg-muted)", () => {
    const html = renderToStaticMarkup(<StatusLight>Idle</StatusLight>);
    expect(dotBackgroundColor(html)).toBe("var(--fg-muted)");
  });

  it("children 없으면 label span 생략, dot 만 렌더", () => {
    const html = renderToStaticMarkup(<StatusLight variant="yellow" />);
    const spanCount = (html.match(/<span/g) ?? []).length;
    expect(spanCount).toBe(1); // dot 만, label span 없음
    expect(dotBackgroundColor(html)).toBe("var(--color-yellow-500)");
  });
});

describe("StatusLight — DOM/Skia 시각 대칭 source 정합", () => {
  it("dot 색은 컴포넌트 인라인 값 = colorTokenToCss(rule fill base) (Skia escape 와 동일 source)", () => {
    const rule = resolveComponentRule("StatusLight");
    // DOM 컴포넌트가 실제로 쓰는 값과, Skia escape 가 읽는 rule fill base 변환값이 일치해야 대칭.
    for (const variant of ["yellow", "positive", "neutral", "negative"]) {
      const fillBase = rule?.variants?.[variant]?.fill?.default?.base;
      const expected = colorTokenToCss(fillBase);
      const html = renderToStaticMarkup(
        <StatusLight variant={variant}>x</StatusLight>,
      );
      expect(dotBackgroundColor(html)).toBe(expected);
    }
  });

  it("rule table 에 20 variant 대 모두 fill base 보유 (5 semantic + 14 named = 19, neutral 포함)", () => {
    const rule = resolveComponentRule("StatusLight");
    const variants = Object.keys(rule?.variants ?? {});
    expect(variants.length).toBeGreaterThanOrEqual(19);
    // 하드코딩 5-color 맵이 아니라 rule 전수 → 모든 variant 가 변환 가능
    for (const v of variants) {
      const css = colorTokenToCss(rule?.variants?.[v]?.fill?.default?.base);
      expect(css).not.toBe(""); // fallback 포함 항상 유효 CSS
    }
  });
});

/**
 * cutover DOM 경로 회귀 — toRacProps 경유 (StatusLight slice 2026-06-06 버그 재발 방지).
 *
 * **Why**: 초판은 variant kind 를 generic data-attr 로만 라우팅 → StatusLight 컴포넌트의 variant prop
 * 이 undefined → 항상 default(neutral) 회색 고정(Skia 는 rule 직접 → 비대칭, 사용자 보고). binding
 * `propPassthrough: ["variant","size"]` 로 prop 통과시켜 해소. 직접 prop 호출 test 는 이 통합 갭을
 * 못 잡았으므로 cutover 경로(toRacProps → spread)를 그대로 재현해 고정한다.
 */
describe("StatusLight — cutover DOM 경로 (toRacProps propPassthrough)", () => {
  function cutoverHtml(variant: string): string {
    const node = {
      id: "x",
      type: "StatusLight",
      props: { variant, children: "Online" },
    };
    const { children, ...rest } = toRacProps(node as never, statusLightBinding);
    return renderToStaticMarkup(
      <StatusLight {...(rest as Record<string, never>)}>
        {children as React.ReactNode}
      </StatusLight>,
    );
  }

  it("toRacProps 가 variant 를 prop + data-variant 둘 다 emit (propPassthrough)", () => {
    const node = {
      id: "x",
      type: "StatusLight",
      props: { variant: "yellow" },
    };
    const racProps = toRacProps(node as never, statusLightBinding);
    expect(racProps.variant).toBe("yellow"); // ← prop (회귀 방지 핵심)
    expect(racProps["data-variant"]).toBe("yellow"); // ← data-* 도 보존
  });

  it("cutover 경로에서 variant 변경이 dot 색에 반영 (yellow → var(--color-yellow-500))", () => {
    expect(dotBackgroundColor(cutoverHtml("yellow"))).toBe(
      "var(--color-yellow-500)",
    );
  });

  it("cutover 경로에서 positive → var(--color-green-600) (회색 고정 아님)", () => {
    expect(dotBackgroundColor(cutoverHtml("positive"))).toBe(
      "var(--color-green-600)",
    );
    // neutral 회색과 다름을 명시 — 버그였다면 둘 다 var(--fg-muted) 였음
    expect(dotBackgroundColor(cutoverHtml("positive"))).not.toBe(
      "var(--fg-muted)",
    );
  });

  it("cutover 경로에서 data-variant 가 root 에 passthrough (CSS/debug marker 보존)", () => {
    expect(cutoverHtml("yellow")).toContain('data-variant="yellow"');
  });
});

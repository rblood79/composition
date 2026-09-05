import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ProgressCircle } from "../ProgressCircle";
import { resolveComponentRule } from "../../catalog/resolvers/resolveComponentRule";
import { colorTokenToCss } from "../../catalog/resolvers/colorTokenToCss";
import { toRacProps } from "../../catalog/outputs/toRacProps";
import { progressCircleBinding } from "../../catalog/bindings/ProgressCircle.binding";

/**
 * ADR-912 진로 1번 ProgressCircle proof slice (value-fill internal leaf catalog 발효, 2026-06-06).
 *
 * **track/indicator 색 = rule + {color.accent}(DOM/Skia 대칭)**: track stroke 를
 *   resolveComponentRule("ProgressCircle").variants.default.fill.default.base(TokenRef) → colorTokenToCss,
 *   indicator stroke 를 {color.accent}(spec PROGRESSCIRCLE_FILL_COLORS / Skia escape value_fill_arc 와
 *   동일 source)로 적용. Skia escape 가 같은 두 색을 읽으므로 시각 대칭.
 *
 * **value 비례 호**: SVG circle stroke-dashoffset = circumference - (value/100)*circumference.
 *   Skia escape 는 arc sweepAngle = (value/100)*360 — 같은 비율. RTL/jsdom 없이 react-dom/server
 *   renderToStaticMarkup 으로 정적 출력 직접 검사.
 */

/** SVG indicator circle(2번째 circle, stroke-dashoffset 보유)의 stroke 색 추출. */
function indicatorStroke(html: string): string | null {
  // indicator circle 은 stroke-dasharray 를 가진 circle.
  const m = html.match(/<circle[^>]*stroke-dasharray[^>]*>/);
  if (!m) return null;
  const s = m[0].match(/stroke="([^"]+)"/);
  return s ? s[1] : null;
}

/** SVG track circle(1번째 circle, stroke-dasharray 없음)의 stroke 색 추출. */
function trackStroke(html: string): string | null {
  const first = html.match(/<circle[^>]*>/);
  if (!first) return null;
  const s = first[0].match(/stroke="([^"]+)"/);
  return s ? s[1] : null;
}

describe("ProgressCircle — track/indicator 색 = rule (DOM/Skia 대칭)", () => {
  it("track stroke = rule fill default base ({color.neutral-subtle} → var(--bg-muted))", () => {
    const html = renderToStaticMarkup(<ProgressCircle value={50} />);
    const rule = resolveComponentRule("ProgressCircle");
    const expected = colorTokenToCss(
      rule?.variants?.default?.fill?.default?.base,
      "var(--bg-muted)",
    );
    expect(trackStroke(html)).toBe(expected);
    expect(trackStroke(html)).toBe("var(--bg-muted)");
  });

  it("indicator stroke = {color.accent} → var(--accent) (spec/Skia escape 와 동일 source)", () => {
    const html = renderToStaticMarkup(<ProgressCircle value={50} />);
    expect(indicatorStroke(html)).toBe("var(--accent)");
  });

  it("rule 에 indicator 색 필드 없음 — track 만 fill base, indicator 는 {color.accent} 고정", () => {
    const rule = resolveComponentRule("ProgressCircle");
    const variant = rule?.variants?.default as {
      fill?: { default?: { base?: string } };
      colors?: { text?: string };
    };
    // track = fill base, indicator 별도 필드 미존재 → {color.accent}(spec PROGRESSCIRCLE_FILL_COLORS)
    expect(variant?.fill?.default?.base).toBe("{color.neutral-subtle}");
  });
});

describe("ProgressCircle — value 비례 호 + indeterminate", () => {
  it("value 0 → indicator circle 없음 (track 만)", () => {
    const html = renderToStaticMarkup(<ProgressCircle value={0} />);
    expect(html).not.toContain("stroke-dasharray");
    expect(html).toContain("<circle"); // track 은 존재
  });

  it("value 75 → indicator circle 존재 (stroke-dashoffset 비례)", () => {
    const html = renderToStaticMarkup(<ProgressCircle value={75} />);
    expect(html).toContain("stroke-dasharray");
    expect(html).toContain("stroke-dashoffset");
    // md(diameter 32, sw 3) → r=14.5, circumference=2π*14.5≈91.1, offset=circ*(1-0.75)
    const circ = 2 * Math.PI * ((32 - 3) / 2);
    const offset = circ - (75 / 100) * circ;
    expect(html).toContain(`stroke-dashoffset="${offset}"`);
  });

  it("isIndeterminate → indicator circle 없음 (CSS 애니메이션, fallback 없이 정적 track)", () => {
    const html = renderToStaticMarkup(
      <ProgressCircle value={50} isIndeterminate />,
    );
    expect(html).not.toContain("stroke-dasharray");
    // aria-valuenow 없음 (indeterminate)
    expect(html).not.toContain("aria-valuenow");
  });
});

describe("ProgressCircle — size → 지름(rule height) + strokeWidth 3 uniform (Skia base 정합)", () => {
  // strokeWidth 3 uniform: rule(ComponentRuleSize)에 strokeWidth 필드 없음 → Skia value_fill_arc
  //   기본값 3 으로 해소 → DOM 도 3 으로 대칭(spec lg=4 는 rule 미이전 잔재).
  it("size sm → diameter 24, strokeWidth 3", () => {
    const html = renderToStaticMarkup(<ProgressCircle size="sm" value={50} />);
    expect(html).toMatch(/width="24"/);
    expect(html).toMatch(/stroke-width="3"/);
  });

  it("size md → diameter 32, strokeWidth 3", () => {
    const html = renderToStaticMarkup(<ProgressCircle size="md" value={50} />);
    expect(html).toMatch(/width="32"/);
    expect(html).toMatch(/stroke-width="3"/);
  });

  it("size lg → diameter 64, strokeWidth 3 (rule base 정합 — lg=4 spec 잔재 미적용)", () => {
    const html = renderToStaticMarkup(<ProgressCircle size="lg" value={50} />);
    expect(html).toMatch(/width="64"/);
    expect(html).toMatch(/stroke-width="3"/);
  });
});

/**
 * cutover DOM 경로 회귀 — toRacProps 경유 (StatusLight/Avatar slice 2026-06-06 버그 선례 방지).
 *
 * **Why**: catalog 의 size kind 는 기본 data-attr 라우팅(`data-size`)이라, 그대로 두면 ProgressCircle.tsx
 * 의 size prop 이 undefined → 항상 default(md, 32px) 고정. binding `propPassthrough: ["size"]` 로 prop
 * 통과시켜 해소. value(number)/isIndeterminate(boolean)는 DATA_ATTR_KINDS 가 아니라 기본 React prop 통과.
 * 직접 prop 호출 test 는 이 통합 갭을 못 잡으므로 cutover 경로(toRacProps → spread)를 그대로 재현해 고정한다.
 */
describe("ProgressCircle — cutover DOM 경로 (toRacProps propPassthrough)", () => {
  function cutoverHtml(props: Record<string, unknown>) {
    const node = { id: "x", type: "ProgressCircle", props };
    const rest = toRacProps(node as never, progressCircleBinding);
    return renderToStaticMarkup(
      <ProgressCircle {...(rest as Record<string, never>)} />,
    );
  }

  it("toRacProps 가 size 를 prop + data-size 둘 다 emit (propPassthrough)", () => {
    const node = { id: "x", type: "ProgressCircle", props: { size: "lg" } };
    const racProps = toRacProps(node as never, progressCircleBinding);
    expect(racProps.size).toBe("lg"); // ← prop (회귀 방지 핵심)
    expect(racProps["data-size"]).toBe("lg"); // ← data-* 도 보존
  });

  it("toRacProps 가 value 를 React prop 으로 통과 (number kind, data-attr 아님)", () => {
    const node = {
      id: "x",
      type: "ProgressCircle",
      props: { value: 60 },
    };
    const racProps = toRacProps(node as never, progressCircleBinding);
    expect(racProps.value).toBe(60); // React prop
    expect(racProps["data-value"]).toBeUndefined(); // data-attr 아님
  });

  it("cutover 경로에서 size 변경이 지름에 반영 (lg → 64px, default 32px 고정 아님)", () => {
    expect(cutoverHtml({ size: "lg", value: 50 })).toMatch(/width="64"/);
    // 버그였다면 size prop undefined → 항상 32px
    expect(cutoverHtml({ size: "lg", value: 50 })).not.toMatch(/width="32"/);
  });

  it("cutover 경로에서 value 변경이 indicator 에 반영", () => {
    const html = cutoverHtml({ size: "md", value: 75 });
    expect(html).toContain("stroke-dashoffset");
  });
});

/**
 * design-data 감사 §2-F "over background" (2026-08-21) — staticColor DOM leg.
 * track = static 25% wash / indicator = solid static (Skia value_fill_arc 동일 상수).
 */
describe("ProgressCircle — staticColor over background (§2-F, 2026-08-21)", () => {
  function cutoverHtml(props: Record<string, unknown>) {
    const node = { id: "x", type: "ProgressCircle", props };
    const rest = toRacProps(node as never, progressCircleBinding);
    return renderToStaticMarkup(
      <ProgressCircle {...(rest as Record<string, never>)} />,
    );
  }

  it("white → track rgb(255 255 255 / 0.25) + indicator var(--color-white)", () => {
    const html = cutoverHtml({ value: 50, staticColor: "white" });
    expect(html).toContain("rgb(255 255 255 / 0.25)");
    expect(html).toContain("var(--color-white");
  });

  it("auto/미지정 → variant 경로 유지 (wash 부재)", () => {
    const html = cutoverHtml({ value: 50, staticColor: "auto" });
    expect(html).not.toContain("/ 0.25)");
  });

  /**
   * `role="progressbar"` 는 접근 가능한 이름이 필수인데 이 컴포넌트에는 보이는 label 이 없다.
   * 예전에는 `aria-label` 이 타입에 없어 호출부가 넘기면 TS 오류였고 (런타임은 통과시켰다),
   * 그래서 이름 없는 progressbar 가 나갔다 — ADR-205 후속 (2026-09-05).
   */
  it("aria-label 이 root progressbar 에 실린다", () => {
    const html = renderToStaticMarkup(
      React.createElement(ProgressCircle, {
        value: 50,
        "aria-label": "업로드",
      }),
    );
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-label="업로드"');
  });

  it("aria-labelledby 도 같이 실린다 (이름 참조 형태)", () => {
    const html = renderToStaticMarkup(
      React.createElement(ProgressCircle, {
        value: 50,
        "aria-labelledby": "title-1",
      }),
    );
    expect(html).toContain('aria-labelledby="title-1"');
  });

  it("binding propPassthrough 로 staticColor 가 React prop + data-static-color 둘 다 emit", () => {
    const node = {
      id: "x",
      type: "ProgressCircle",
      props: { staticColor: "black" },
    };
    const racProps = toRacProps(node as never, progressCircleBinding);
    expect(racProps.staticColor).toBe("black");
    expect(racProps["data-static-color"]).toBe("black");
  });
});

import { describe, it, expect } from "vitest";
import { generateCSS } from "../CSSGenerator";
import type { ComponentSpec } from "../../types/spec.types";

/**
 * ADR-059 Phase 4-infra 0-D.7/0-D.8: animation-name auto-rewrite 테스트
 *
 * composition.animations 선언된 이름들을 {specName}-{animName} prefix로 자동 변환
 * - sizeSelectors, containerVariants, delegation.states, externalStyles 등 모든 경로 적용
 * - animation / animation-name 속성 양쪽 처리
 * - 미선언 이름은 rewrite하지 않음
 */

function makeSpec(
  composition: Partial<ComponentSpec["composition"]> = {},
): ComponentSpec {
  return {
    name: "AnimTest",
    description: "Animation Test Component",
    archetype: "container",
    element: "div",

    defaultSize: "md",

    sizes: {
      md: {},
    },

    composition: {
      layout: "flex-column",
      delegation: [],
      ...composition,
    },
  } as unknown as ComponentSpec;
}

describe("animation-name auto-rewrite", () => {
  it("animations 선언 이름은 {specName}-{animName} 으로 prefix", () => {
    const css = generateCSS(
      makeSpec({
        animations: {
          spin: {
            keyframes: { "0%": { transform: "rotate(0deg)" } },
          },
        },
        sizeSelectors: {
          md: { ".icon": { animation: "spin 1s linear infinite" } },
        },
      }),
    )!;
    expect(css).toContain("animation: AnimTest-spin 1s linear infinite;");
    expect(css).not.toContain("animation: spin 1s");
  });

  it("animation-name 단독 property 도 prefix", () => {
    const css = generateCSS(
      makeSpec({
        animations: { pulse: { keyframes: {} } },
        sizeSelectors: {
          md: { ".dot": { "animation-name": "pulse" } },
        },
      }),
    )!;
    expect(css).toContain("animation-name: AnimTest-pulse;");
  });

  it("미선언 이름은 rewrite 하지 않음", () => {
    const css = generateCSS(
      makeSpec({
        animations: { spin: { keyframes: {} } },
        sizeSelectors: {
          md: { ".bar": { animation: "externalAnim 1s ease" } },
        },
      }),
    )!;
    expect(css).toContain("animation: externalAnim 1s ease;");
    expect(css).not.toContain("AnimTest-externalAnim");
  });

  it("animations 자체 없으면 no-op", () => {
    const css = generateCSS(
      makeSpec({
        sizeSelectors: {
          md: { ".bar": { animation: "foo 1s" } },
        },
      }),
    )!;
    expect(css).toContain("animation: foo 1s;");
  });

  it("복수 animation 이름들 모두 prefix", () => {
    const css = generateCSS(
      makeSpec({
        animations: {
          fadeIn: { keyframes: { "0%": { opacity: "0" } } },
          slideUp: { keyframes: { "0%": { transform: "translateY(10px)" } } },
        },
        sizeSelectors: {
          md: {
            ".top": { animation: "fadeIn 0.5s ease" },
            ".bottom": { "animation-name": "slideUp" },
          },
        },
      }),
    )!;
    expect(css).toContain("animation: AnimTest-fadeIn 0.5s ease;");
    expect(css).toContain("animation-name: AnimTest-slideUp;");
  });

  it("animation 에 whitespace 있어도 prefix 올바르게 적용", () => {
    const css = generateCSS(
      makeSpec({
        animations: { bounce: { keyframes: {} } },
        sizeSelectors: {
          md: { ".item": { animation: "  bounce   2s   ease  " } },
        },
      }),
    )!;
    // 알고리즘이 trim()을 먼저 하므로 leading/trailing whitespace 제거됨
    expect(css).toContain("animation: AnimTest-bounce   2s   ease;");
  });

  it("animation shorthand 에 timing/direction 포함되어도 prefix 첫 token 만 변환", () => {
    const css = generateCSS(
      makeSpec({
        animations: { rotate: { keyframes: {} } },
        sizeSelectors: {
          md: {
            ".spinner": {
              animation: "rotate 2s linear infinite reverse",
            },
          },
        },
      }),
    )!;
    expect(css).toContain(
      "animation: AnimTest-rotate 2s linear infinite reverse;",
    );
  });
});

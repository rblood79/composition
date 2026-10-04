import { describe, it, expect } from "vitest";
import { generateCSS } from "../CSSGenerator";
import type { ComponentSpec } from "../../types/spec.types";

/**
 * ADR-059 Phase 4-infra2 0-D.9: sizeSelectors emit 테스트
 *
 * composition.sizeSelectors → per-size child selector rules 변환 검증
 * - 미선언 시 selector rule 없음
 * - 선언 시 per-size nested selector 출력
 * - @layer components 내부 위치 확인
 * - 복수 selector/size 모두 출력
 */

function makeSpec(
  overrides: Partial<ComponentSpec["composition"]> = {},
): ComponentSpec {
  return {
    name: "TestBar",
    description: "Test Bar Component",
    archetype: "container",
    element: "div",

    defaultSize: "md",

    sizes: {
      md: {
        height: "8px",
      },
      lg: {
        height: "16px",
      },
    },

    composition: {
      layout: "flex-column",
      delegation: [],
      ...overrides,
    },
  } as unknown as ComponentSpec;
}

describe("sizeSelectors emit (0-D.9)", () => {
  it("sizeSelectors 미선언 시 selector rule 없음", () => {
    const css = generateCSS(makeSpec());
    expect(css).not.toMatch(/\[data-size="[^"]+"\]\s+\./);
  });

  it("sizeSelectors 선언 시 per-size nested selector emit", () => {
    const css = generateCSS(
      makeSpec({
        sizeSelectors: {
          sm: { ".bar": { height: "4px" } },
        },
      }),
    );
    expect(css).toContain('.react-aria-TestBar[data-size="sm"] .bar');
    expect(css).toContain("height: 4px;");
  });

  it("sizeSelectors 는 @layer components 내부에 위치", () => {
    const css = generateCSS(
      makeSpec({
        sizeSelectors: { sm: { ".bar": { height: "4px" } } },
      }),
    )!;
    const layerClose = css.indexOf("} /* @layer components */");
    const sizeRule = css.indexOf('[data-size="sm"] .bar');
    expect(sizeRule).toBeGreaterThan(-1);
    expect(sizeRule).toBeLessThan(layerClose);
  });

  it("복수 selector/size 모두 emit", () => {
    const css = generateCSS(
      makeSpec({
        sizeSelectors: {
          sm: {
            ".bar": { height: "4px" },
            ".fill": { "border-radius": "2px" },
          },
          lg: { ".bar": { height: "16px" } },
        },
      }),
    )!;
    expect(css).toContain('[data-size="sm"] .bar');
    expect(css).toContain('[data-size="sm"] .fill');
    expect(css).toContain('[data-size="lg"] .bar');
    expect(css).toContain("border-radius: 2px;");
  });

  it("복수 CSS property 동시 emit", () => {
    const css = generateCSS(
      makeSpec({
        sizeSelectors: {
          md: {
            ".content": {
              "font-size": "14px",
              "line-height": "1.5",
              padding: "8px",
            },
          },
        },
      }),
    )!;
    expect(css).toContain('[data-size="md"] .content {');
    expect(css).toContain("font-size: 14px;");
    expect(css).toContain("line-height: 1.5;");
    expect(css).toContain("padding: 8px;");
  });
});

describe("staticSelectors emit", () => {
  function makeSpec(
    overrides: Partial<ComponentSpec["composition"]> = {},
  ): ComponentSpec {
    return {
      name: "StaticBar",
      archetype: "container",
      sizes: { md: {} },
      composition: { layout: "flex-column", delegation: [], ...overrides },
    } as unknown as ComponentSpec;
  }

  it("staticSelectors 선언 시 root 하위 고정 selector emit", () => {
    const css = generateCSS(
      makeSpec({
        staticSelectors: {
          ".bar": { height: "8px", background: "red" },
        },
      }),
    )!;
    expect(css).toContain(".react-aria-StaticBar .bar");
    expect(css).toContain("height: 8px;");
    expect(css).toContain("background: red;");
  });

  it("staticSelectors 미선언 시 추가 selector 없음", () => {
    const css = generateCSS(makeSpec())!;
    expect(css).not.toMatch(/\.react-aria-StaticBar \./);
  });

  it("staticSelectors 는 @layer components 내부에 위치", () => {
    const css = generateCSS(
      makeSpec({
        staticSelectors: { ".bar": { height: "8px" } },
      }),
    )!;
    const layerClose = css.indexOf("} /* @layer components */");
    const staticRule = css.indexOf(".react-aria-StaticBar .bar");
    expect(staticRule).toBeGreaterThan(-1);
    expect(staticRule).toBeLessThan(layerClose);
  });

  it("staticSelectors 복수 selector 모두 emit", () => {
    const css = generateCSS(
      makeSpec({
        staticSelectors: {
          ".bar": { height: "8px" },
          ".fill": { background: "var(--accent)" },
          ".value": { color: "var(--fg-muted)" },
        },
      }),
    )!;
    expect(css).toContain(".react-aria-StaticBar .bar");
    expect(css).toContain(".react-aria-StaticBar .fill");
    expect(css).toContain(".react-aria-StaticBar .value");
  });
});

import { describe, it, expect } from "vitest";
import { generateCSS } from "../CSSGenerator";
import type { ComponentSpec } from "../../types/spec.types";

/**
 * ADR-059 Phase 4.5a 0-D.10: rootSelectors + validation + descendant :not() tests
 *
 * composition.rootSelectors → root pseudo selector rules emit 검증
 * - & prefix 요구사항
 * - forbidden chars 검증 ({};@)
 * - nested 자식 selector 지원
 * - staticSelectors descendant :not() 검증
 */

function makeSpec(
  overrides: Partial<ComponentSpec["composition"]> = {},
): ComponentSpec {
  return {
    name: "RootTest",
    description: "Root Selector Test Component",
    archetype: "container",
    element: "div",
    sizes: { md: {} },
    composition: { layout: "flex-column", delegation: [], ...overrides },
  } as unknown as ComponentSpec;
}

describe("rootSelectors emit (0-D.10)", () => {
  it("rootSelectors 미선언 시 selector rule 없음", () => {
    const css = generateCSS(makeSpec());
    expect(css).not.toMatch(/\.react-aria-RootTest:not/);
  });

  it("`&:not([attr])` 패턴 emit 정확", () => {
    const css = generateCSS(
      makeSpec({
        rootSelectors: {
          '&:not([aria-orientation="vertical"])': {
            styles: { flex: "1 1 auto" },
          },
        },
      }),
    )!;
    expect(css).toContain(
      '.react-aria-RootTest:not([aria-orientation="vertical"])',
    );
    expect(css).toContain("flex: 1 1 auto;");
  });

  it("nested 자식 selector 도 emit", () => {
    const css = generateCSS(
      makeSpec({
        rootSelectors: {
          "&:has([data-current])": {
            nested: { ".icon": { color: "red" } },
          },
        },
      }),
    )!;
    expect(css).toContain(".react-aria-RootTest:has([data-current]) .icon");
    expect(css).toContain("color: red;");
  });

  it("`&` prefix 누락 시 throw", () => {
    expect(() =>
      generateCSS(
        makeSpec({
          rootSelectors: {
            ":not([aria-hidden])": { styles: { color: "red" } },
          } as unknown as Record<string, unknown>,
        }),
      ),
    ).toThrow(/must start with "&"/);
  });

  it("forbidden char `{` 포함 시 throw", () => {
    expect(() =>
      generateCSS(
        makeSpec({
          rootSelectors: {
            "&{ injected }": { styles: { color: "red" } },
          } as unknown as Record<string, unknown>,
        }),
      ),
    ).toThrow(/forbidden chars/);
  });

  it("forbidden char `}` 포함 시 throw", () => {
    expect(() =>
      generateCSS(
        makeSpec({
          rootSelectors: {
            "&.test}": { styles: { color: "red" } },
          } as unknown as Record<string, unknown>,
        }),
      ),
    ).toThrow(/forbidden chars/);
  });

  it("forbidden char `;` 포함 시 throw", () => {
    expect(() =>
      generateCSS(
        makeSpec({
          rootSelectors: {
            "&;test": { styles: { color: "red" } },
          } as unknown as Record<string, unknown>,
        }),
      ),
    ).toThrow(/forbidden chars/);
  });

  it("forbidden char `@` 포함 시 throw", () => {
    expect(() =>
      generateCSS(
        makeSpec({
          rootSelectors: {
            "&@media print": { styles: { color: "red" } },
          } as unknown as Record<string, unknown>,
        }),
      ),
    ).toThrow(/forbidden chars/);
  });

  it("styles 미선언 시 스타일 블록 없음 (nested 만 emit)", () => {
    const css = generateCSS(
      makeSpec({
        rootSelectors: {
          "&:has(.active)": {
            nested: { ".badge": { display: "block" } },
          },
        },
      }),
    )!;
    expect(css).toContain(".react-aria-RootTest:has(.active) .badge");
    expect(css).toContain("display: block;");
    // styles 블록이 없으므로 root selector에만 중괄호 없음
    expect(css).not.toMatch(/\.react-aria-RootTest:has\(\.active\)\s*\{\s*\}/);
  });

  it("복수 rootSelectors 모두 emit", () => {
    const css = generateCSS(
      makeSpec({
        rootSelectors: {
          "&:not([disabled])": {
            styles: { cursor: "pointer" },
          },
          "&:is(:hover, :focus)": {
            styles: { background: "var(--accent)" },
          },
        },
      }),
    )!;
    expect(css).toContain(".react-aria-RootTest:not([disabled])");
    expect(css).toContain(".react-aria-RootTest:is(:hover, :focus)");
    expect(css).toContain("cursor: pointer;");
    expect(css).toContain("background: var(--accent);");
  });

  it("animation name rewrite in rootSelectors styles", () => {
    const css = generateCSS(
      makeSpec({
        rootSelectors: {
          "&:focus-visible": {
            styles: {
              animation: "pulse 0.5s ease",
            },
          },
        },
        animations: {
          pulse: {
            keyframes: {
              "0%": { opacity: "1" },
              "100%": { opacity: "0.5" },
            },
          },
        },
      }),
    )!;
    expect(css).toContain("animation: RootTest-pulse 0.5s ease;");
  });

  it("@layer components 내부에 rootSelectors 위치", () => {
    const css = generateCSS(
      makeSpec({
        rootSelectors: {
          "&:hover": {
            styles: { opacity: "0.8" },
          },
        },
      }),
    )!;
    const layerClose = css.indexOf("} /* @layer components */");
    const rootRule = css.indexOf(".react-aria-RootTest:hover");
    expect(rootRule).toBeGreaterThan(-1);
    expect(rootRule).toBeLessThan(layerClose);
  });
});

describe("staticSelectors descendant `:not()`", () => {
  function makeSpec(
    overrides: Partial<ComponentSpec["composition"]> = {},
  ): ComponentSpec {
    return {
      name: "StaticNot",
      archetype: "container",
      sizes: { md: {} },
      composition: { layout: "flex-column", delegation: [], ...overrides },
    } as unknown as ComponentSpec;
  }

  it("`:not()` 포함 selector key 통과 + emit", () => {
    const css = generateCSS(
      makeSpec({
        staticSelectors: {
          '.react-aria-Button:not([data-current="true"])': {
            color: "blue",
          },
        },
      }),
    )!;
    expect(css).toContain(
      '.react-aria-StaticNot .react-aria-Button:not([data-current="true"])',
    );
    expect(css).toContain("color: blue;");
  });

  it("staticSelectors forbidden char `{` 시 throw", () => {
    expect(() =>
      generateCSS(
        makeSpec({
          staticSelectors: {
            ".bar { injected }": { color: "red" },
          } as unknown as Record<string, unknown>,
        }),
      ),
    ).toThrow(/forbidden chars/);
  });

  it("staticSelectors forbidden char `@` 시 throw", () => {
    expect(() =>
      generateCSS(
        makeSpec({
          staticSelectors: {
            ".bar@media": { color: "red" },
          } as unknown as Record<string, unknown>,
        }),
      ),
    ).toThrow(/forbidden chars/);
  });

  it("복잡한 `:not()` pseudo-class 통과", () => {
    const css = generateCSS(
      makeSpec({
        staticSelectors: {
          ".bar:not(:first-child):not(.hidden)": {
            "margin-top": "8px",
          },
        },
      }),
    )!;
    expect(css).toContain(
      ".react-aria-StaticNot .bar:not(:first-child):not(.hidden)",
    );
    expect(css).toContain("margin-top: 8px;");
  });

  it("`:not()` 와 다른 pseudo-elements 조합", () => {
    const css = generateCSS(
      makeSpec({
        staticSelectors: {
          ".icon:not(.hidden)::before": {
            content: '"→"',
          },
        },
      }),
    )!;
    expect(css).toContain(".react-aria-StaticNot .icon:not(.hidden)::before");
    expect(css).toContain('content: "→";');
  });
});

describe("nested in rootSelectors `:not()` validation", () => {
  function makeSpec(
    overrides: Partial<ComponentSpec["composition"]> = {},
  ): ComponentSpec {
    return {
      name: "RootNested",
      archetype: "container",
      sizes: { md: {} },
      composition: { layout: "flex-column", delegation: [], ...overrides },
    } as unknown as ComponentSpec;
  }

  it("nested selector 에 `:not()` 통과", () => {
    const css = generateCSS(
      makeSpec({
        rootSelectors: {
          "&:has(.item)": {
            nested: {
              ".badge:not([hidden])": {
                display: "inline-block",
              },
            },
          },
        },
      }),
    )!;
    expect(css).toContain(
      ".react-aria-RootNested:has(.item) .badge:not([hidden])",
    );
    expect(css).toContain("display: inline-block;");
  });

  it("nested selector forbidden char `{` 시 throw", () => {
    expect(() =>
      generateCSS(
        makeSpec({
          rootSelectors: {
            "&:hover": {
              nested: {
                ".bar{ injected }": { color: "red" },
              },
            },
          } as unknown as Record<string, unknown>,
        }),
      ),
    ).toThrow(/forbidden chars/);
  });

  it("nested selector forbidden char `@` 시 throw", () => {
    expect(() =>
      generateCSS(
        makeSpec({
          rootSelectors: {
            "&:hover": {
              nested: {
                ".bar@media": { color: "red" },
              },
            },
          } as unknown as Record<string, unknown>,
        }),
      ),
    ).toThrow(/forbidden chars/);
  });
});

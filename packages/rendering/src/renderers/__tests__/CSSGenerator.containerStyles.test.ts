import { describe, it, expect } from "vitest";
import type {
  ContainerStylesSchema,
  ComponentSpec,
} from "../../types/spec.types";
import type { TokenRef } from "../../types/token.types";
import { emitContainerStyles, generateCSS } from "../CSSGenerator";

/** The variants' compiled paint blocks (production: `generate-css.ts` `variantPaintCssFor` — ADR-297). */
const VARIANT_PAINT_CSS = [
  '.react-aria-FakePopover:where([data-variant="primary"]) {',
  "  background: var(--fg);",
  "}",
];

describe("emitContainerStyles — ADR-071", () => {
  it("emits TokenRef colors via tokenToCSSVar", () => {
    const c: ContainerStylesSchema = {
      background: "{color.raised}",
      text: "{color.neutral}",
      border: "{color.border}",
      borderWidth: 1,
    };
    const lines = emitContainerStyles(c);
    expect(lines).toContain("  background: var(--bg-raised);");
    expect(lines).toContain("  color: var(--fg);");
    expect(lines).toContain("  border: 1px solid var(--border);");
  });

  // ADR-227 Phase 3 — border 폭은 테마 토큰: 토큰 → var · 미지정 → thin 변수 (종전 리터럴 `1px`)
  it("borderWidth `{border.width.*}` → var(--border-width-*) · 미지정 → thin 변수 · `{…}px` 없음", () => {
    const token: ContainerStylesSchema = {
      border: "{color.border}",
      borderWidth: "{border.width.thick}",
    };
    expect(emitContainerStyles(token)).toContain(
      "  border: var(--border-width-thick) solid var(--border);",
    );
    const omitted: ContainerStylesSchema = { border: "{color.border}" };
    expect(emitContainerStyles(omitted)).toContain(
      "  border: var(--border-width-thin) solid var(--border);",
    );
    for (const line of emitContainerStyles(token)) {
      expect(line).not.toMatch(/\{border\.width\.[a-z]+\}px/);
    }
  });

  it("emits TokenRef structure props", () => {
    const c: ContainerStylesSchema = {
      borderRadius: "{radius.md}",
      padding: "{spacing.xs}",
      gap: "{spacing.2xs}",
    };
    const lines = emitContainerStyles(c);
    expect(lines).toContain("  border-radius: var(--radius-md);");
    expect(lines).toContain("  padding: var(--spacing-xs);");
    expect(lines).toContain("  gap: var(--spacing-2xs);");
  });

  it("emits raw CSS values for string props", () => {
    const c: ContainerStylesSchema = {
      width: "100%",
      height: "fit-content",
      maxHeight: "300px",
      overflow: "auto",
      outline: "none",
    };
    const lines = emitContainerStyles(c);
    expect(lines).toContain("  width: 100%;");
    expect(lines).toContain("  height: fit-content;");
    expect(lines).toContain("  max-height: 300px;");
    expect(lines).toContain("  overflow: auto;");
    expect(lines).toContain("  outline: none;");
  });

  it("emits empty array when no fields set", () => {
    expect(emitContainerStyles({})).toEqual([]);
  });

  it("defaults borderWidth to the thin token var when border set without width (ADR-227 P3 — 종전 `1px`)", () => {
    const lines = emitContainerStyles({ border: "{color.border}" });
    expect(lines).toContain(
      "  border: var(--border-width-thin) solid var(--border);",
    );
  });
});

describe("generateCSS — containerStyles S3 semantic (ADR-071)", () => {
  const baseSpec: ComponentSpec<{ variant?: string }> = {
    name: "FakePopover",
    archetype: "collection",
    element: "div",
    defaultVariant: "primary",
    defaultSize: "M",
    variants: {
      primary: {
        background: "{color.neutral}" as TokenRef,
        text: "{color.base}" as TokenRef,
        border: "{color.neutral}" as TokenRef,
      },
    },
    sizes: {
      md: {
        height: 0,
        paddingX: 12,
        paddingY: 4,
        fontSize: 14 as unknown as TokenRef,
        borderRadius: 6 as unknown as TokenRef,
        borderWidth: 1,
        gap: 4,
      },
    },
    states: {},
    render: {
      shapes: () => [],
      react: () => ({}),
    },
  };

  it("preserves root intrinsic height over default and per-size auto height", () => {
    const css = generateCSS({
      ...baseSpec,
      defaultSize: "M",
      sizes: { M: { ...baseSpec.sizes.md }, L: { ...baseSpec.sizes.md } },
      containerStyles: { height: "fit-content" },
    });
    expect(css).toContain("height: fit-content;");
    expect(css).not.toMatch(/(?:^|\n)\s+height: auto;/);
  });

  it("emits containerStyles in base instead of defaultVariant colors", () => {
    const spec: ComponentSpec<{ variant?: string }> = {
      ...baseSpec,
      containerStyles: {
        background: "{color.raised}",
        text: "{color.neutral}",
      },
    };
    const css = generateCSS(spec);
    expect(css).toContain("background: var(--bg-raised);");
    expect(css).toContain("color: var(--fg);");
    // defaultVariant.background ({color.neutral} = var(--fg)) 가 `background:` 로
    // 주입되어 있으면 안 됨 — background 는 raised 여야 함.
    expect(css).not.toMatch(/background:\s*var\(--fg\);/);
  });

  it("skips [data-variant=...] blocks when containerStyles present", () => {
    const spec: ComponentSpec<{ variant?: string }> = {
      ...baseSpec,
      containerStyles: { background: "{color.raised}" },
    };
    const css = generateCSS(spec, VARIANT_PAINT_CSS);
    expect(css).not.toContain('[data-variant="primary"]');
  });

  it("keeps defaultVariant injection + variants block when containerStyles absent (baseline)", () => {
    // ADR-297 3i: variant 블록 = compile 된 트리 (`variantPaintCssFor`) 뿐 — 기본 블록은 휴지 칠.
    const css = generateCSS(baseSpec, VARIANT_PAINT_CSS);
    expect(css).toContain("background: var(--fg);");
    expect(css).toContain('[data-variant="primary"]');
  });

  it("containerStyles.padding takes precedence over sizes.paddingX/Y (no double-emit)", () => {
    const spec: ComponentSpec<{ variant?: string }> = {
      ...baseSpec,
      containerStyles: {
        padding: "{spacing.xs}",
      },
    };
    const css = generateCSS(spec);
    // containerStyles.padding 이 emit 되어야 함
    expect(css).toContain("padding: var(--spacing-xs);");
    // defaultSize.paddingX/Y 기반 `padding: Npx Mpx` 형식은 emit 되면 안 됨 (이중 emit 방지)
    expect(css).not.toMatch(/padding:\s*\d+px\s+\d+px/);
  });

  it("containerStyles.borderRadius takes precedence over sizes.borderRadius", () => {
    const spec: ComponentSpec<{ variant?: string }> = {
      ...baseSpec,
      containerStyles: {
        borderRadius: "{radius.md}",
      },
    };
    const css = generateCSS(spec);
    expect(css).toContain("border-radius: var(--catalog-token-radius-md);");
    // defaultSize.borderRadius 기반 raw emit 없어야 함 (이중 emit 방지)
    // baseSpec borderRadius: 6 → tokenToCSSVar(6) = "6" → "border-radius: 6;" (px 없음)
    expect(css).not.toMatch(/border-radius:\s*6[^p]/);
  });

  it("sizes.padding/borderRadius emit when containerStyles absent (baseline)", () => {
    const css = generateCSS(baseSpec);
    // defaultSize.paddingX/Y → padding: 4px 12px
    expect(css).toMatch(/padding:\s*\d+px\s+\d+px/);
    // defaultSize.borderRadius → border-radius: 6 (tokenToCSSVar(6) = "6", no px suffix)
    expect(css).toMatch(/border-radius:\s*6/);
  });
});

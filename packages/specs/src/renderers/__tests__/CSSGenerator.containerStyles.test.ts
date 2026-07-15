import { describe, it, expect } from "vitest";
import type {
  ContainerStylesSchema,
  ComponentSpec,
} from "../../types/spec.types";
import type { TokenRef } from "../../types/token.types";
import { emitContainerStyles, generateCSS } from "../CSSGenerator";
// ADR-912 단계5: variantToVisual 은 test-only utility — production CSSGenerator 는
//   _variantSource(rule table 파생) 단독이라 spec→visual fallback 이 사라졌다. test 는
//   fixture spec.variants 에서 _variantSource 를 직접 구성(production variantSourceFor 동형).
import { variantToVisual } from "../utils/resolveComponentVisual";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";

/** fixture spec.variants → _variantSource 맵 (production variantSourceFor 동형). */
function variantSourceFromSpec(
  spec: ComponentSpec<{ variant?: string }>,
): Record<string, ComponentVisualRule> {
  const map: Record<string, ComponentVisualRule> = {};
  for (const [name, v] of Object.entries(spec.variants ?? {})) {
    map[name] = variantToVisual(v);
  }
  return map;
}

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
      maxHeight: "300px",
      overflow: "auto",
      outline: "none",
    };
    const lines = emitContainerStyles(c);
    expect(lines).toContain("  width: 100%;");
    expect(lines).toContain("  max-height: 300px;");
    expect(lines).toContain("  overflow: auto;");
    expect(lines).toContain("  outline: none;");
  });

  it("emits empty array when no fields set", () => {
    expect(emitContainerStyles({})).toEqual([]);
  });

  it("defaults borderWidth to 1 when border set without width", () => {
    const lines = emitContainerStyles({ border: "{color.border}" });
    expect(lines).toContain("  border: 1px solid var(--border);");
  });
});

describe("generateCSS — containerStyles S3 semantic (ADR-071)", () => {
  const baseSpec: ComponentSpec<{ variant?: string }> = {
    name: "FakePopover",
    archetype: "collection",
    element: "div",
    defaultVariant: "primary",
    defaultSize: "md",
    variants: {
      primary: {
        fill: {
          default: {
            base: "{color.neutral}" as TokenRef,
            hover: "{color.neutral-hover}" as TokenRef,
            pressed: "{color.neutral-pressed}" as TokenRef,
          },
        },
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
      pixi: () => ({}),
    },
  };

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
    const css = generateCSS(spec);
    expect(css).not.toContain('[data-variant="primary"]');
  });

  it("keeps defaultVariant injection + variants block when containerStyles absent (baseline)", () => {
    // ADR-912 단계5: production 동형으로 _variantSource 주입 (구 variantToVisual fallback 제거).
    // b6b9b3514 가 중간 boolean 파라미터를 제거해 2-인자 시그니처 — 구 3-인자
    // 호출이 남으면 _variantSource=false 로 variant 블록이 통째 스킵된다.
    const css = generateCSS(baseSpec, variantSourceFromSpec(baseSpec));
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
    expect(css).toContain("border-radius: var(--radius-md);");
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

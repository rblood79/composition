import { describe, it, expect } from "vitest";
import type { ComponentSpec } from "../../types/spec.types";
// ADR-912 단계5 step4 (2026-06-17): TagGroupSpec import 제거 — 물리 삭제, side variant 검증은
//   inline spec-shape(catalog rule 동형)로 대체.
import {
  resolveContainerVariants,
  matchNestedSelector,
  isSupportedNestedSelector,
} from "../";
import { generateCSS } from "../CSSGenerator";

// ─── 최소 Spec 스텁 (ADR-108 P1 동등성 테스트용) ─────────────────────────────

function makeSpec<P>(overrides: Partial<ComponentSpec<P>>): ComponentSpec<P> {
  return {
    name: "Fake",
    archetype: "collection",
    element: "div",
    defaultVariant: "primary",
    defaultSize: "md",
    variants: {
      primary: { background: "{color.neutral}" },
    },
    sizes: {
      md: {
        height: 0,
        paddingX: 0,
        paddingY: 0,
        fontSize: 14,
        borderRadius: 0,
        borderWidth: 0,
        gap: 0,
      },
    },
    states: {},
    render: {
      shapes: () => [],
      react: () => ({}),
    },
    ...overrides,
  } as ComponentSpec<P>;
}

describe("resolveContainerVariants — ADR-108 P1", () => {
  const spec = makeSpec<{ labelPosition?: "top" | "side"; quiet?: boolean }>({
    name: "FakeField",
    composition: {
      delegation: [],
      containerVariants: {
        "label-position": {
          side: {
            styles: {
              display: "grid",
              "grid-template-columns": "max-content minmax(0, 1fr)",
              "column-gap": "var(--spacing-md)",
            },
            nested: [
              {
                selector: "> .react-aria-Label",
                styles: { "grid-column": "1" },
              },
              {
                selector: "> :not(.react-aria-Label)",
                styles: { "grid-column": "2" },
              },
            ],
          },
        },
        quiet: {
          true: {
            styles: { "--bg": "transparent" },
          },
        },
      },
    },
  });

  it("returns empty when spec has no containerVariants", () => {
    const bare = makeSpec<{ x?: string }>({ name: "Bare" });
    const result = resolveContainerVariants(bare, { x: "hello" });
    expect(result.styles).toEqual({});
    expect(result.nested).toEqual([]);
  });

  it("returns empty when no variant matches current props", () => {
    const result = resolveContainerVariants(spec, { labelPosition: "top" });
    expect(result.styles).toEqual({});
    expect(result.nested).toEqual([]);
  });

  it("matches single variant (labelPosition=side) and returns styles + nested", () => {
    const result = resolveContainerVariants(spec, { labelPosition: "side" });
    expect(result.styles).toMatchObject({
      display: "grid",
      "grid-template-columns": "max-content minmax(0, 1fr)",
      "column-gap": "var(--spacing-md)",
    });
    expect(result.nested).toHaveLength(2);
    expect(result.nested[0].selector).toBe("> .react-aria-Label");
    expect(result.nested[1].selector).toBe("> :not(.react-aria-Label)");
  });

  it("merges multiple matching variants", () => {
    const result = resolveContainerVariants(spec, {
      labelPosition: "side",
      quiet: true,
    });
    expect(result.styles).toMatchObject({
      display: "grid",
      "--bg": "transparent",
    });
  });

  // ADR-912 단계5 step4 (2026-06-17): TagGroupSpec 물리 삭제 → catalog rule(COMPONENT_RULES_TABLE
  //   .TagGroup.containerVariants, shared)이 SSOT. specs 는 shared 를 import 못 하므로(boundary)
  //   본 테스트는 catalog rule 과 동일 값의 inline spec-shape 로 helper 동작만 확증.
  //   실제 catalog fallback wiring 검증은 builder sideLabelImplicitStyles.test.ts (TagGroup side variant).
  it("label-position:side variant mirrors shared CSS side rule (TagGroup catalog rule 동형)", () => {
    const tagGroupSideRule = makeSpec<{ labelPosition?: "top" | "side" }>({
      name: "TagGroup",
      composition: {
        delegation: [],
        containerVariants: {
          "label-position": {
            side: {
              styles: {
                "flex-direction": "row",
                "align-items": "flex-start",
              },
            },
          },
        },
      },
    });
    const result = resolveContainerVariants(tagGroupSideRule, {
      labelPosition: "side",
    });

    expect(result.styles).toMatchObject({
      "flex-direction": "row",
      "align-items": "flex-start",
    });
    expect(result.nested).toEqual([]);
  });

  it("coerces boolean prop to 'true'/'false'", () => {
    const result = resolveContainerVariants(spec, { quiet: true });
    expect(result.styles).toEqual({ "--bg": "transparent" });
  });

  it("handles null/undefined spec or props defensively", () => {
    expect(resolveContainerVariants(null, {})).toEqual({
      styles: {},
      nested: [],
    });
    expect(resolveContainerVariants(spec, undefined)).toEqual({
      styles: {},
      nested: [],
    });
  });

  it("skips nested entries with falsy selector", () => {
    const weird = makeSpec<{ mode?: string }>({
      name: "Weird",
      composition: {
        delegation: [],
        containerVariants: {
          mode: {
            x: {
              styles: { color: "red" },
              nested: [
                { selector: "", styles: { color: "blue" } },
                { selector: "> .react-aria-Label", styles: { color: "green" } },
              ],
            },
          },
        },
      },
    });
    const result = resolveContainerVariants(weird, { mode: "x" });
    expect(result.nested).toHaveLength(1);
    expect(result.nested[0].selector).toBe("> .react-aria-Label");
  });
});

// ─── CSSGenerator 동등성 확증 (G1) ───────────────────────────────────────────

describe("resolveContainerVariants ↔ CSSGenerator 동등성 — ADR-108 G1", () => {
  const spec = makeSpec<{ labelPosition?: "top" | "side" }>({
    name: "FakeField",
    composition: {
      delegation: [],
      containerVariants: {
        "label-position": {
          side: {
            styles: {
              display: "grid",
              "grid-template-columns": "max-content minmax(0, 1fr)",
            },
            nested: [
              {
                selector: "> .react-aria-Label",
                styles: { "grid-column": "1" },
              },
            ],
          },
        },
      },
    },
  });

  it("helper output 는 CSSGenerator 가 emit 한 규칙의 부분집합", () => {
    const css = generateCSS(spec) ?? "";
    const resolved = resolveContainerVariants(spec, { labelPosition: "side" });

    // CSSGenerator 는 `.react-aria-FakeField[data-label-position="side"] { ... }` 에
    // 모든 styles 를 emit 해야 한다.
    const variantBlockRegex =
      /\.react-aria-FakeField\[data-label-position="side"\]\s*\{([^}]*)\}/;
    const match = variantBlockRegex.exec(css);
    expect(match).not.toBeNull();
    const block = match![1];

    for (const [prop, value] of Object.entries(resolved.styles)) {
      expect(block).toContain(`${prop}: ${value};`);
    }

    // nested 의 selector 조합도 emit 되어야 한다 (`& > .x` 가 아니라 space-separated).
    const nestedSel = resolved.nested[0].selector;
    const nestedSelStr: string = nestedSel ?? "";
    const nestedPattern = new RegExp(
      `\\.react-aria-FakeField\\[data-label-position="side"\\]\\s*` +
        nestedSelStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "\\s*\\{",
    );
    expect(css).toMatch(nestedPattern);
  });

  it("CSSGenerator 의 모든 (dataAttr, attrValue) variant 는 helper 로 재생산 가능", () => {
    const variants = spec.composition!.containerVariants!;
    for (const [dataAttr, valueMap] of Object.entries(variants)) {
      const propKey = dataAttr.replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
      for (const attrValue of Object.keys(valueMap)) {
        const props = { [propKey]: attrValue } as Record<string, unknown>;
        const resolved = resolveContainerVariants(spec, props);
        const variant = valueMap[attrValue];
        expect(resolved.styles).toEqual(variant.styles ?? {});
        expect(resolved.nested).toEqual(
          (variant.nested ?? []).map((n) => ({
            selector: n.selector,
            styles: n.styles,
          })),
        );
      }
    }
  });
});

// ─── matchNestedSelector ─────────────────────────────────────────────────────

describe("matchNestedSelector — ADR-108 P1 whitelist", () => {
  it("matches `> .react-aria-X` for direct child with tag=X", () => {
    expect(
      matchNestedSelector("> .react-aria-Label", { type: "Label" }, true),
    ).toBe(true);
    expect(
      matchNestedSelector("> .react-aria-Label", { type: "Input" }, true),
    ).toBe(false);
    expect(
      matchNestedSelector("> .react-aria-Label", { type: "Label" }, false),
    ).toBe(false);
  });

  it("matches `> :not(.react-aria-X)` for direct child with tag!=X", () => {
    expect(
      matchNestedSelector("> :not(.react-aria-Label)", { type: "Input" }, true),
    ).toBe(true);
    expect(
      matchNestedSelector("> :not(.react-aria-Label)", { type: "Label" }, true),
    ).toBe(false);
    expect(
      matchNestedSelector(
        "> :not(.react-aria-Label)",
        { type: "Input" },
        false,
      ),
    ).toBe(false);
  });

  it("matches `.react-aria-X` for any-depth tag=X", () => {
    expect(
      matchNestedSelector(".react-aria-Input", { type: "Input" }, true),
    ).toBe(true);
    expect(
      matchNestedSelector(".react-aria-Input", { type: "Input" }, false),
    ).toBe(true);
    expect(
      matchNestedSelector(".react-aria-Input", { type: "Label" }, true),
    ).toBe(false);
  });

  it("returns false for unsupported selectors", () => {
    expect(
      matchNestedSelector(
        ".react-aria-Input:where([data-focused])",
        { type: "Input" },
        true,
      ),
    ).toBe(false);
    expect(
      matchNestedSelector(
        ".react-aria-Group[data-invalid]",
        { type: "Group" },
        true,
      ),
    ).toBe(false);
    expect(
      matchNestedSelector(
        "&[data-invalid] .react-aria-Button",
        { type: "Button" },
        false,
      ),
    ).toBe(false);
    expect(
      matchNestedSelector(".searchfield-container", { type: "Group" }, true),
    ).toBe(false);
    expect(
      matchNestedSelector(
        ".react-aria-DatePicker-time-field",
        { type: "DatePicker" },
        true,
      ),
    ).toBe(false);
  });

  it("returns false for empty/whitespace selector", () => {
    expect(matchNestedSelector("", { type: "Label" }, true)).toBe(false);
    expect(matchNestedSelector("   ", { type: "Label" }, true)).toBe(false);
  });

  it("isSupportedNestedSelector classifies whitelist correctly", () => {
    expect(isSupportedNestedSelector("> .react-aria-Label")).toBe(true);
    expect(isSupportedNestedSelector("> :not(.react-aria-Label)")).toBe(true);
    expect(isSupportedNestedSelector(".react-aria-Input")).toBe(true);
    expect(
      isSupportedNestedSelector(".react-aria-Input:where([data-focused])"),
    ).toBe(false);
    expect(isSupportedNestedSelector(".searchfield-container")).toBe(false);
  });
});

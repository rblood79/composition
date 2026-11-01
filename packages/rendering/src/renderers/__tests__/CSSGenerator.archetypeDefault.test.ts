import { describe, it, expect } from "vitest";
import { getComponentRulesTable } from "../../../../shared/src/index";
import { legacyVariantPaint } from "../../../../shared/src/catalog/rule/rulePaintTree";
import { stateStylesCssFor } from "../../../scripts/generate-css";
import { generateCSS } from "../CSSGenerator";
import type { ComponentSpec, SizeSpec, VariantSpec } from "../../types";

/**
 * ADR-223 (2026-09-18): archetype 미지정 (catalog `"default"`) 의 생성 CSS base 는 중립 상자
 * (`container` 와 같은 block · box-sizing · font-family) 다. 종전 버튼 어법 (inline-flex ·
 * align/justify center · cursor pointer · user-select none · transition) 은 Skia 가 읽지 않는
 * DOM 전용 채널이라 Section/Toolbar 류 컨테이너에서 정렬 발산의 원천이었다.
 *
 * DOM interaction 이 필요한 entry 는 `composition.rootSelectors["&"]` 로 명시한다 (Card · Tab) — 커서는 ADR-297
 * Phase 3b 부터 rule 의 상태 트리 (`structure.stateStyles.cursor` — 쉴 때 pointer · disabled not-allowed).
 * 여기서는 production `buildVirtualSpecs` 동형으로 실제 catalog rule → virtual spec 을 합성해
 * 확인한다. `DEFAULT_BASE_STYLES` 를 버튼 어법으로 되돌리면 Toolbar/Disclosure 케이스가 RED,
 * Card/Tab 의 rootSelectors 를 지우면 각 interaction 케이스가 RED 다.
 */

function ruleSizeToSizeSpec(s: Record<string, unknown>): SizeSpec {
  return {
    height: (s.height as number) ?? 0,
    paddingX: (s.paddingX as number) ?? 0,
    paddingY: (s.paddingY as number) ?? 0,
    fontSize:
      (s.fontSize as SizeSpec["fontSize"]) ?? ("" as SizeSpec["fontSize"]),
    borderRadius:
      (s.borderRadius as SizeSpec["borderRadius"]) ??
      ("" as SizeSpec["borderRadius"]),
  } as SizeSpec;
}

/** rule + structure 메타 → virtual ComponentSpec (generate-css buildVirtualSpecs 동형 최소 구현). */
function cssFor(name: string): string {
  const rule = getComponentRulesTable()[name];
  if (!rule) throw new Error(`no rule for ${name}`);
  const meta = rule.structure;
  if (!meta) throw new Error(`${name} rule has no structure`);

  const sizes: Record<string, SizeSpec> = {};
  for (const [k, v] of Object.entries(rule.sizes)) {
    sizes[k] = ruleSizeToSizeSpec(v as Record<string, unknown>);
  }
  const variants: Record<string, VariantSpec> = {};
  for (const [k, v] of Object.entries(rule.variants)) {
    // ADR-297: the generator's legacy-order input of the variant's paint tree (generate-css `legacyPaintOf`).
    const legacy = legacyVariantPaint(v.paint, rule.fillStyleValues);
    variants[k] = {
      fill: legacy.fill as unknown as VariantSpec["fill"],
      text: (legacy.colors?.text ?? "{color.neutral}") as VariantSpec["text"],
    } as VariantSpec;
  }
  const spec: ComponentSpec<unknown> = {
    name,
    // catalog "default" 는 ArchetypeId 가 아니다 — generate-css `toArchetypeId` 와 같이 미지정으로 넘긴다.
    archetype: undefined,
    element: meta.element as ComponentSpec<unknown>["element"],
    containerStyles: meta.containerStyles,
    defaultVariant: rule.defaultVariant,
    defaultSize: rule.defaultSize ?? "M",
    variants,
    sizes,
    ...(meta.composition ? { composition: meta.composition } : {}),
    render: { shapes: () => [] },
  };
  return generateCSS(spec, undefined, undefined, stateStylesCssFor(name))!;
}

/** root 블록 (`.react-aria-X {` 첫 블록) 만 잘라낸다. */
function rootBlock(css: string, name: string): string {
  const start = css.indexOf(`.react-aria-${name} {`);
  const end = css.indexOf("\n}", start);
  return css.slice(start, end);
}

const BUTTON_VOCABULARY = [
  /cursor:\s*pointer/,
  /user-select:\s*none/,
  /transition:\s*background 0\.15s ease/,
];

describe("ADR-223 archetype 미지정 base = 중립 상자", () => {
  it("Toolbar · Disclosure root 블록에 버튼 어법 · justify-content:center 가 없다", () => {
    for (const name of ["Toolbar", "Disclosure"]) {
      const root = rootBlock(cssFor(name), name);
      expect(root, name).toMatch(/archetype: default/);
      expect(root, name).toMatch(/display:\s*block/);
      expect(root, name).not.toMatch(/justify-content:\s*center/);
      for (const re of BUTTON_VOCABULARY) expect(root, name).not.toMatch(re);
    }
  });

  it("Pagination root 는 align-items:center 를 geometry containerStyles 로 유지한다", () => {
    const root = rootBlock(cssFor("Pagination"), "Pagination");
    expect(root).toMatch(/align-items:\s*center/);
    expect(root).toMatch(/justify-content:\s*space-between/);
    for (const re of BUTTON_VOCABULARY) expect(root).not.toMatch(re);
  });

  it("Card: 상태 트리가 cursor:pointer · rootSelectors['&'] 가 text-decoration:none 만 emit — user-select/transition 은 사라진다", () => {
    const css = cssFor("Card");
    const root = rootBlock(css, "Card");
    for (const re of BUTTON_VOCABULARY) expect(root).not.toMatch(re);
    // 뒤 블록 (base 뒤에 emit → cascade 승) — 상태 트리의 쉴 때 커서 · rootSelectors
    const after = css.slice(root.length);
    expect(after).toMatch(/\.react-aria-Card \{\s*cursor: pointer;\s*\}/);
    expect(after).toMatch(
      /\.react-aria-Card:where\(\[data-disabled\]\) \{[^}]*cursor: not-allowed;/,
    );
    // (text-decoration: S2 Card — a link Card's `<a>` keeps its text undecorated, 2026-10-09.)
    expect(after).toMatch(
      /\.react-aria-Card \{\s*text-decoration: none;\s*\}/,
    );
    expect(css).not.toMatch(/user-select:\s*none/);
    expect(css).not.toMatch(/transition:\s*background 0\.15s ease/);
  });

  it("Tab: 상태 트리가 cursor · rootSelectors['&'] 가 user-select · transition 을 emit", () => {
    const css = cssFor("Tab");
    const root = rootBlock(css, "Tab");
    expect(root).toMatch(/display:\s*inline-flex/); // structure.containerStyles 가 재선언
    for (const re of BUTTON_VOCABULARY) expect(root).not.toMatch(re);
    expect(css).toMatch(/\.react-aria-Tab \{\s*cursor: pointer;\s*\}/);
    expect(css).toMatch(
      /\.react-aria-Tab \{\s*user-select: none;\s*transition: background 0\.15s ease, border-color 0\.15s ease, transform 0\.15s ease;\s*\}/,
    );
  });

  it("archetype 명시 entry (button) 는 영향 없음 — Button base 는 그대로 inline-flex", () => {
    const rule = getComponentRulesTable().Button;
    expect(rule.structure?.archetype).toBe("button");
  });
});

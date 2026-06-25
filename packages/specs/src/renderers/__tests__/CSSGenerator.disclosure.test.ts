import { describe, it, expect } from "vitest";
import { getComponentRulesTable } from "../../../../shared/src/index";
import { generateCSS } from "../CSSGenerator";
import type { ComponentSpec, SizeSpec, VariantSpec } from "../../types";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";

/**
 * 회귀 방지 (2026-06-25): Disclosure 군 generated CSS 가 catalog rule SSOT(structure 메타)에서
 * 파생되는지 검증한다.
 *
 * **배경**: Disclosure / DisclosureGroup spec 삭제(4a703828c) 후, 두 rule 은 `structure` 메타가
 * 없어 generate-css `buildVirtualSpecs` 의 virtual emit 대상에서 빠졌다. 그 결과 generated CSS 는
 * 삭제된 spec 의 **stale 고아 파일**로 방치되어 DOM(stale leaf CSS) ↔ Skia(rule shell) ↔
 * 레퍼런스(starter) 3경로가 발산했다 (헤더 굵기 400/600, 루트 leaf padding, 패널 padding 누락).
 * structure 추가로 rule 한 곳이 3경로를 동시 구동한다.
 *
 * 본 테스트는 production buildVirtualSpecs(generate-css.ts) 와 동형으로 rule → virtual spec 을
 * 합성해 generateCSS 출력을 확증한다. structure 가 제거되면 (또는 composition selector 가 빠지면)
 * 본 테스트가 FAIL 하여 회귀를 잡는다.
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
    ...(s.lineHeight !== undefined
      ? { lineHeight: s.lineHeight as SizeSpec["lineHeight"] }
      : {}),
    ...(s.borderWidth !== undefined
      ? { borderWidth: s.borderWidth as number }
      : {}),
    ...(s.iconSize !== undefined ? { iconSize: s.iconSize as number } : {}),
  } as SizeSpec;
}

/** rule + structure 메타 → virtual ComponentSpec (generate-css buildVirtualSpecs 동형 최소 구현). */
function virtualSpecFor(name: string): {
  spec: ComponentSpec<unknown>;
  variantSource: Record<string, ComponentVisualRule> | undefined;
} {
  const rule = getComponentRulesTable()[name];
  if (!rule) throw new Error(`no rule for ${name}`);
  const meta = rule.structure;
  if (!meta)
    throw new Error(`${name} rule has no structure (virtual emit 제외 — 회귀)`);

  const sizes: Record<string, SizeSpec> = {};
  for (const [k, v] of Object.entries(rule.sizes)) {
    sizes[k] = ruleSizeToSizeSpec(v as Record<string, unknown>);
  }
  const variants: Record<string, VariantSpec> = {};
  for (const [k, v] of Object.entries(rule.variants)) {
    variants[k] = {
      fill: v.fill as unknown as VariantSpec["fill"],
      text: (v.colors?.text ?? "{color.neutral}") as VariantSpec["text"],
      ...(v.colors?.border !== undefined
        ? { border: v.colors.border as VariantSpec["border"] }
        : {}),
    } as VariantSpec;
  }

  const spec: ComponentSpec<unknown> = {
    name,
    archetype: meta.archetype,
    element: meta.element as ComponentSpec<unknown>["element"],
    containerStyles: meta.containerStyles,
    defaultVariant: rule.defaultVariant,
    defaultSize: rule.defaultSize ?? "md",
    variants,
    sizes,
    states: meta.states ?? {
      hover: {},
      pressed: {},
      disabled: { opacity: 0.38 },
      focusVisible: {},
    },
    ...(meta.composition ? { composition: meta.composition } : {}),
    render: { shapes: () => [] },
  };
  return { spec, variantSource: undefined };
}

describe("Disclosure 군 catalog rule structure → generated CSS (3경로 SSOT)", () => {
  it("Disclosure rule 은 structure 메타를 보유한다 (virtual emit 대상)", () => {
    const rule = getComponentRulesTable().Disclosure;
    expect(rule.structure).toBeDefined();
    expect(rule.structure?.composition?.staticSelectors).toBeDefined();
  });

  it("Disclosure CSS: 헤더 trigger 버튼이 flex + font-weight 600 (레퍼런스 정합)", () => {
    const { spec } = virtualSpecFor("Disclosure");
    const css = generateCSS(spec, false, undefined);
    // 헤더 버튼 selector + 굵기 600 (DOM 헤더가 normal weight 로 발산하던 것 방지)
    expect(css).toContain(".react-aria-Button[slot='trigger']");
    expect(css).toMatch(/font-weight:\s*600/);
    // justify-content: flex-start — RAC Button 기본 center override (헤더 chevron+title 좌측 정렬).
    //   누락 시 헤더가 width:100% 안에서 중앙 정렬로 발산(레퍼런스/사용자 요구 = flex-start).
    expect(css).toMatch(/justify-content:\s*flex-start/);
  });

  it("Disclosure CSS: 패널 콘텐츠 div padding emit (콘텐츠 들여쓰기 정합)", () => {
    const { spec } = virtualSpecFor("Disclosure");
    const css = generateCSS(spec, false, undefined);
    expect(css).toContain(".react-aria-DisclosurePanel > div");
  });

  it("Disclosure CSS: chevron rotate selector + data-expanded 90deg", () => {
    const { spec } = virtualSpecFor("Disclosure");
    const css = generateCSS(spec, false, undefined);
    expect(css).toContain(".disclosure-chevron");
    expect(css).toMatch(/\[data-expanded\][\s\S]*?rotate:\s*90deg/);
  });

  it("Disclosure CSS: 루트는 leaf padding(4px 12px) 이 아니라 block 컨테이너", () => {
    const { spec } = virtualSpecFor("Disclosure");
    const css = generateCSS(spec, false, undefined);
    const rootBlock =
      css.match(/\.react-aria-Disclosure \{[\s\S]*?\}/)?.[0] ?? "";
    // containerStyles(display:block) 보유 → sizes.padding 의 컨테이너 leaf emit skip
    expect(rootBlock).toContain("display: block");
    expect(rootBlock).not.toMatch(/padding:\s*4px 12px/);
  });

  it("Disclosure CSS: spacing 변수는 composition 토큰(--spacing-sm/md/lg/xs) — 미정의 --spacing-2/3/4 금지", () => {
    const { spec } = virtualSpecFor("Disclosure");
    const css = generateCSS(spec, false, undefined);
    // 미정의 변수(--spacing-2/3/4)는 컴퓨티드 0 으로 발산 → composition 토큰만 허용
    expect(css).not.toMatch(/var\(--spacing-[234]\)/);
    expect(css).toMatch(/var\(--spacing-(xs|sm|md|lg)\)/);
  });

  it("DisclosureGroup rule 은 structure 메타를 보유한다 (SSOT 일관성)", () => {
    const rule = getComponentRulesTable().DisclosureGroup;
    expect(rule.structure).toBeDefined();
    expect(rule.structure?.composition?.layout).toBe("flex-column");
  });

  it("DisclosureGroup CSS: flex column + overflow hidden 컨테이너", () => {
    const { spec } = virtualSpecFor("DisclosureGroup");
    const css = generateCSS(spec, false, undefined);
    expect(css).toMatch(/flex-direction:\s*column/);
    expect(css).toMatch(/overflow:\s*hidden/);
  });
});

/**
 * CSS Generation Script
 *
 * 모든 Component Spec에서 CSS 파일 생성
 *
 * Usage: pnpm generate:css
 */

import { generateAllCSS } from "../src/renderers/CSSGenerator";
import type { ComponentVisualRule } from "../src/renderers/utils/resolveComponentVisual";
import type { ComponentSpec } from "../src/types";
import {
  validateDelegationPrefixes,
  formatViolations,
} from "../src/runtime/validateDelegationPrefixes";
// ADR-912 ②-6-A (1A-(a)): DOM variant 색상 base source = 정본 table (Skia 와 same-source).
//   build script 는 패키지 경계 밖이라 shared 의 정본 table 을 직접 import 할 수 있다(과거 generate-rules.ts
//   도 같은 경계 외 직접 import 패턴이었고 단계 5 step 3 에서 삭제됨 — 본 generate-css 가 그 직접 import 패턴 유지).
import {
  getComponentRulesTable,
  type ComponentRuleVariant,
} from "../../shared/src/index";
import type { SizeSpec, VariantSpec } from "../src/types";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMPONENTS_DIR = path.join(__dirname, "../src/components");
const OUTPUT_DIR = path.join(
  __dirname,
  "../../shared/src/components/styles/generated",
);

/**
 * shared ComponentRuleVariant(string) → specs ComponentVisualRule(TokenRef). 런타임 동형 캐스팅.
 * (builder 의 ruleVariantToVisual 과 동일 로직 — 패키지 경계상 builder import 불가라 build script 에 복제.
 *  단계 5 에서 spec seam 제거 후 shared hoisting 통합 검토.)
 */
function ruleVariantToVisual(v: ComponentRuleVariant): ComponentVisualRule {
  const c = v.colors ?? {};
  return {
    fill: v.fill as unknown as ComponentVisualRule["fill"],
    text: c.text as ComponentVisualRule["text"],
    textHover: c.textHover as ComponentVisualRule["textHover"],
    textWeight: v.textWeight,
    border: c.border as ComponentVisualRule["border"],
    borderHover: c.borderHover as ComponentVisualRule["borderHover"],
    borderStyle: v.borderStyle,
    outlineText: c.outlineText as ComponentVisualRule["outlineText"],
    outlineBorder: c.outlineBorder as ComponentVisualRule["outlineBorder"],
    subtleText: c.subtleText as ComponentVisualRule["subtleText"],
    selectedText: c.selectedText as ComponentVisualRule["selectedText"],
    selectedBorder: c.selectedBorder as ComponentVisualRule["selectedBorder"],
    emphasizedSelectedText:
      c.emphasizedSelectedText as ComponentVisualRule["emphasizedSelectedText"],
    emphasizedSelectedBorder:
      c.emphasizedSelectedBorder as ComponentVisualRule["emphasizedSelectedBorder"],
  };
}

/**
 * 컴포넌트 type → { variantName: ComponentVisualRule } 맵 (정본 table 파생). rule 미존재(컨테이너 shell
 * 등)면 undefined → generateCSS 가 spec fallback.
 */
function variantSourceFor(
  specName: string,
): Record<string, ComponentVisualRule> | undefined {
  const rule = getComponentRulesTable()[specName];
  if (!rule || !rule.variants) return undefined;
  const map: Record<string, ComponentVisualRule> = {};
  for (const [name, variant] of Object.entries(rule.variants)) {
    map[name] = ruleVariantToVisual(variant);
  }
  return map;
}

// ─── TEXT_LEAF virtual spec 합성 ─────────────────────────────────────────────
//
// ADR-912 단계5 step4: TEXT_LEAF 5개(Text/Heading/Paragraph/Code/Kbd) spec 파일을 삭제하기 전에
// spec 없이도 동일한 CSS 가 재생성되도록 rule+메타상수에서 virtual ComponentSpec input 을 합성한다.
//
// - 메타상수: name / archetype / element(placeholder) / containerStyles / cssEmitMode
// - sizes / variants / defaultVariant / defaultSize: getComponentRulesTable() 에서 읽어 변환
// - generateCSS 본체 로직 불변 — 입력 모양만 ComponentSpec 과 동형
//
// ComponentRuleSize → SizeSpec 변환: ComponentRuleSize 는 모두 optional 이므로
// 누락 필드(paddingX/paddingY/height/fontSize/borderRadius)를 0/"" 기본값으로 채워
// `as unknown as SizeSpec` 동형 캐스팅(builder 의 ruleSizeToSizeSpec 과 동일 패턴).

/**
 * ComponentRuleSize → SizeSpec 변환 (TEXT_LEAF 용).
 * paddingX/paddingY/height/fontSize/borderRadius 필수 필드를 기본값으로 채워 캐스팅.
 */
function ruleSizeToSizeSpec(
  s: Record<string, unknown>,
  paddingX = 0,
  paddingY = 0,
): SizeSpec {
  return {
    height: (s.height as number) ?? 0,
    paddingX: (s.paddingX as number) ?? paddingX,
    paddingY: (s.paddingY as number) ?? paddingY,
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
    ...(s.gap !== undefined ? { gap: s.gap as number } : {}),
    // ADR-912 collection item leaf (2026-06-14): ListBoxItem 의 `min-height` (virtual/short 콘텐츠
    //   축소 하한, line-box 최소) 가 rule.sizes.minHeight 에서 emit 되도록 변환에 포함. 미정의 leaf 는 미emit.
    ...(s.minHeight !== undefined ? { minHeight: s.minHeight as number } : {}),
    // ADR-912 collection item leaf (2026-06-14): ListBoxItem label `font-weight: 600` (semibold)
    //   가 rule.sizes.fontWeight 에서 emit 되도록 변환에 포함. 미정의 leaf 는 미emit (CSSGenerator
    //   가 size.fontWeight 미존재 시 font-weight 줄 자체를 skip).
    ...(s.fontWeight !== undefined
      ? { fontWeight: s.fontWeight as number }
      : {}),
    // ADR-912 box+text leaf 군 (2026-06-11): Button/ToggleButton/Icon 의 --icon-size/--icon-gap
    //   CSS 변수가 rule.sizes.iconSize/iconGap 에서 emit 되도록 변환에 포함. 미정의 leaf 는 미emit.
    ...(s.iconSize !== undefined ? { iconSize: s.iconSize as number } : {}),
    ...(s.iconGap !== undefined ? { iconGap: s.iconGap as number } : {}),
    // ADR-912 단계5 step4 (2026-06-16): IllustratedMessage 의 `.alert-heading` 자식 CSS 가
    //   rule.sizes.headingFontSize 에서 emit 되도록 변환에 포함 (CSSGenerator.generateChildFontStyles
    //   가 size.headingFontSize 소비). 미정의 leaf 는 미emit.
    ...(s.headingFontSize !== undefined
      ? { headingFontSize: s.headingFontSize as SizeSpec["headingFontSize"] }
      : {}),
    // ADR-912 단계5 step4 (2026-06-17): InlineAlert 의 `.alert-heading` font-weight +
    //   `.react-aria-Description` font-size/weight 자식 CSS 가 rule.sizes 에서 emit 되도록 변환에 포함
    //   (CSSGenerator.generateChildFontStyles 가 size.headingFontWeight/descFontSize/descFontWeight 소비).
    //   IllustratedMessage(headingFontSize 만)와 달리 InlineAlert 는 heading weight + description 2축까지 emit.
    //   미정의 leaf 는 미emit.
    ...(s.headingFontWeight !== undefined
      ? {
          headingFontWeight:
            s.headingFontWeight as SizeSpec["headingFontWeight"],
        }
      : {}),
    ...(s.descFontSize !== undefined
      ? { descFontSize: s.descFontSize as SizeSpec["descFontSize"] }
      : {}),
    ...(s.descFontWeight !== undefined
      ? { descFontWeight: s.descFontWeight as SizeSpec["descFontWeight"] }
      : {}),
    // ADR-912 단계5 step4 (2026-06-17): Slider 의 column-gap (Label↔SliderOutput 가로 간격) 이
    //   rule.sizes.columnGap 에서 emit 되도록 변환에 포함 (CSSGenerator 가 size.columnGap 소비).
    //   sm/md 16 · lg/xl 20. gap(row 축)은 기존 처리. 미정의 leaf 는 미emit.
    ...(s.columnGap !== undefined
      ? { columnGap: s.columnGap as SizeSpec["columnGap"] }
      : {}),
    // ADR-912 단계5 step4 (2026-06-17): Slider 의 size별 track/thumb metric 이 nested indicator 에서
    //   emit 되도록 변환에 포함. generateSliderSizeMetrics 가 size.indicator.{trackHeight,thumbSize} 를
    //   nested 로 읽어 `.slider-track-bg/.slider-fill { height }` + `.react-aria-SliderThumb { width/height }`
    //   를 emit. ComponentRuleSize 의 nested indicator 를 SizeSpec.indicator(IndicatorSpec)로 그대로 전달.
    //   flat thumbSize(SliderTrack escape 전용)와 별개. 미정의 leaf 는 미emit.
    ...(s.indicator !== undefined
      ? { indicator: s.indicator as SizeSpec["indicator"] }
      : {}),
  } as SizeSpec;
}

/**
 * ComponentRuleVariant → VariantSpec 변환 (TEXT_LEAF 용).
 * variantSourceFor 가 이미 색상을 override 하므로, 순회 키 + fill 구조만 맞추면 됨.
 */
function ruleVariantToVariantSpec(v: ComponentRuleVariant): VariantSpec {
  const c = v.colors ?? {};
  return {
    fill: v.fill as unknown as VariantSpec["fill"],
    text: (c.text ?? "{color.neutral}") as VariantSpec["text"],
    ...(c.border !== undefined
      ? { border: c.border as VariantSpec["border"] }
      : {}),
    // fillStyle outline/subtle 색 (2026-06-27) — CSSGenerator Phase 2b 가 visual.outlineText/
    //   outlineBorder/subtleText 로 [data-fill-style="outline"|"subtle"] 규칙을 emit. 누락 시
    //   outline 변형이 generated CSS 에서 빠져 Button.css 수동 override 에 의존했다(D3 SSOT 위반).
    ...(c.outlineText !== undefined
      ? { outlineText: c.outlineText as VariantSpec["outlineText"] }
      : {}),
    ...(c.outlineBorder !== undefined
      ? { outlineBorder: c.outlineBorder as VariantSpec["outlineBorder"] }
      : {}),
    ...(c.subtleText !== undefined
      ? { subtleText: c.subtleText as VariantSpec["subtleText"] }
      : {}),
  } as VariantSpec;
}

/**
 * structure 보유 rule entry 를 rule(getComponentRulesTable) + 구조 메타 기반으로 virtual
 * ComponentSpec 배열로 합성. spec 파일 존재 여부와 무관 — virtual emit 집합은 `rule.structure`
 * 보유 여부가 정한다 (ADR-912 Phase 2 — generator-local STRUCTURE_META Map 삭제).
 */
function buildVirtualSpecs(): ComponentSpec<unknown>[] {
  const table = getComponentRulesTable();
  const result: ComponentSpec<unknown>[] = [];

  // ADR-912 Phase 2 (2026-06-19): STRUCTURE_META Map 삭제 → rule table 순회 기반 전환.
  //   virtual CSS emit 멤버십은 이제 `rule.structure` 보유 여부가 결정한다(generator-local
  //   structure SSOT 제거 — breakdown §2-3). `meta = rule.structure` 로 두면 기존 합성 로직
  //   (meta.archetype/element/states/composition/...)이 그대로 작동 → generated CSS byte-diff 0.
  for (const [key, rule] of Object.entries(table)) {
    const meta = rule.structure;
    if (!meta) continue;

    // spec name: rule key 는 대부분 PascalCase(spec name 동일)이나, 일부 container shell(body)은
    //   canonical element.type 정합 위해 lowercase key 로 등재(componentRulesTable.body).
    //   CSS 파일명/selector 는 PascalCase 여야 하므로 lowercase key 는 capitalize 복원
    //   (현재 lowercase 이면서 structure 보유 = body 하나뿐 → "Body").
    const name =
      key[0] === key[0].toLowerCase()
        ? key[0].toUpperCase() + key.slice(1)
        : key;

    // sizes: rule.sizes 의 각 entry 를 SizeSpec 으로 변환
    const sizes: Record<string, SizeSpec> = {};
    for (const [sizeName, ruleSize] of Object.entries(rule.sizes)) {
      sizes[sizeName] = ruleSizeToSizeSpec(ruleSize as Record<string, unknown>);
    }

    // variants: rule.variants 의 각 entry 를 VariantSpec 으로 변환
    const variants: Record<string, VariantSpec> = {};
    for (const [variantName, ruleVariant] of Object.entries(rule.variants)) {
      variants[variantName] = ruleVariantToVariantSpec(ruleVariant);
    }

    const virtualSpec: ComponentSpec<unknown> = {
      name,
      archetype: meta.archetype,
      element: meta.element as ComponentSpec<unknown>["element"],
      containerStyles: meta.containerStyles,
      defaultVariant: rule.defaultVariant,
      defaultSize: rule.defaultSize ?? "md",
      variants,
      sizes,
      // states: 기본 hover/pressed/disabled(opacity)/focusVisible. meta.states 설정 시 override
      //   (ProgressBarTrack 처럼 disabled 에 pointerEvents:none 추가 필요한 군).
      states: meta.states ?? {
        hover: {},
        pressed: {},
        disabled: { opacity: 0.38 },
        focusVisible: {},
      },
      // cssEmitMode: Button/ToggleButton 의 button-base(변수 + color-mix 파생). 미설정 시 direct.
      ...(meta.cssEmitMode ? { cssEmitMode: meta.cssEmitMode } : {}),
      // composition: rule 에 없는 CSS selector 메타(Link underline 등). 미설정 시 미적용.
      ...(meta.composition ? { composition: meta.composition } : {}),
      // indicatorMode: ToggleButtonGroup 의 selection indicator 구조. 미설정 시 미emit.
      ...(meta.indicatorMode ? { indicatorMode: meta.indicatorMode } : {}),
      render: {
        shapes: () => [],
      },
    };

    result.push(virtualSpec);
    console.log(`  ✓ Synthesized virtual spec: ${name} (from rule table)`);
  }

  return result;
}

async function main(): Promise<void> {
  console.log("🔄 Starting CSS generation...\n");

  try {
    // 출력 디렉토리 생성
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // components 디렉토리에서 모든 .spec.ts 파일 찾기
    const files = await fs.readdir(COMPONENTS_DIR).catch(() => []);
    const specFiles = files.filter((f) => f.endsWith(".spec.ts"));

    if (specFiles.length === 0) {
      console.log("⚠️  No spec files found in", COMPONENTS_DIR);
      console.log("   Spec files will be added in Phase 1");
      return;
    }

    // 각 spec 파일 로드
    // ADR-912 Phase 2 (2026-06-19): structure 보유 rule entry 의 컴포넌트는 virtual spec 우선 — dedup
    //   (spec 파일과 virtual 이 일시 공존하면 virtual override → 이중 emit 방지. STRUCTURE_META Map
    //    삭제 후 dedup key 는 rule table 의 structure 보유 entry 의 spec name(body→Body 복원)이 된다.)
    const virtualNames = new Set(
      Object.entries(getComponentRulesTable())
        .filter(([, rule]) => rule.structure)
        .map(([key]) =>
          key[0] === key[0].toLowerCase()
            ? key[0].toUpperCase() + key.slice(1)
            : key,
        ),
    );
    const specs: ComponentSpec<unknown>[] = [];

    for (const file of specFiles) {
      // structure 보유: spec 파일이 존재해도 virtual input 으로 대체 — 파일 스캔 결과에서 제외
      const componentName = file.replace(".spec.ts", "");
      if (virtualNames.has(componentName)) {
        console.log(`  → Skipped (virtual override): ${file}`);
        continue;
      }

      const filePath = path.join(COMPONENTS_DIR, file);
      const module = await import(filePath);

      // default export 또는 *Spec export 찾기
      const specName = file.replace(".spec.ts", "") + "Spec";
      const spec = module.default || module[specName];

      if (spec && typeof spec === "object" && "name" in spec) {
        specs.push(spec as ComponentSpec<unknown>);
        console.log(`  ✓ Loaded: ${file}`);
      } else {
        console.warn(`  ⚠ Skipped: ${file} (no valid spec export)`);
      }
    }

    // structure 보유 rule entry → virtual specs 추가 (rule+구조 메타 기반 합성)
    const virtualSpecs = buildVirtualSpecs();
    specs.push(...virtualSpecs);

    if (specs.length === 0) {
      console.log("\n⚠️  No valid specs found");
      return;
    }

    // ADR-059 v2 Pre-Phase 0-D: delegation prefix SSOT 검증
    const violations = validateDelegationPrefixes(specs);
    if (violations.length > 0) {
      console.error("\n" + formatViolations(violations));
      process.exit(1);
    }
    console.log(`\n✓ Delegation prefix 검증 통과 (${specs.length} specs)`);

    // CSS 생성
    console.log("\n📝 Generating CSS files...\n");
    await generateAllCSS(specs, OUTPUT_DIR, variantSourceFor);

    console.log(`\n✅ Generated ${specs.length} CSS files in ${OUTPUT_DIR}`);
  } catch (error) {
    console.error("❌ CSS generation failed:", error);
    process.exit(1);
  }
}

main();

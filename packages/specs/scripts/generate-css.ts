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
  } as SizeSpec;
}

/**
 * ComponentRuleVariant → VariantSpec 변환 (TEXT_LEAF 용).
 * variantSourceFor 가 이미 색상을 override 하므로, 순회 키 + fill 구조만 맞추면 됨.
 */
function ruleVariantToVariantSpec(v: ComponentRuleVariant): VariantSpec {
  return {
    fill: v.fill as unknown as VariantSpec["fill"],
    text: (v.colors?.text ?? "{color.neutral}") as VariantSpec["text"],
    ...(v.colors?.border !== undefined
      ? { border: v.colors.border as VariantSpec["border"] }
      : {}),
  } as VariantSpec;
}

/**
 * TEXT_LEAF 메타상수 — CSS 생성에 필요한 최소 정보만.
 * (name / archetype / element placeholder / containerStyles)
 */
const TEXT_LEAF_NAMES = new Set([
  "Text",
  "Heading",
  "Paragraph",
  "Code",
  "Kbd",
]);

type TextLeafMeta = {
  name: string;
  archetype: ComponentSpec<unknown>["archetype"];
  element: string;
  containerStyles: ComponentSpec<unknown>["containerStyles"];
};

const TEXT_LEAF_META: TextLeafMeta[] = [
  {
    name: "Text",
    archetype: "text",
    element: "p",
    containerStyles: { display: "block", width: "100%" },
  },
  {
    name: "Heading",
    archetype: "text",
    element: "p", // element 는 CSS selector 생성에 미사용 — name 기반. placeholder.
    containerStyles: { display: "block", width: "100%" },
  },
  {
    name: "Paragraph",
    archetype: "text",
    element: "p",
    containerStyles: { display: "block", width: "100%" },
  },
  {
    name: "Code",
    archetype: "simple",
    element: "code",
    containerStyles: { display: "inline-flex", alignItems: "center" },
  },
  {
    name: "Kbd",
    archetype: "simple",
    element: "kbd",
    containerStyles: { display: "inline-flex", alignItems: "center" },
  },
];

/**
 * TEXT_LEAF 5개를 rule+메타 기반으로 virtual ComponentSpec 배열로 합성.
 * spec 파일이 아직 존재하더라도 이 경로를 우선(dedup 은 호출처에서 처리).
 */
function buildTextLeafVirtualSpecs(): ComponentSpec<unknown>[] {
  const table = getComponentRulesTable();
  const result: ComponentSpec<unknown>[] = [];

  for (const meta of TEXT_LEAF_META) {
    const rule = table[meta.name];
    if (!rule) {
      console.warn(`  ⚠ TEXT_LEAF virtual: no rule for ${meta.name}, skipping`);
      continue;
    }

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
      name: meta.name,
      archetype: meta.archetype,
      element: meta.element as ComponentSpec<unknown>["element"],
      containerStyles: meta.containerStyles,
      defaultVariant: rule.defaultVariant,
      defaultSize: rule.defaultSize ?? "md",
      variants,
      sizes,
      // states: Text/Heading/Paragraph/Code/Kbd 모두 hover/pressed/disabled/focusVisible
      states: {
        hover: {},
        pressed: {},
        disabled: { opacity: 0.38 },
        focusVisible: {},
      },
      render: {
        shapes: () => [],
      },
    };

    result.push(virtualSpec);
    console.log(`  ✓ Synthesized virtual spec: ${meta.name} (from rule table)`);
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
    // ADR-912 단계5 step4: TEXT_LEAF 5개는 virtual spec 이 우선 — dedup
    const specs: ComponentSpec<unknown>[] = [];

    for (const file of specFiles) {
      // TEXT_LEAF: spec 파일이 아직 존재해도 virtual input 으로 대체 — 파일 스캔 결과에서 제외
      const componentName = file.replace(".spec.ts", "");
      if (TEXT_LEAF_NAMES.has(componentName)) {
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

    // TEXT_LEAF virtual specs 추가 (rule+메타 기반 합성)
    const textLeafVirtuals = buildTextLeafVirtualSpecs();
    specs.push(...textLeafVirtuals);

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

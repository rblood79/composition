/**
 * Component Rules Table Generation Script (ADR-142 G2(b) B)
 *
 * 124 spec 의 variants/sizes/fill 을 build-time 에 ComponentRulesTable 로 변환 →
 * `packages/shared/src/catalog/generated/componentRulesTable.ts` 생성.
 *
 * generic 렌더러(buildCatalogShapes / CSSGenerator)가 spec 참조 0 으로 본 테이블만 소비하게
 * 만드는 D3 시각 SSOT(ADR-142 #5/#8). spec 은 본 생성기의 build-time source 로만 잔류.
 *
 * **패키지 경계 (RB5)**: 생성물을 shared 에 출력 → resolver(shared/catalog)가 specs 직접 import
 * 없이 같은 패키지 generated 파일을 읽는다. TokenRef(`{color.X}`)는 string 그대로 보존(runtime
 * resolveCanonicalToken/resolveToken 이 dark mode 반전 포함 실수 값 변환).
 *
 * Usage: pnpm generate:rules (build:specs 에 포함)
 */

import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

import type {
  ComponentRule,
  ComponentRuleFill,
  ComponentRuleSize,
  ComponentRuleVariant,
  ComponentRuleVariantColors,
} from "../../shared/src/types/composition-document.types";
import type { ComponentSpec, SizeSpec, VariantSpec } from "../src/types";
import { resolveFillTokens } from "../src/utils/fillTokens";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMPONENTS_DIR = path.join(__dirname, "../src/components");
const OUTPUT_DIR = path.join(__dirname, "../../shared/src/catalog/generated");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "componentRulesTable.ts");

/** FillTokenSpec(TokenRef) → ComponentRuleFill(string). TokenRef 는 이미 string. */
function projectFill(variant: VariantSpec): ComponentRuleFill {
  const fill = resolveFillTokens(variant);
  const fill2: ComponentRuleFill = {
    default: { ...(fill.default as ComponentRuleFill["default"]) },
  };
  if (fill.outline) fill2.outline = { ...fill.outline };
  if (fill.subtle) fill2.subtle = { ...fill.subtle };
  if (fill.alpha !== undefined) fill2.alpha = fill.alpha;
  return fill2;
}

/** VariantSpec 비-fill 색상 → ComponentRuleVariantColors (undefined 필드 생략). */
function projectColors(
  variant: VariantSpec,
): ComponentRuleVariantColors | undefined {
  const c: ComponentRuleVariantColors = {};
  const keys: (keyof ComponentRuleVariantColors & keyof VariantSpec)[] = [
    "text",
    "textHover",
    "border",
    "borderHover",
    "outlineText",
    "outlineBorder",
    "subtleText",
    "selectedText",
    "selectedBorder",
    "emphasizedSelectedText",
    "emphasizedSelectedBorder",
  ];
  let any = false;
  for (const k of keys) {
    const v = variant[k];
    if (v !== undefined) {
      c[k] = v as string;
      any = true;
    }
  }
  return any ? c : undefined;
}

/** SizeSpec → ComponentRuleSize (시각 필드만; layout padding/gap 제외 — ADR-907 Layer B). */
function projectSize(size: SizeSpec): ComponentRuleSize {
  const s: ComponentRuleSize = {};
  const sizeRec = size as unknown as Record<string, unknown>;
  for (const k of [
    "fontSize",
    "lineHeight",
    "borderRadius",
    "borderWidth",
    "height",
    "iconSize",
  ] as const) {
    const v = sizeRec[k];
    if (v !== undefined) (s as Record<string, unknown>)[k] = v;
  }
  return s;
}

function projectSpec(spec: ComponentSpec<unknown>): ComponentRule {
  const rule: ComponentRule = {
    defaultVariant: spec.defaultVariant,
    defaultSize: spec.defaultSize,
    variants: {},
    sizes: {},
  };
  if (spec.variants) {
    for (const [name, variant] of Object.entries(spec.variants)) {
      const v: ComponentRuleVariant = { fill: projectFill(variant) };
      const colors = projectColors(variant);
      if (colors) v.colors = colors;
      rule.variants[name] = v;
    }
  }
  if (spec.sizes) {
    for (const [name, size] of Object.entries(spec.sizes)) {
      rule.sizes[name] = projectSize(size);
    }
  }
  // root text-decoration (Link underline 등) — spec.composition.rootSelectors["&"] D3 메타 투영.
  // "none"(기본값 동일)은 시각 무의미 → 생략. underline 등만 rule 에 담는다(buildCatalogShapes 주입).
  const td =
    spec.composition?.rootSelectors?.["&"]?.styles?.["text-decoration"];
  if (td && td !== "none") rule.textDecoration = td;
  return rule;
}

async function main(): Promise<void> {
  console.log("🔄 Starting component rules table generation...\n");

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const files = await fs.readdir(COMPONENTS_DIR).catch(() => []);
  const specFiles = files.filter((f) => f.endsWith(".spec.ts"));

  const table: Record<string, ComponentRule> = {};
  let count = 0;

  for (const file of specFiles.sort()) {
    const filePath = path.join(COMPONENTS_DIR, file);
    const mod = await import(filePath);
    const specName = file.replace(".spec.ts", "") + "Spec";
    const spec = mod.default || mod[specName];
    if (spec && typeof spec === "object" && "name" in spec) {
      table[spec.name] = projectSpec(spec as ComponentSpec<unknown>);
      count++;
    } else {
      console.warn(`  ⚠ Skipped: ${file} (no valid spec export)`);
    }
  }

  const header = `/**
 * AUTO-GENERATED — do not edit. Source: packages/specs/scripts/generate-rules.ts (pnpm generate:rules).
 *
 * ADR-142 G2(b) B — 124 spec 의 variants/sizes/fill 을 build-time 변환한 D3 시각 SSOT.
 * generic 렌더러(buildCatalogShapes / CSSGenerator)가 spec 참조 0 으로 본 테이블만 소비.
 * TokenRef(\`{color.X}\`)는 string 그대로 — runtime resolveCanonicalToken/resolveToken 이 변환.
 */
import type { ComponentRulesTable } from "../../types/composition-document.types";

export const COMPONENT_RULES_TABLE: ComponentRulesTable = ${JSON.stringify(table, null, 2)};
`;

  await fs.writeFile(OUTPUT_FILE, header, "utf-8");
  console.log(
    `\n✅ Generated component rules for ${count} components → ${OUTPUT_FILE}`,
  );
}

main().catch((error) => {
  console.error("❌ Component rules generation failed:", error);
  process.exit(1);
});

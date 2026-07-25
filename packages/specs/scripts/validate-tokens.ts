/**
 * Token Validation Script
 *
 * 프리미티브 토큰과 컴포넌트 스펙의 토큰 참조 일관성 검증
 *
 * Usage: pnpm validate:tokens
 */

import { lightColors, darkColors } from "../src/primitives/colors";
import { spacing } from "../src/primitives/spacing";
import { typography } from "../src/primitives/typography";
import { radius } from "../src/primitives/radius";
import { lightShadows } from "../src/primitives/shadows";
import { resolveToken } from "../src/renderers/utils/tokenResolver";
import { isValidTokenRef, type TokenRef } from "../src/types/token.types";
import type { ComponentSpec, VariantSpec, SizeSpec } from "../src/types";
// ADR-908 Phase 4: Fill token SSOT accessor
import { resolveFillTokens } from "../src/utils/fillTokens";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TokenValidationResult {
  passed: boolean;
  totalTokens: number;
  resolvedTokens: number;
  errors: string[];
  warnings: string[];
}

// 프리미티브에 정의된 모든 토큰 이름 수집
function collectPrimitiveTokens(): Map<string, Set<string>> {
  const tokens = new Map<string, Set<string>>();
  tokens.set("color", new Set(Object.keys(lightColors)));
  tokens.set("spacing", new Set(Object.keys(spacing)));
  tokens.set("typography", new Set(Object.keys(typography)));
  tokens.set("radius", new Set(Object.keys(radius)));
  // 키 열거만 하므로 theme 무관 — light/dark 는 같은 키 집합이다 (shadowCssParity 가 잠금).
  tokens.set("shadow", new Set(Object.keys(lightShadows)));
  return tokens;
}

// 토큰 참조에서 카테고리와 이름 추출
function parseTokenRef(ref: string): { category: string; name: string } | null {
  const match = ref.match(/^\{(\w+)\.(.+)\}$/);
  if (!match) return null;
  return { category: match[1], name: match[2] };
}

// 스펙에서 사용된 모든 토큰 참조 추출
function extractTokenRefs(
  spec: ComponentSpec<unknown>,
): { ref: string; location: string }[] {
  const refs: { ref: string; location: string }[] = [];

  // variants (ADR-062: optional — Field 계열은 variants 없음)
  // ADR-908 Phase 4: legacy background* 는 fill SSOT 로 통합됨 — resolveFillTokens() 경유
  Object.entries(spec.variants ?? {}).forEach(
    ([name, variant]: [string, VariantSpec]) => {
      const fill = resolveFillTokens(variant);
      const variantRefs: [string, TokenRef | undefined][] = [
        ["fill.default.base", fill.default.base],
        ["fill.default.hover", fill.default.hover],
        ["fill.default.pressed", fill.default.pressed],
        ["text", variant.text],
        ["textHover", variant.textHover],
        ["border", variant.border],
        ["borderHover", variant.borderHover],
      ];
      for (const [field, ref] of variantRefs) {
        if (ref && typeof ref === "string" && ref.startsWith("{")) {
          refs.push({ ref, location: `variants.${name}.${field}` });
        }
      }
    },
  );

  // sizes
  Object.entries(spec.sizes).forEach(([name, size]) => {
    refs.push({ ref: size.fontSize, location: `sizes.${name}.fontSize` });
    refs.push({
      ref: size.borderRadius,
      location: `sizes.${name}.borderRadius`,
    });
  });

  return refs;
}

async function main(): Promise<void> {
  console.log("🔍 Validating Token References...\n");

  const result: TokenValidationResult = {
    passed: true,
    totalTokens: 0,
    resolvedTokens: 0,
    errors: [],
    warnings: [],
  };

  const primitiveTokens = collectPrimitiveTokens();

  // 프리미티브 토큰 요약 출력
  console.log("📦 Primitive Tokens:");
  for (const [category, names] of primitiveTokens) {
    console.log(`   ${category}: ${names.size} tokens`);
  }
  console.log("");

  // 모든 컴포넌트 스펙 로드
  const componentsDir = path.join(__dirname, "../src/components");
  const files = await fs.readdir(componentsDir).catch(() => []);
  const specFiles = files.filter((f) => f.endsWith(".spec.ts"));

  if (specFiles.length === 0) {
    console.log("⚠️  No spec files found");
    return;
  }

  for (const file of specFiles) {
    const filePath = path.join(componentsDir, file);
    const module = await import(filePath);
    const specName = file.replace(".spec.ts", "") + "Spec";
    const spec = module.default || module[specName];

    if (!spec) {
      result.warnings.push(`${file}: No valid spec export found`);
      continue;
    }

    console.log(`  Checking: ${file}`);
    const tokenRefs = extractTokenRefs(spec);

    for (const { ref, location } of tokenRefs) {
      result.totalTokens++;

      // 유효성 검사
      if (!isValidTokenRef(ref)) {
        result.errors.push(`${file}: ${location} — invalid token ref: ${ref}`);
        result.passed = false;
        continue;
      }

      // 프리미티브 존재 확인
      const parsed = parseTokenRef(ref);
      if (!parsed) continue;

      const categoryTokens = primitiveTokens.get(parsed.category);
      if (!categoryTokens) {
        result.errors.push(
          `${file}: ${location} — unknown category: ${parsed.category}`,
        );
        result.passed = false;
        continue;
      }

      if (!categoryTokens.has(parsed.name)) {
        result.errors.push(
          `${file}: ${location} — token "${parsed.name}" not found in ${parsed.category} primitives`,
        );
        result.passed = false;
        continue;
      }

      // resolve 가능 확인 (light + dark)
      const lightValue = resolveToken(ref as TokenRef, "light");
      const darkValue = resolveToken(ref as TokenRef, "dark");

      if (lightValue === ref || darkValue === ref) {
        result.warnings.push(
          `${file}: ${location} — could not resolve: ${ref}`,
        );
      } else {
        result.resolvedTokens++;
      }
    }
  }

  // 결과 출력
  console.log("\n" + "─".repeat(50));
  console.log(`\n📊 Token Validation Summary:`);
  console.log(`   Total references: ${result.totalTokens}`);
  console.log(`   Resolved:         ${result.resolvedTokens}`);
  console.log(
    `   Failed:           ${result.totalTokens - result.resolvedTokens}`,
  );

  if (result.errors.length > 0) {
    console.log("\n❌ Errors:");
    result.errors.forEach((e) => console.log(`   • ${e}`));
  }

  if (result.warnings.length > 0) {
    console.log("\n⚠️  Warnings:");
    result.warnings.forEach((w) => console.log(`   • ${w}`));
  }

  if (result.passed) {
    console.log("\n✅ All token references are valid!");
  } else {
    console.log("\n❌ Token validation failed");
    process.exit(1);
  }
}

main();

/**
 * validate:sync — Spec ↔ Generated CSS 동기화 검증
 *
 * ADR-036 Phase 1: 수동 CSS 잔존 기간의 안전망.
 *
 * 검증 방식:
 * 1. 모든 Spec에서 CSS를 재생성 (메모리 내)
 * 2. generated/ 디렉토리의 기존 CSS와 diff 비교
 * 3. 불일치가 있으면 에러 리포트 + exit code 1
 *
 * Usage: pnpm validate:sync
 */

import { generateCSS } from "../src/renderers/CSSGenerator";
import type { ComponentVisualRule } from "../src/renderers/utils/resolveComponentVisual";
import type { ComponentSpec } from "../src/types";
// ADR-912 ②-6-A (1A-(a)): drift 검증을 정본 table 기준으로 — generate-css 와 동일 source 주입.
import {
  getComponentRulesTable,
  type ComponentRuleVariant,
} from "../../shared/src/index";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMPONENTS_DIR = path.join(__dirname, "../src/components");
const GENERATED_DIR = path.join(
  __dirname,
  "../../shared/src/components/styles/generated",
);

/** ADR-912 ②-6-A: shared ComponentRuleVariant → specs ComponentVisualRule (generate-css 와 동일 로직). */
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

interface ValidationResult {
  component: string;
  status: "ok" | "mismatch" | "missing" | "extra";
  details?: string;
}

async function loadSpecs(): Promise<
  { name: string; spec: ComponentSpec<unknown> }[]
> {
  const files = await fs.readdir(COMPONENTS_DIR).catch(() => []);
  const specFiles = files.filter((f) => f.endsWith(".spec.ts"));
  const results: { name: string; spec: ComponentSpec<unknown> }[] = [];

  for (const file of specFiles) {
    const filePath = path.join(COMPONENTS_DIR, file);
    const module = await import(filePath);
    const specName = file.replace(".spec.ts", "") + "Spec";
    const spec = module.default || module[specName];

    if (spec && typeof spec === "object" && "name" in spec) {
      results.push({ name: spec.name, spec: spec as ComponentSpec<unknown> });
    }
  }

  return results;
}

async function main(): Promise<void> {
  console.log("🔍 Validating Spec ↔ Generated CSS sync...\n");

  const specs = await loadSpecs();
  if (specs.length === 0) {
    console.log("⚠️  No specs found");
    return;
  }

  const results: ValidationResult[] = [];
  let mismatchCount = 0;

  // generated/ 디렉토리 존재 확인
  try {
    await fs.access(GENERATED_DIR);
  } catch {
    console.error(`❌ Generated directory not found: ${GENERATED_DIR}`);
    console.error("   Run 'pnpm generate:css' first.");
    process.exit(1);
  }

  // 기존 generated CSS 파일 목록
  const existingFiles = new Set(
    (await fs.readdir(GENERATED_DIR).catch(() => []))
      .filter((f) => f.endsWith(".css"))
      .map((f) => f.replace(".css", "")),
  );

  for (const { name, spec } of specs) {
    // skipCSSGeneration spec(frame=layout container / Group=D1 ARIA 등)은 generate-css 가
    //   독립 CSS 파일을 의도적으로 생성하지 않는다(CSSGenerator.ts:263 `return null`). validate-sync
    //   도 동일 정책으로 정렬 — 미생성이 정상이므로 missing 검사에서 제외(2026-06-25). 제외 안 하면
    //   frame/Group 이 "generated CSS missing" 으로 false error → Stop hook 차단(정책 불일치 버그).
    if ((spec as { skipCSSGeneration?: boolean }).skipCSSGeneration === true) {
      continue;
    }

    const expectedCSS = generateCSS(spec, variantSourceFor(name));
    const cssPath = path.join(GENERATED_DIR, `${name}.css`);

    try {
      const actualCSS = await fs.readFile(cssPath, "utf-8");
      existingFiles.delete(name);

      if (normalizeCSS(expectedCSS) === normalizeCSS(actualCSS)) {
        results.push({ component: name, status: "ok" });
      } else {
        mismatchCount++;
        const diffLines = findDiffLines(expectedCSS, actualCSS);
        results.push({
          component: name,
          status: "mismatch",
          details: diffLines,
        });
      }
    } catch {
      mismatchCount++;
      results.push({
        component: name,
        status: "missing",
        details: `${cssPath} not found`,
      });
    }
  }

  // generated/에 있지만 Spec에 없는 파일 (orphan)
  for (const orphan of existingFiles) {
    results.push({
      component: orphan,
      status: "extra",
      details: `No matching Spec found for generated/${orphan}.css`,
    });
  }

  // 리포트 출력
  const ok = results.filter((r) => r.status === "ok");
  const mismatches = results.filter((r) => r.status === "mismatch");
  const missing = results.filter((r) => r.status === "missing");
  const extra = results.filter((r) => r.status === "extra");

  if (ok.length > 0) {
    console.log(`✅ ${ok.length} components in sync`);
  }

  if (mismatches.length > 0) {
    console.log(`\n❌ ${mismatches.length} components out of sync:\n`);
    for (const r of mismatches) {
      console.log(`  ${r.component}:`);
      if (r.details) {
        for (const line of r.details.split("\n").slice(0, 10)) {
          console.log(`    ${line}`);
        }
        const totalLines = r.details.split("\n").length;
        if (totalLines > 10) {
          console.log(`    ... (${totalLines - 10} more lines)`);
        }
      }
      console.log();
    }
  }

  if (missing.length > 0) {
    console.log(`\n⚠️  ${missing.length} generated CSS files missing:`);
    for (const r of missing) {
      console.log(`  - ${r.component}: ${r.details}`);
    }
  }

  if (extra.length > 0) {
    console.log(`\n⚠️  ${extra.length} orphan CSS files (no Spec):`);
    for (const r of extra) {
      console.log(`  - ${r.component}: ${r.details}`);
    }
  }

  console.log(
    `\nSummary: ${ok.length} ok, ${mismatchCount} errors, ${extra.length} warnings`,
  );

  if (mismatchCount > 0) {
    console.log('\n💡 Run "pnpm generate:css" to regenerate CSS files.');
    process.exit(1);
  }
}

/** 공백/줄바꿈 차이를 무시하고 비교하기 위한 정규화 */
function normalizeCSS(css: string): string {
  return css
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

/** 두 CSS 문자열의 차이를 찾아 간략한 diff 생성 */
function findDiffLines(expected: string, actual: string): string {
  const expLines = expected.split("\n");
  const actLines = actual.split("\n");
  const diffs: string[] = [];

  const maxLen = Math.max(expLines.length, actLines.length);
  for (let i = 0; i < maxLen; i++) {
    const exp = expLines[i]?.trim() ?? "(missing)";
    const act = actLines[i]?.trim() ?? "(missing)";
    if (exp !== act) {
      diffs.push(`L${i + 1}: expected "${exp}"`);
      diffs.push(`L${i + 1}:   actual "${act}"`);
    }
  }

  return diffs.length > 0 ? diffs.join("\n") : "Content differs (whitespace)";
}

main();

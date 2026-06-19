/**
 * @fileoverview ADR-912 catalog SSOT collapse — Phase 0 grep guard (재도입 금지 + baseline 단조 감소).
 *
 * breakdown(`docs/adr/design/912-catalog-ssot-collapse-breakdown.md`) §3 Phase 0 / §5 kill criteria.
 * collapse 가 닫으려는 dispersion source 8종의 현재 occurrence 를 baseline 으로 고정한다.
 *
 * **두 가지 가드**:
 *   1. 즉시-0 (Phase 1 충족분): 새 shared resolver 가 `@composition/specs` 를 **import 문**으로
 *      참조하지 않는다 (Δ1 — 주석 내 문자열은 제외, 실제 `from "@composition/specs"` 만 검사).
 *   2. baseline 단조 감소: 8 dispersion 패턴의 occurrence 가 baseline 을 **초과하면 regression**
 *      (실패). collapse phase(2·3·4) 진행 시 baseline 을 낮춰 0 으로 수렴. 0 도달 = §5 kill 통과.
 *
 * baseline 측정 시점: Phase 1 land (2026-06-19). STRUCTURE_META(generate-css) / mirror·base-axis
 * (implicitStyles) / TAG_SPEC_MAP(specPresetResolver) 가 아직 전부 live 인 상태.
 *
 * 정밀화 메모: breakdown §3 Phase 0 의 `grep -c "@composition/specs" = 0` 는 주석에 그 문자열을
 * 쓰면 false positive 가 된다(설명용 인용 2건). 본 가드는 `from ['"]@composition/specs` import 문만
 * 검사하여 가드 자기-위반을 막는다.
 */

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// __dirname = packages/shared/src/catalog/__tests__ → 5단계 상승 = repo root.
const REPO_ROOT = path.resolve(__dirname, "../../../../..");

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

function countMatches(text: string, pattern: RegExp): number {
  const re = new RegExp(
    pattern.source,
    pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g",
  );
  return (text.match(re) ?? []).length;
}

const FILES = {
  generateCss: "packages/specs/scripts/generate-css.ts",
  cssGenerator: "packages/specs/src/renderers/CSSGenerator.ts",
  implicitStyles:
    "apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts",
  specPresetResolver:
    "apps/builder/src/builder/panels/styles/utils/specPresetResolver.ts",
  newResolver:
    "packages/shared/src/catalog/resolvers/resolveCatalogContainer.ts",
} as const;

describe("ADR-912 collapse grep gate — 즉시-0 (Phase 1 충족)", () => {
  it("새 resolver 는 @composition/specs 를 import 문으로 참조하지 않는다 (Δ1)", () => {
    const text = read(FILES.newResolver);
    const importMatches = countMatches(text, /from\s+['"]@composition\/specs/);
    expect(importMatches).toBe(0);
  });
});

/**
 * dispersion baseline (Phase 1 land 시점). collapse 진행하며 낮춘다.
 * 각 항목이 baseline 을 **초과하면 regression**(재도입). 0 도달 = §5 kill criteria 통과.
 */
const DISPERSION_BASELINE: Array<{
  label: string;
  file: keyof typeof FILES;
  pattern: RegExp;
  baseline: number;
  killPhase: string;
}> = [
  {
    label: "STRUCTURE_META_ENTRIES (generator-local structure SSOT)",
    file: "generateCss",
    pattern: /STRUCTURE_META_ENTRIES/,
    baseline: 2,
    killPhase: "Phase 2",
  },
  {
    label: "COMPOSITION_LAYOUT_STYLES (generator-private layout table, Δ7)",
    file: "cssGenerator",
    pattern: /COMPOSITION_LAYOUT_STYLES/,
    baseline: 2,
    killPhase: "Phase 2",
  },
  {
    label: "LOWERCASE_COMPONENT_RULE_CONTAINER (builder-local catalog map)",
    file: "implicitStyles",
    pattern: /LOWERCASE_COMPONENT_RULE_CONTAINER/,
    baseline: 3,
    killPhase: "Phase 3",
  },
  {
    label: 'base-axis fallback flexDirection ?? "column" (Δ6, 7곳 분산)',
    file: "implicitStyles",
    pattern: /flexDirection.*\?\? "column"/,
    baseline: 7,
    killPhase: "Phase 3",
  },
  {
    label: "VALUE_FILL_TRACK_HEIGHT mirror (Δ4)",
    file: "implicitStyles",
    pattern: /VALUE_FILL_TRACK_HEIGHT/,
    // occurrence 카운트(선언 1 + 소비처 7, 일부 라인 2회 등장) = 8. grep -c(라인수=5) 와 다름.
    baseline: 8,
    killPhase: "Phase 3",
  },
  {
    label: "INDICATOR_SIZES mirror (Δ4/Δ5)",
    file: "implicitStyles",
    pattern: /INDICATOR_SIZES/,
    baseline: 5,
    killPhase: "Phase 3",
  },
  {
    label: "PROGRESSBAR/SLIDER row-col gap mirror (Δ4)",
    file: "implicitStyles",
    pattern: /PROGRESSBAR_ROW_GAP|PROGRESSBAR_COL_GAP|SLIDER_ROW_GAP/,
    baseline: 6,
    killPhase: "Phase 3",
  },
  {
    label: "TAG_SPEC_MAP 직독 (specPresetResolver)",
    file: "specPresetResolver",
    pattern: /TAG_SPEC_MAP/,
    baseline: 3,
    killPhase: "Phase 4",
  },
];

describe("ADR-912 collapse grep gate — dispersion baseline 단조 감소", () => {
  for (const entry of DISPERSION_BASELINE) {
    it(`${entry.label} ≤ baseline ${entry.baseline} (${entry.killPhase} 에서 0 목표)`, () => {
      const text = read(FILES[entry.file]);
      const count = countMatches(text, entry.pattern);
      // baseline 초과 = 재도입 regression. baseline 미만 = collapse 진행 중(정상, baseline 갱신 권장).
      expect(count).toBeLessThanOrEqual(entry.baseline);
    });
  }
});

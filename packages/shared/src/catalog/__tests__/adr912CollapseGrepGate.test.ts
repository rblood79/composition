/**
 * @fileoverview ADR-912 catalog SSOT collapse — Phase 0 grep guard (재도입 금지 + baseline 단조 감소).
 *
 * breakdown(`docs/adr/design/912-catalog-ssot-collapse-breakdown.md`) §3 Phase 0 / §5 kill criteria.
 * collapse 가 닫으려는 dispersion source 8종의 현재 occurrence 를 baseline 으로 고정한다.
 *
 * **두 가지 가드**:
 *   1. 의존 방향 (Δ1/Δ7): 새 shared resolver 가 `@composition/specs` 를 import 하는 것은
 *      `shared → specs` **정상 방향**이라 허용된다. 단 Δ7 으로 layout token table 을 specs 단일
 *      source 로 이전하면서 추가된 `LAYOUT_TOKEN_STYLES` import **1건으로만 한정**한다(다른 specs
 *      심볼을 끌어와 의존 표면을 늘리지 않게). 금지되는 방향은 `specs → shared` 이며, 그 방향은
 *      이미 0(specs deps = colord 만)이고 본 작업도 만들지 않는다.
 *   2. baseline 단조 감소: 8 dispersion 패턴의 occurrence 가 baseline 을 **초과하면 regression**
 *      (실패). collapse phase(2·3·4) 진행 시 baseline 을 낮춰 0 으로 수렴. 0 도달 = §5 kill 통과.
 *
 * baseline 측정 시점: Phase 1 land (2026-06-19). STRUCTURE_META(generate-css) / mirror·base-axis
 * (implicitStyles) / TAG_SPEC_MAP(specPresetResolver) 가 아직 전부 live 인 상태.
 *
 * 정밀화 메모: §5 kill 의 dispersion 패턴은 코드 정의뿐 아니라 주석 내 문자열도 매칭한다. kill
 * 대상 심볼(COMPOSITION_LAYOUT_STYLES 등)을 0 으로 만들 때 주석에서도 해당 심볼명을 직접 쓰지
 * 않는다(주석 false positive 가 가드 자기-위반). import 가드는 `from ['"]@composition/specs`
 * import 문만 검사한다.
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

describe("ADR-912 collapse grep gate — 의존 방향 (Δ1/Δ7)", () => {
  it("새 resolver 의 @composition/specs import 는 Δ7 layout token 1건으로 한정 (정상 방향)", () => {
    const text = read(FILES.newResolver);
    // shared → specs 는 정상 방향. Δ7 으로 LAYOUT_TOKEN_STYLES 단일 source 를 import 하므로 1건.
    // 다른 specs 심볼을 끌어와 의존 표면을 늘리면 regression.
    const importLines = text
      .split("\n")
      .filter((l) => /from\s+['"]@composition\/specs/.test(l));
    expect(importLines.length).toBe(1);
    expect(importLines[0]).toContain("LAYOUT_TOKEN_STYLES");
  });

  it("금지 방향 specs → shared 는 0 (specs 가 shared 를 import 하지 않음)", () => {
    // specs renderers/layoutTokens 가 shared 를 import 하면 순환. 단일 source 가 framework-free
    // 하위 레이어에 사는지 검증.
    const layoutTokens = read("packages/specs/src/renderers/layoutTokens.ts");
    const cssGen = read(FILES.cssGenerator);
    expect(countMatches(layoutTokens, /from\s+['"]@composition\/shared/)).toBe(
      0,
    );
    expect(countMatches(cssGen, /from\s+['"]@composition\/shared/)).toBe(0);
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
    // Phase 2 완료 (2026-06-19): STRUCTURE_META_ENTRIES 삭제 → 0. 재도입 가드로 baseline 0 고정.
    label:
      "STRUCTURE_META_ENTRIES (generator-local structure SSOT) — Phase 2 삭제",
    file: "generateCss",
    pattern: /STRUCTURE_META_ENTRIES/,
    baseline: 0,
    killPhase: "Phase 2 ✅",
  },
  {
    // Phase 3 Δ7 완료 (2026-06-19): layout token table 을 specs `layoutTokens.ts` 단일 source 로
    //   이전(CSSGenerator + shared resolver 공용). generator-private 정의 삭제 → 0. 주석에서도 심볼명
    //   직접 사용 안 함(false positive 회피). 재도입 가드로 baseline 0 고정. byte-diff 0 검증 완료.
    label: "COMPOSITION_LAYOUT_STYLES (generator-private layout table, Δ7)",
    file: "cssGenerator",
    pattern: /COMPOSITION_LAYOUT_STYLES/,
    baseline: 0,
    killPhase: "Phase 3 Δ7 ✅",
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
    // Phase 3-A-1 완료 (2026-06-19): Track 3종 height 를 specSizeField read-through 로 이관 +
    //   상수 삭제 → 0 (주석에서도 심볼명 제거, false positive 회피). byte-diff 0 검증 완료. 재도입 가드.
    label: "VALUE_FILL_TRACK_HEIGHT mirror (Δ4 — Phase 3-A-1 삭제 ✅)",
    file: "implicitStyles",
    pattern: /VALUE_FILL_TRACK_HEIGHT/,
    baseline: 0,
    killPhase: "Phase 3-A-1 ✅",
  },
  {
    // INDICATOR_SIZES = {box, gap} 한 객체. gap 은 Checkbox/Radio .sizes.gap byte 일치(Δ4 교체),
    //   box 는 catalog source 부재(ComponentRuleSize 에 box 키 없음) → 0 도달은 schema 보강(Δ5-a:
    //   ComponentRuleSize.box 추가 + 승격) 선택 시에만. Non-goal(Δ5-b) 선택 시 잔존 정당. baseline 유지.
    label:
      "INDICATOR_SIZES mirror (Δ4 gap 교체 / Δ5 box 소유권 — schema 보강 의존)",
    file: "implicitStyles",
    pattern: /INDICATOR_SIZES/,
    baseline: 5,
    killPhase: "Phase 3-A-2 (Δ5-a 선택 시 0)",
  },
  {
    // Phase 3-A-1 완료 (2026-06-19): row-gap 2종(progressbar/slider) 을 specSizeField("...", size,
    //   "gap") read-through 로 이관 + 상수 삭제. 잔존 3 = PROGRESSBAR_COL_GAP (정의 1 + 소비처 1 +
    //   주석 1) — catalog .sizes 부재(structure.composition 토큰 문자열)라 Δ10(.sizes.columnGap
    //   마이그레이션) 선택 시에만 0. Non-goal(Δ10-B) 선택 시 잔존 정당. baseline 6→3 (단조 감소).
    label:
      "PROGRESSBAR_COL_GAP mirror (Δ10 — row-gap 2종 Phase 3-A-1 삭제 ✅, COL 잔존)",
    file: "implicitStyles",
    pattern: /PROGRESSBAR_ROW_GAP|PROGRESSBAR_COL_GAP|SLIDER_ROW_GAP/,
    baseline: 3,
    killPhase: "Phase 3-A-2 (Δ10-A 선택 시 0)",
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

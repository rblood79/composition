import { describe, expect, it } from "vitest";

import {
  isCatalogSkiaCutover,
  getComponentRulesTable,
} from "@composition/shared";
import { resolveComponentVisual } from "@composition/specs";
import { getSpecForTag } from "../sprites/tagSpecMap";
import {
  resolveSkiaVisualRule,
  resolveSkiaRule,
  ruleSizeToSizeSpec,
} from "./resolveSkiaVisualRule";

/**
 * ADR-912 1A-(a) — 방향 반전: rule 테이블이 **정본**, spec 이 그것을 추종하는지 검증 (drift 검출).
 *
 * **위상 전환 (2026-06-03)**: ADR-142 시절 본 test 는 "rule(table)이 spec(정본)과 동일한가" 였다.
 * ADR-912 ②-6-A 로 `componentRulesTable.ts` 가 직접 정본으로 승격되면서, 검증 방향이 뒤집힌다 —
 * 이제 **table 이 기준(정본), spec 은 table 을 추종해야 하는 검증 대상**이다. assert 는 동일성(toEqual)
 * 이지만 의미는 "정본 table 을 손 편집했을 때 아직 살아있는 spec 이 그 변경을 따라왔는지(drift 검출)".
 * **단계 5(spec 124 물리 삭제) 시 본 test 도 함께 제거** — spec 이 사라지면 추종 대상이 없어 검증 무의미.
 * 그때까지는 전환기 drift guardrail(정본 변경이 spec 과 갈라지면 의도적 drift 임을 가시화). TokenRef
 * (`{color.X}`)는 양쪽 모두 string — runtime resolveToken 이 dark mode 반전 처리.
 */
/**
 * ADR-912 전환기 의도적 drift allowlist (선행-6, 2026-06-04).
 *
 * rule 테이블이 정본으로 승격되며 **rule 에만 존재하는 신규 채널**(spec.variants 가 구조상
 * 가지지 못하는 D3 필드)을 추가했다 — TEXT_LEAF/Label 의 textWeight·fontFamily(위험군 해소
 * catalog 등록), Track 의 fillBar(value-fill escape). spec→visual(추종)은 이 채널을 못 따라오므로
 * **의도적 drift**(spec 은 곧 단계 5 에서 삭제될 폐기 대상). 곧 삭제될 spec 에 정본 데이터를
 * 역주입하면 dual-SSOT 부활 + ADR-912 방향 역행이므로, 해당 type/channel 만 drift 비교에서 제외한다.
 *
 * **유지 의무**: rule-only 신규 채널만 entry. fill/색상/기타 채널 drift 는 계속 검출(guardrail 보존).
 * 단계 5(spec 124 삭제) 시 본 allowlist + 전체 drift describe 동시 제거(추종 대상 소멸).
 */
const ALLOW_RULE_CANONICAL_DRIFT: Record<string, readonly string[]> = {
  // TEXT_LEAF/Label catalog 등록 — rule variants.default.textWeight 신규 정본 (spec render.shapes
  //   기본값과 동일하나 spec.variants 엔 없어 spec→visual undefined).
  Text: ["textWeight"],
  Heading: ["textWeight"],
  Paragraph: ["textWeight"],
  Code: ["textWeight", "fontFamily"],
  Kbd: ["textWeight", "fontFamily"],
  Label: ["textWeight"],
  // Description catalog 등록(선행-6) — rule variants.default.textWeight=400 신규 정본 (spec
  //   render.shapes 런타임 기본값 400 과 동일하나 spec.variants 엔 필드 없어 spec→visual undefined).
  Description: ["textWeight"],
  // FieldError catalog 등록(선행-6) — rule variants.default.textWeight=400 신규 정본 (spec
  //   render.shapes 런타임 기본값 400(FieldError.spec.ts:106-111) 과 동일하나 spec.variants 엔 필드
  //   없어 spec→visual undefined). height 0 정본화(spec 14/16/20 → 0)는 size 채널이라 별도 처리 불요
  //   — drift 비교는 variant visual 대상(size 미포함).
  FieldError: ["textWeight"],
  // value-fill escape (선행-2) — rule fillBar 신규 정본 (spec 미보유) + Track 배경 fill 정본 이전:
  //   선행-2 가 rule fill.base 를 {color.neutral-subtle}(보이는 회색 트랙) 로 정본화하고 그 위에
  //   fillBar(value_fill escape) 를 덧그린다. spec fill.base 는 {color.transparent}(구버전 폐기 대상)
  //   → 의도적 drift. fill 전체가 rule 로 이전됐으므로 fill 채널도 allowlist (spec 폐기 예정).
  ProgressBarTrack: ["fillBar", "fill"],
  MeterTrack: ["fillBar", "fill"],
};

/** allowlist 채널을 양쪽 visual 에서 제거(의도적 drift 무시) 후 비교. */
function stripAllowedDrift(
  visual: Record<string, unknown> | undefined,
  type: string,
): Record<string, unknown> | undefined {
  if (!visual) return visual;
  const allowed = ALLOW_RULE_CANONICAL_DRIFT[type];
  if (!allowed || allowed.length === 0) return visual;
  const out = { ...visual };
  for (const ch of allowed) delete out[ch];
  return out;
}

describe("resolveSkiaVisualRule — table(정본) ← spec(추종) drift 검출 (ADR-912 1A-(a))", () => {
  const rulesTable = getComponentRulesTable();
  // catalog Skia cutover 된 type 만 generic 렌더 경로 → drift 검출 대상.
  const cutoverTypes = Object.keys(rulesTable).filter(isCatalogSkiaCutover);

  it("검출 대상 type 이 1개 이상 존재 (게이트 sanity)", () => {
    expect(cutoverTypes.length).toBeGreaterThan(0);
  });

  for (const type of cutoverTypes) {
    const spec = getSpecForTag(type);
    if (!spec || !spec.variants) continue;
    const variantNames = Object.keys(spec.variants);

    for (const variantName of variantNames) {
      it(`${type}/${variantName} — spec→visual 이 정본 table→visual 을 추종`, () => {
        const fromRuleCanonical = resolveSkiaVisualRule(type, variantName); // 정본(table)
        const fromSpecFollower = resolveComponentVisual(spec, variantName); // 추종(spec)
        // 정본을 기준으로 spec 이 일치하는지 — 불일치 = spec 이 정본 table 을 안 따라옴(의도적 drift 가시화).
        // ADR-912 전환기: rule-only 신규 채널(textWeight/fontFamily/fillBar)은 의도적 drift 로
        //   allowlist 제외(spec 폐기 예정, 역주입 금지). 나머지 채널은 계속 검출(guardrail 보존).
        expect(
          stripAllowedDrift(
            fromSpecFollower as Record<string, unknown> | undefined,
            type,
          ),
        ).toEqual(
          stripAllowedDrift(
            fromRuleCanonical as Record<string, unknown> | undefined,
            type,
          ),
        );
      });
    }

    it(`${type} — spec.defaultVariant 가 정본 table.defaultVariant 를 추종`, () => {
      const rule = resolveSkiaRule(type); // 정본
      expect(spec.defaultVariant).toBe(rule?.defaultVariant);
    });
  }
});

/**
 * ADR-912 1C — Button size source seam 제거 증명.
 *
 * Button(catalog Skia cutover)의 size 시각값이 **theme rule table(정본)**에서 나오고,
 * ButtonSpec.sizes 를 거치지 않아도 완전한지(paddingX 포함) 검증한다. dispatch
 * (buildSpecNodeData)가 catalog cutover type 에 대해 `resolveSkiaRule(type).sizes[size]`
 * → `ruleSizeToSizeSpec` 으로 sizeSpec 을 구성하므로, 본 검증이 통과하면 Button 이
 * ButtonSpec.sizes 없이 동작함(seam 실제 제거)이 구조적으로 증명된다.
 */
describe("resolveSkiaRule — Button size source = theme rule table (ADR-912 1C seam 제거)", () => {
  it("Button 은 catalog Skia cutover (table size 경로 진입 조건)", () => {
    expect(isCatalogSkiaCutover("Button")).toBe(true);
  });

  it("table Button size 가 paddingX 를 포함 (1C 이전 완료 — leaf 텍스트 inset base)", () => {
    const rule = resolveSkiaRule("Button");
    expect(rule).toBeDefined();
    // 5 size 전부 paddingX 존재 (spec.sizes 4/8/12/16/24 이전).
    const expected: Record<string, number> = {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
    };
    for (const [size, px] of Object.entries(expected)) {
      expect(rule?.sizes[size]?.paddingX).toBe(px);
    }
  });

  it("table size → SizeSpec 투영(ruleSizeToSizeSpec)이 시각 필드 보존", () => {
    const rule = resolveSkiaRule("Button");
    const md = rule?.sizes["md"];
    expect(md).toBeDefined();
    const projected = ruleSizeToSizeSpec(md!);
    // buildCatalogShapes 가 소비하는 size 필드 전부 — table 값 그대로 통과.
    expect(projected.fontSize).toBe("{typography.text-sm}");
    expect(projected.borderRadius).toBe("{radius.md}");
    expect(projected.borderWidth).toBe(1);
    expect(projected.paddingX).toBe(12);
  });

  it("table Button size 가 spec.sizes(추종)와 시각 일치 — drift 0 (단계 5 전 guardrail)", () => {
    const rule = resolveSkiaRule("Button");
    const spec = getSpecForTag("Button");
    if (!spec?.sizes) return;
    for (const size of ["xs", "sm", "md", "lg", "xl"]) {
      const t = rule?.sizes[size];
      const s = spec.sizes[size] as unknown as
        | Record<string, unknown>
        | undefined;
      if (!t || !s) continue;
      // 정본(table) 기준 — spec 이 따라오는지. fontSize/borderRadius/paddingX 핵심 시각값.
      expect(t.fontSize).toBe(s.fontSize);
      expect(t.borderRadius).toBe(s.borderRadius);
      expect(t.paddingX).toBe(s.paddingX);
    }
  });
});

describe("resolveSkiaVisualRule — TokenRef 문자열 보존 (dark mode 반전 runtime 위임)", () => {
  it("adaptive 토큰(`{color.base}` 등)이 변환 없이 string 그대로 전달된다", () => {
    // Badge accent variant 의 fill base 는 TokenRef — resolve(실수값 변환)는 runtime 책임.
    const visual = resolveSkiaVisualRule("Button", "primary");
    const base = visual?.fill?.default.base;
    expect(typeof base).toBe("string");
    // `{color.X}` 형태 보존 (resolveToken 이 light/dark 분기) — 미리 hex 로 변환되면 안 됨.
    if (base) expect(base.startsWith("{")).toBe(true);
  });
});

/**
 * ADR-916 P2-CAT ② L0 — primitive ↔ CSS typography parity (독립 권위 leg).
 *
 * 반대심문 C3(oracle 순환) 봉합: catalog 정적 스냅샷은 `resolveToken`(=primitive
 * typography.ts)으로 fontSize/lineHeight 를 숫자화한다. 그 값이 CSS Preview 가
 * 쓰는 `--text-*`(shared-tokens.css)와 발산하면 CSS↔Skia 시각 발산(D3 위반)이지만,
 * 양변이 같은 resolveToken 을 쓰면 shared-fault 로 발산을 못 잡는다.
 *
 * L0 은 CSS 파일 **텍스트를 직접 파싱**(resolveToken 미경유)해 독립 권위로 삼는다:
 *  - `--text-sm: 0.875rem` → 0.875 × 16 = 14px
 *  - `--text-sm--line-height: calc(1.25 / 0.875)` → 배율 1.4286 × 14px = 20px
 *
 * 이 leg 가 정합을 통과시키면서(positive) 인위적 발산을 실제로 RED 로 잡으면
 * (negative fixture) oracle 이 작동함이 증명된다.
 *
 * 순수 검증 — live 영향 0.
 *
 * ADR-295 (2026-10-30): parity 의 독립 권위를 `shared-tokens.css` (이제 빌더 chrome 의 정적 값) 에서
 * S2 설치본 computed (`adr295-s2-oracle.json`) 로 옮겼다. CSS 파서 · 변환 단위 검증은 그대로 둔다.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, it, expect } from "vitest";

import {
  s2FontSize,
  typography,
  TYPOGRAPHY_STEPS,
} from "../../../primitives/typography";
import {
  parseCssTypographyTokens,
  cssFontSizeToPx,
  cssLineHeightToPx,
  KNOWN_TYPOGRAPHY_DIVERGENCES,
} from "../typographyCssParity";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHARED_TOKENS_CSS = resolve(
  __dirname,
  "../../../../../shared/src/components/styles/theme/shared-tokens.css",
);

// ── rem/calc → px 변환 단위 검증 ──────────────────────────────────────────────

describe("ADR-916 P2-CAT ② L0 — CSS 값 → px 변환", () => {
  it("rem fontSize 를 px 로 변환한다 (root 16px)", () => {
    expect(cssFontSizeToPx("0.875rem")).toBe(14);
    expect(cssFontSizeToPx("1rem")).toBe(16);
    expect(cssFontSizeToPx("1.125rem")).toBe(18);
    expect(cssFontSizeToPx("0.625rem")).toBe(10);
  });

  it("calc(a / b) line-height 배율 × fontSize 를 px 로 변환한다", () => {
    // text-sm: calc(1.25 / 0.875) 배율 × 14px = 20px
    expect(cssLineHeightToPx("calc(1.25 / 0.875)", 14)).toBe(20);
    // text-base: calc(1.5 / 1) 배율 × 16px = 24px
    expect(cssLineHeightToPx("calc(1.5 / 1)", 16)).toBe(24);
  });
});

// ── L0 parity — primitive ↔ S2 설치본 (독립 oracle) ─────────────────────────────
//
// ADR-295 (2026-10-30): `shared-tokens.css` 의 `--text-*` 는 빌더 chrome 의 정적 값이고 (Decision 8),
// 사용자 컴포넌트의 DOM leg 는 resolver `cssVars` (primitive 와 같은 맵) 를 읽는다. 그래서 primitive 를
// chrome CSS 와 비교하지 않는다 — 독립 권위는 S2 1.8.1 설치본을 브라우저에서 잰 값
// (`adr295-s2-token-extract.mjs` → `adr295-s2-oracle.json` `tokens.fontTable`, desktop · base 14).
// primitive 는 단계 표 + 식이라 같은 식을 쓰면 shared-fault 이므로, oracle 은 식이 아니라 computed 다.

const ORACLE = resolve(
  __dirname,
  "../../../../../../apps/builder/src/builder/catalogRuntime/__tests__/fixtures/adr295-s2-oracle.json",
);
type OracleRow = {
  step: number;
  desktop: { fontSize: number; lineHeight: number };
};
const oracleByStep = (() => {
  const table = (
    JSON.parse(readFileSync(ORACLE, "utf8")) as {
      tokens: { fontTable: Record<string, OracleRow> };
    }
  ).tokens.fontTable;
  const byStep = new Map<number, OracleRow["desktop"]>();
  for (const row of Object.values(table)) byStep.set(row.step, row.desktop);
  return byStep;
})();

describe("ADR-295 L0 — primitive typography == S2 설치본 computed (desktop)", () => {
  it("모든 단계가 oracle 에 있다", () => {
    for (const [name, step] of Object.entries(TYPOGRAPHY_STEPS))
      expect(oracleByStep.has(step), `${name} 단계 ${step}`).toBe(true);
  });

  it("fontSize 전수 정합 · line-height 는 제목 묶음만 (본문은 Phase 3 에서 식 — 사용자 결정 2026-10-30)", () => {
    for (const [name, step] of Object.entries(TYPOGRAPHY_STEPS)) {
      const oracle = oracleByStep.get(step)!;
      expect(typography[name as keyof typeof typography], name).toBe(
        oracle.fontSize,
      );
      if (!name.startsWith("text-heading-")) continue;
      expect(
        typography[`${name}--line-height` as keyof typeof typography],
        `${name}--line-height`,
      ).toBe(oracle.lineHeight);
    }
  });

  it("ledger 는 비어 있다 — primitive 와 chrome CSS 는 비교하지 않는다", () => {
    expect(KNOWN_TYPOGRAPHY_DIVERGENCES.size).toBe(0);
  });
});

// ── negative fixture — oracle 이 발산을 실제로 잡는지 증명 ──────────────────────

describe("ADR-295 L0 — negative fixture (oracle 작동 증명)", () => {
  it("한 단계 어긋난 값은 oracle 대조에서 발산으로 검출된다", () => {
    // text-sm (단계 0) 자리에 단계 1 의 값을 넣으면 oracle 과 다르다.
    const tampered = s2FontSize(1);
    expect(tampered).not.toBe(oracleByStep.get(0)!.fontSize);
  });

  it("옛 고정 행간 (14px → 20) 은 oracle (18) 과 다르다", () => {
    expect(oracleByStep.get(0)!.lineHeight).toBe(18);
    expect(cssLineHeightToPx("calc(1.25 / 0.875)", 14)).not.toBe(
      oracleByStep.get(0)!.lineHeight,
    );
  });

  it("CSS 파서는 그대로 동작한다 (chrome CSS 파싱 — 비교 대상 아님)", () => {
    const parsed = parseCssTypographyTokens(
      readFileSync(SHARED_TOKENS_CSS, "utf8"),
    );
    expect(parsed.fontSize.get("text-sm")).toBe(14);
  });
});

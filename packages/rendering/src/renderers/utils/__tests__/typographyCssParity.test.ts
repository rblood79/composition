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
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, it, expect } from "vitest";

import { typography } from "../../../primitives/typography";
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

// ── L0 parity (positive) — primitive ↔ CSS 정합 ───────────────────────────────

describe("ADR-916 P2-CAT ② L0 — primitive ↔ CSS typography parity", () => {
  const css = readFileSync(SHARED_TOKENS_CSS, "utf8");
  const cssTokens = parseCssTypographyTokens(css);

  it("CSS 에서 --text-* fontSize 를 파싱한다", () => {
    expect(cssTokens.fontSize.get("text-sm")).toBe(14);
    expect(cssTokens.fontSize.get("text-base")).toBe(16);
  });

  it("CSS 에서 --text-*--line-height 를 fontSize pairing 으로 px 화한다", () => {
    expect(cssTokens.lineHeight.get("text-sm")).toBe(20);
    expect(cssTokens.lineHeight.get("text-base")).toBe(24);
  });

  it("primitive typography fontSize == CSS --text-* (전수 정합, ledger 밖)", () => {
    for (const [name, px] of cssTokens.fontSize) {
      if (KNOWN_TYPOGRAPHY_DIVERGENCES.has(`${name}:fontSize`)) continue;
      const primitivePx = typography[name as keyof typeof typography];
      expect(primitivePx, `신규 fontSize 발산: ${name}`).toBe(px);
    }
  });

  it("primitive typography line-height == CSS --text-*--line-height px (전수 정합, ledger 밖)", () => {
    for (const [name, px] of cssTokens.lineHeight) {
      if (KNOWN_TYPOGRAPHY_DIVERGENCES.has(`${name}:lineHeight`)) continue;
      const key = `${name}--line-height` as keyof typeof typography;
      const primitivePx = typography[key];
      expect(primitivePx, `신규 lineHeight 발산: ${name}`).toBe(px);
    }
  });

  it("ledger 에 등록된 발산은 실제로 primitive≠CSS 다 (침묵 skip 아님 — 양값 검증)", () => {
    // ledger 가 stale(이미 정합인데 등록만 남음)해지지 않도록, 등록된 발산이
    // 실제로 존재하는지 CSS 파싱값·primitive 로 재확인.
    for (const [key, entry] of KNOWN_TYPOGRAPHY_DIVERGENCES) {
      const [name, channel] = key.split(":");
      const cssPx =
        channel === "lineHeight"
          ? cssTokens.lineHeight.get(name)
          : cssTokens.fontSize.get(name);
      const primKey = channel === "lineHeight" ? `${name}--line-height` : name;
      const primitivePx = typography[primKey as keyof typeof typography];
      expect(cssPx, `ledger ${key}: CSS 값이 파싱되어야`).toBe(entry.css);
      expect(primitivePx, `ledger ${key}: primitive 값 일치`).toBe(
        entry.primitive,
      );
      expect(primitivePx, `ledger ${key}: 여전히 발산 상태여야`).not.toBe(
        cssPx,
      );
    }
  });
});

// ── negative fixture — oracle 이 발산을 실제로 잡는지 증명 ──────────────────────

describe("ADR-916 P2-CAT ② L0 — negative fixture (oracle 작동 증명)", () => {
  it("변조된 CSS 값은 parity 대조에서 발산으로 검출된다", () => {
    // 인위적 발산: --text-sm 을 0.875rem(14px) → 1rem(16px) 으로 변조.
    const tampered = `:root {
      --text-sm: 1rem;
      --text-sm--line-height: calc(1.25 / 0.875);
    }`;
    const parsed = parseCssTypographyTokens(tampered);
    // 변조 CSS = 16px, primitive text-sm = 14px → 발산.
    expect(parsed.fontSize.get("text-sm")).toBe(16);
    expect(typography["text-sm"]).toBe(14);
    expect(parsed.fontSize.get("text-sm")).not.toBe(typography["text-sm"]);
  });

  it("변조된 line-height calc 배율도 발산으로 검출된다", () => {
    // --text-base--line-height 를 calc(1.5/1)=24px → calc(2/1)=32px 으로 변조.
    const tampered = `:root {
      --text-base: 1rem;
      --text-base--line-height: calc(2 / 1);
    }`;
    const parsed = parseCssTypographyTokens(tampered);
    expect(parsed.lineHeight.get("text-base")).toBe(32);
    expect(typography["text-base--line-height"]).toBe(24);
    expect(parsed.lineHeight.get("text-base")).not.toBe(
      typography["text-base--line-height"],
    );
  });
});

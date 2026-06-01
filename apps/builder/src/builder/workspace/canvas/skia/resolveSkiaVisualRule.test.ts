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
} from "./resolveSkiaVisualRule";

/**
 * ADR-142 G2(b) B — rule 테이블 기반 시각 해소(resolveSkiaVisualRule)가 spec 기반
 * (resolveComponentVisual)과 **동일 ComponentVisualRule** 을 내는지 parity 검증 (RB1 HIGH).
 *
 * Skia generic 렌더러(buildCatalogShapes)는 더 이상 spec 을 안 읽고 rule 테이블만 소비한다(#8).
 * 따라서 rule→visual 변환이 기존 spec→visual 과 byte-동일해야 시각 회귀 0 이 보장된다.
 * TokenRef(`{color.X}`)는 양쪽 모두 string 그대로 — runtime resolveToken 이 dark mode 반전 처리.
 */
describe("resolveSkiaVisualRule — rule↔spec parity (RB1)", () => {
  const rulesTable = getComponentRulesTable();
  // catalog Skia cutover 된 type 만 generic 렌더 경로 → parity 대상.
  const cutoverTypes = Object.keys(rulesTable).filter(isCatalogSkiaCutover);

  it("parity 대상 type 이 1개 이상 존재 (게이트 sanity)", () => {
    expect(cutoverTypes.length).toBeGreaterThan(0);
  });

  for (const type of cutoverTypes) {
    const spec = getSpecForTag(type);
    if (!spec || !spec.variants) continue;
    const variantNames = Object.keys(spec.variants);

    for (const variantName of variantNames) {
      it(`${type}/${variantName} — rule→visual ≡ spec→visual`, () => {
        const fromRule = resolveSkiaVisualRule(type, variantName);
        const fromSpec = resolveComponentVisual(spec, variantName);
        expect(fromRule).toEqual(fromSpec);
      });
    }

    it(`${type} — defaultVariant(rule) ≡ spec.defaultVariant`, () => {
      const rule = resolveSkiaRule(type);
      expect(rule?.defaultVariant).toBe(spec.defaultVariant);
    });
  }
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

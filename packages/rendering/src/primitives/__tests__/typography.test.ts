/**
 * ADR-916 P2-CAT ② R10 — typography SSOT line-height 회귀 앵커.
 *
 * primitive typography.ts 는 Skia 경로(resolveToken / getLabelLineHeight)와 CSS
 * 생성 경로(tokenToCSSVar → var(--text-*--line-height))가 **공유하는 단일 SSOT**다.
 * text-xl--line-height 가 CSS 정본(shared-tokens.css `calc(1.75 / 1.25) × 20 = 28`)과
 * 발산하면 D3 시각 대칭(CSS Preview ↔ Skia Builder) 위반. 본 앵커는 R10 실수정
 * (30 → 28) 이 30 으로 되돌아가는 회귀를 primitive 소비 지점에서 직접 잡는다.
 *
 * (전수 CSS↔primitive 정합은 typographyCssParity.test.ts L0 가 담당 — 본 파일은
 * getLabelLineHeight 소비 계약 + 대표값 golden 앵커.)
 */
import { describe, it, expect } from "vitest";

import { typography, getLabelLineHeight } from "../typography";

describe("ADR-916 R10 — typography line-height SSOT", () => {
  it("text-xl--line-height 는 CSS 정본 28 (calc(1.75/1.25)×20), 30 아님", () => {
    // R10 실수정: primitive 주석 '20 × 1.5 = 30' 은 CSS calc 패턴 미준수 버그였음.
    // CSS shared-tokens.css --text-xl--line-height: calc(1.75 / 1.25) = 1.4 → 20 × 1.4 = 28.
    expect(typography["text-xl--line-height"]).toBe(28);
  });

  it("전 line-height 토큰이 CSS calc(배율) × fontSize 결과와 정합", () => {
    // fontSize → 기대 line-height(px) golden (shared-tokens.css calc 유도).
    const GOLDEN: Record<string, number> = {
      "text-2xs--line-height": 16, // calc(1 / 0.625) × 10
      "text-xs--line-height": 16, // calc(1 / 0.75) × 12
      "text-sm--line-height": 20, // calc(1.25 / 0.875) × 14
      "text-base--line-height": 24, // calc(1.5 / 1) × 16
      "text-lg--line-height": 28, // calc(1.75 / 1.125) × 18
      "text-xl--line-height": 28, // calc(1.75 / 1.25) × 20  ← R10
      "text-2xl--line-height": 32, // calc(2 / 1.5) × 24
      "text-3xl--line-height": 36, // calc(2.25 / 1.875) × 30
      "text-4xl--line-height": 40, // calc(2.5 / 2.25) × 36
      "text-5xl--line-height": 48, // calc(3 / 3) × 48
    };
    for (const [key, expected] of Object.entries(GOLDEN)) {
      expect(typography[key as keyof typeof typography], key).toBe(expected);
    }
  });

  it("getLabelLineHeight(20) 은 text-xl SSOT(28) 를 반환한다 (Skia 소비 계약)", () => {
    // specShapeConverter.ts:703 defaultLineHeight = getLabelLineHeight(fontSize)
    expect(getLabelLineHeight(20)).toBe(28);
    expect(getLabelLineHeight(18)).toBe(28); // text-lg
    expect(getLabelLineHeight(16)).toBe(24); // text-base
  });

  it("getLabelLineHeight 는 미매핑 fontSize 에 1.5배 fallback", () => {
    expect(getLabelLineHeight(13)).toBe(Math.ceil(13 * 1.5));
  });
});

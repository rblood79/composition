/**
 * @fileoverview ADR-143 Phase 3 — 토큰 델타 저장 / merge 테스트.
 *
 * Gate G2 검증:
 * - `buildTokensSnapshot`: spec-token override 델타 + user-defined 만 추출
 * - `mergeTokensSnapshot`: `primitives/` seed + 문서 델타 → 완전 복원
 * - build → merge round-trip 무손실
 * - 미커스터마이즈 프로젝트 `tokens` 필드 ≤ 5KB (ADR-143 Hard Constraint 3)
 */

import { describe, expect, it } from "vitest";
import {
  buildTokensSnapshot,
  mergeTokensSnapshot,
  snapshotTokensFromResolved,
  type ResolvedTokenMap,
} from "../variablesAdapter";

const SEED: ResolvedTokenMap = {
  "color.accent": "#0070f3",
  "color.base": "#ffffff",
  "spacing.md": 16,
  "radius.sm": 4,
  "feature.darkMode": false,
};

// ─────────────────────────────────────────────
// buildTokensSnapshot — 델타 추출
// ─────────────────────────────────────────────
describe("buildTokensSnapshot (ADR-143 Phase 3)", () => {
  it("TC-D1: seed 와 동일한 resolved → 빈 델타 (미커스터마이즈)", () => {
    const delta = buildTokensSnapshot({
      resolvedTokens: { ...SEED },
      seedTokens: SEED,
    });
    expect(Object.keys(delta)).toHaveLength(0);
  });

  it("TC-D2: spec-token override → 변경된 키만 source=spec-token 으로", () => {
    const delta = buildTokensSnapshot({
      resolvedTokens: { ...SEED, "color.accent": "#ff0000" },
      seedTokens: SEED,
    });
    expect(Object.keys(delta)).toEqual(["color.accent"]);
    expect(delta["color.accent"]).toEqual({
      type: "color",
      value: "#ff0000",
      source: "spec-token",
    });
  });

  it("TC-D3: user-defined token → source=user-defined, seed 무관 항상 저장", () => {
    const delta = buildTokensSnapshot({
      resolvedTokens: { ...SEED },
      seedTokens: SEED,
      userDefinedTokens: {
        "brand.primary": { type: "color", value: "#abcdef" },
      },
    });
    expect(delta["brand.primary"]).toEqual({
      type: "color",
      value: "#abcdef",
      source: "user-defined",
    });
  });

  it("TC-D4: override + user-defined 혼합 델타", () => {
    const delta = buildTokensSnapshot({
      resolvedTokens: { ...SEED, "spacing.md": 24 },
      seedTokens: SEED,
      userDefinedTokens: { "brand.x": { type: "number", value: 99 } },
    });
    expect(delta["spacing.md"].source).toBe("spec-token");
    expect(delta["spacing.md"].value).toBe(24);
    expect(delta["brand.x"].source).toBe("user-defined");
    expect(delta["brand.x"].value).toBe(99);
  });

  it("TC-D5: number / boolean override 도 정확히 델타 판정", () => {
    const delta = buildTokensSnapshot({
      resolvedTokens: { ...SEED, "feature.darkMode": true, "radius.sm": 4 },
      seedTokens: SEED,
    });
    // feature.darkMode: false→true → 델타. radius.sm: 4→4 → 동일, 제외
    expect(Object.keys(delta)).toEqual(["feature.darkMode"]);
    expect(delta["feature.darkMode"]).toEqual({
      type: "boolean",
      value: true,
      source: "spec-token",
    });
  });
});

// ─────────────────────────────────────────────
// mergeTokensSnapshot — seed + 델타 복원
// ─────────────────────────────────────────────
describe("mergeTokensSnapshot (ADR-143 Phase 3)", () => {
  it("TC-D6: seed + undefined 델타 → seed 전체 복원", () => {
    const merged = mergeTokensSnapshot(SEED, undefined);
    expect(Object.keys(merged).sort()).toEqual(Object.keys(SEED).sort());
    expect(merged["color.accent"].value).toBe("#0070f3");
    expect(merged["color.accent"].source).toBe("spec-token");
  });

  it("TC-D7: seed + 빈 델타 → seed 전체", () => {
    const merged = mergeTokensSnapshot(SEED, {});
    expect(Object.keys(merged)).toHaveLength(Object.keys(SEED).length);
  });

  it("TC-D8: seed + override 델타 → override 반영, 미override 는 seed 유지", () => {
    const delta = buildTokensSnapshot({
      resolvedTokens: { ...SEED, "color.accent": "#ff0000" },
      seedTokens: SEED,
    });
    const merged = mergeTokensSnapshot(SEED, delta);
    expect(merged["color.accent"].value).toBe("#ff0000");
    expect(merged["color.base"].value).toBe("#ffffff");
  });

  it("TC-D9: seed + user-defined 델타 → seed + 신규 토큰", () => {
    const merged = mergeTokensSnapshot(SEED, {
      "brand.primary": {
        type: "color",
        value: "#abcdef",
        source: "user-defined",
      },
    });
    expect(merged["brand.primary"].value).toBe("#abcdef");
    expect(merged["brand.primary"].source).toBe("user-defined");
    expect(Object.keys(merged)).toHaveLength(Object.keys(SEED).length + 1);
  });
});

// ─────────────────────────────────────────────
// build → merge round-trip 무손실
// ─────────────────────────────────────────────
describe("build → merge round-trip (ADR-143 Phase 3)", () => {
  it("TC-D10: build → merge → 원본 resolved 값 무손실 복원", () => {
    const resolved: ResolvedTokenMap = {
      ...SEED,
      "color.accent": "#ff0000", // override
      "spacing.md": 24, // override
    };
    const delta = buildTokensSnapshot({
      resolvedTokens: resolved,
      seedTokens: SEED,
    });
    const merged = mergeTokensSnapshot(SEED, delta);
    for (const [key, value] of Object.entries(resolved)) {
      expect(merged[key].value).toBe(value);
    }
  });
});

// ─────────────────────────────────────────────
// Gate G2 — 미커스터마이즈 tokens ≤ 5KB (ADR-143 HC3)
// ─────────────────────────────────────────────
describe("Gate G2 — 미커스터마이즈 tokens ≤ 5KB (ADR-143 HC3)", () => {
  // 실제 spec 규모 모사: 300 토큰 seed
  const LARGE_SEED: ResolvedTokenMap = {};
  for (let i = 0; i < 300; i++) {
    LARGE_SEED[`color.t${i}`] = `#${i.toString(16).padStart(6, "0")}`;
  }

  it("TC-D11: 미커스터마이즈(resolved == seed) → 델타 빈 객체 → ≤ 5KB", () => {
    const delta = buildTokensSnapshot({
      resolvedTokens: { ...LARGE_SEED },
      seedTokens: LARGE_SEED,
    });
    const size = JSON.stringify(delta).length;
    expect(size).toBeLessThanOrEqual(5 * 1024);
    expect(Object.keys(delta)).toHaveLength(0);
  });

  it("TC-D12: 델타 저장이 전체 저장 대비 크기 절감 입증", () => {
    const full = snapshotTokensFromResolved(LARGE_SEED);
    const delta = buildTokensSnapshot({
      resolvedTokens: { ...LARGE_SEED },
      seedTokens: LARGE_SEED,
    });
    const fullSize = JSON.stringify(full).length;
    const deltaSize = JSON.stringify(delta).length;
    // 전체 저장은 5KB 초과 (300 토큰) — canonical document 비대화
    expect(fullSize).toBeGreaterThan(5 * 1024);
    // 델타 저장은 미커스터마이즈 시 사실상 0
    expect(deltaSize).toBeLessThan(fullSize);
  });
});

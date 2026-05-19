/**
 * @fileoverview ADR-110 Phase 1 — variables read-only snapshot adapter tests.
 *
 * Gate G-A 검증:
 * - `snapshotTokensFromResolved()` pure function
 * - `snapshotUserDefinedTokens()` pure function
 * - `readCanonicalTokens()` read accessor
 * - `legacyToCanonical()` + `getTokens` 연동
 * - stale snapshot 방지 (R4) 단위 테스트
 * - source 구분자 (spec-token vs user-defined) 검증 (ADR-110 R3)
 */

import { describe, expect, it } from "vitest";
import {
  snapshotTokensFromResolved,
  snapshotUserDefinedTokens,
  readCanonicalTokens,
  resolveCanonicalToken,
  type ResolvedTokenMap,
} from "../variablesAdapter";
import { legacyToCanonical } from "../index";
import { convertComponentRole } from "../componentRoleAdapter";
import { convertPageLayout } from "../slotAndLayoutAdapter";
import { resolveToken } from "@composition/specs";
import type { CompositionDocument } from "@composition/shared";

const deps = { convertComponentRole, convertPageLayout };

// ─────────────────────────────────────────────
// TC-V1: snapshotTokensFromResolved — 기본 변환
// ─────────────────────────────────────────────
describe("snapshotTokensFromResolved (ADR-110 Phase 1)", () => {
  it("TC-V1: string 값은 type=color, source=spec-token 으로 직렬화된다", () => {
    const tokens: ResolvedTokenMap = {
      "color.accent": "#0070f3",
      "color.base": "#ffffff",
    };
    const snapshot = snapshotTokensFromResolved(tokens);

    expect(snapshot["color.accent"]).toEqual({
      type: "color",
      value: "#0070f3",
      source: "spec-token",
    });
    expect(snapshot["color.base"]).toEqual({
      type: "color",
      value: "#ffffff",
      source: "spec-token",
    });
  });

  it("TC-V2: number 값은 type=number, source=spec-token 으로 직렬화된다", () => {
    const tokens: ResolvedTokenMap = {
      "size.borderRadius": 4,
      "size.spacing": 8,
    };
    const snapshot = snapshotTokensFromResolved(tokens);

    expect(snapshot["size.borderRadius"]).toEqual({
      type: "number",
      value: 4,
      source: "spec-token",
    });
    expect(snapshot["size.spacing"]).toEqual({
      type: "number",
      value: 8,
      source: "spec-token",
    });
  });

  it("TC-V3: boolean 값은 type=boolean, source=spec-token 으로 직렬화된다", () => {
    const tokens: ResolvedTokenMap = {
      "feature.darkModeEnabled": true,
    };
    const snapshot = snapshotTokensFromResolved(tokens);

    expect(snapshot["feature.darkModeEnabled"]).toEqual({
      type: "boolean",
      value: true,
      source: "spec-token",
    });
  });

  it("TC-V4: 빈 map 은 빈 snapshot 을 반환한다", () => {
    const snapshot = snapshotTokensFromResolved({});
    expect(Object.keys(snapshot)).toHaveLength(0);
  });

  it("TC-V5: 혼합 타입 token map 을 올바르게 직렬화한다", () => {
    const tokens: ResolvedTokenMap = {
      "color.accent": "#0070f3",
      "size.sm": 4,
      "feature.enabled": false,
    };
    const snapshot = snapshotTokensFromResolved(tokens);

    expect(Object.keys(snapshot)).toHaveLength(3);
    expect(snapshot["color.accent"].type).toBe("color");
    expect(snapshot["size.sm"].type).toBe("number");
    expect(snapshot["feature.enabled"].type).toBe("boolean");
    // 모두 spec-token 출처
    for (const entry of Object.values(snapshot)) {
      expect(entry.source).toBe("spec-token");
    }
  });
});

// ─────────────────────────────────────────────
// TC-V6: snapshotUserDefinedTokens — 사용자 정의 변수
// ─────────────────────────────────────────────
describe("snapshotUserDefinedTokens (ADR-110 Phase 1)", () => {
  it("TC-V6: 사용자 정의 변수는 source=user-defined 로 마킹된다", () => {
    const userVars = {
      primary: { type: "color" as const, value: "#ff0000" },
      spacing: { type: "number" as const, value: 16 },
    };
    const snapshot = snapshotUserDefinedTokens(userVars);

    expect(snapshot["primary"]).toEqual({
      type: "color",
      value: "#ff0000",
      source: "user-defined",
    });
    expect(snapshot["spacing"]).toEqual({
      type: "number",
      value: 16,
      source: "user-defined",
    });
  });

  it("TC-V7: 빈 userVars 는 빈 snapshot 을 반환한다", () => {
    const snapshot = snapshotUserDefinedTokens({});
    expect(Object.keys(snapshot)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// TC-V8: readCanonicalTokens — read accessor
// ─────────────────────────────────────────────
describe("readCanonicalTokens (ADR-110 Phase 1)", () => {
  it("TC-V8: variables 필드 있는 doc → snapshot 반환", () => {
    const tokens: ResolvedTokenMap = {
      "color.accent": "#0070f3",
    };
    const snapshot = snapshotTokensFromResolved(tokens);
    const doc: CompositionDocument = {
      version: "composition-1.0",
      tokens: snapshot,
      children: [],
    };

    const result = readCanonicalTokens(doc);
    expect(result).not.toBeUndefined();
    expect(result?.["color.accent"]).toEqual({
      type: "color",
      value: "#0070f3",
      source: "spec-token",
    });
  });

  it("TC-V9: variables 필드 없는 doc → undefined 반환", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [],
    };
    expect(readCanonicalTokens(doc)).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// TC-V10: legacyToCanonical + getTokens 연동
// ─────────────────────────────────────────────
describe("legacyToCanonical + getTokens (ADR-110 Phase 1)", () => {
  it("TC-V10: getTokens 전달 시 doc.tokens 에 snapshot 주입된다", () => {
    const tokens: ResolvedTokenMap = {
      "color.accent": "#0070f3",
      "size.borderRadius": 4,
    };

    const doc = legacyToCanonical(
      { elements: [], pages: [], layouts: [] },
      { ...deps, getTokens: () => tokens },
    );

    expect(doc.tokens).toBeDefined();
    const result = readCanonicalTokens(doc);
    expect(result?.["color.accent"]).toEqual({
      type: "color",
      value: "#0070f3",
      source: "spec-token",
    });
    expect(result?.["size.borderRadius"]).toEqual({
      type: "number",
      value: 4,
      source: "spec-token",
    });
  });

  it("TC-V11: getTokens 미전달 시 doc.tokens 는 undefined (BC 유지)", () => {
    const doc = legacyToCanonical(
      { elements: [], pages: [], layouts: [] },
      deps,
    );
    expect(doc.tokens).toBeUndefined();
  });

  it("TC-V12: getTokens 는 call-time 호출 (R4 stale 방지) — 호출 횟수 1회 검증", () => {
    let callCount = 0;
    const tokens: ResolvedTokenMap = { "color.accent": "#0070f3" };

    legacyToCanonical(
      { elements: [], pages: [], layouts: [] },
      {
        ...deps,
        getTokens: () => {
          callCount++;
          return tokens;
        },
      },
    );

    // legacyToCanonical 내에서 getTokens 는 정확히 1회 호출되어야 한다
    expect(callCount).toBe(1);
  });

  it("TC-V13: themes + variables 동시 주입 시 두 필드 모두 채워진다", () => {
    const tokens: ResolvedTokenMap = { "color.accent": "#0070f3" };

    const doc = legacyToCanonical(
      { elements: [], pages: [], layouts: [] },
      {
        ...deps,
        getThemeConfig: () => ({
          tint: "blue",
          darkMode: "light",
          neutral: "neutral",
          radiusScale: "md",
        }),
        getTokens: () => tokens,
      },
    );

    expect(doc.themes).toBeDefined();
    expect(doc.tokens).toBeDefined();
    expect(doc.themes?.tint).toBe("blue");
    expect(readCanonicalTokens(doc)?.["color.accent"]?.value).toBe("#0070f3");
  });

  it("TC-V14: doc.version 은 variables 주입 여부와 무관하게 composition-1.0 유지", () => {
    const doc = legacyToCanonical(
      { elements: [], pages: [], layouts: [] },
      {
        ...deps,
        getTokens: () => ({ "color.accent": "#0070f3" }),
      },
    );
    expect(doc.version).toBe("composition-1.0");
  });
});

// ─────────────────────────────────────────────
// Phase 2 ts-3.2 — resolveCanonicalToken (resolver)
// ─────────────────────────────────────────────
describe("resolveCanonicalToken (ADR-110 Phase 2 ts-3.2)", () => {
  function buildDocWithTokens(tokens: ResolvedTokenMap): CompositionDocument {
    return {
      version: "composition-1.0",
      tokens: snapshotTokensFromResolved(tokens),
      children: [],
    };
  }

  it("TC-R1: TokenRef 형식 일치 시 doc.tokens 의 value 를 반환한다", () => {
    const doc = buildDocWithTokens({
      "color.accent": "#0070f3",
      "color.base": "#ffffff",
    });

    expect(resolveCanonicalToken("{color.accent}", doc)).toBe("#0070f3");
    expect(resolveCanonicalToken("{color.base}", doc)).toBe("#ffffff");
  });

  it("TC-R2: number / boolean 값도 정확히 lookup 한다 (snapshot type 보존)", () => {
    const doc = buildDocWithTokens({
      "size.borderRadius": 4,
      "feature.darkModeEnabled": true,
    });

    expect(resolveCanonicalToken("{size.borderRadius}", doc)).toBe(4);
    expect(resolveCanonicalToken("{feature.darkModeEnabled}", doc)).toBe(true);
  });

  it("TC-R3: doc.tokens 미존재 시 undefined 반환 (BC)", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [],
    };
    expect(resolveCanonicalToken("{color.accent}", doc)).toBeUndefined();
  });

  it("TC-R4: 매칭되는 key 없으면 undefined 반환", () => {
    const doc = buildDocWithTokens({ "color.accent": "#0070f3" });
    expect(resolveCanonicalToken("{color.unknown}", doc)).toBeUndefined();
  });

  it("TC-R5: invalid TokenRef 형식 (괄호 없음 / category 누락) → undefined", () => {
    const doc = buildDocWithTokens({ "color.accent": "#0070f3" });

    expect(resolveCanonicalToken("invalid", doc)).toBeUndefined();
    expect(resolveCanonicalToken("{color}", doc)).toBeUndefined();
    expect(resolveCanonicalToken("color.accent", doc)).toBeUndefined();
    expect(resolveCanonicalToken("", doc)).toBeUndefined();
  });

  it("TC-R6: name 에 hyphen 포함된 TokenRef 도 정확히 lookup (예: color.accent-hover)", () => {
    const doc = buildDocWithTokens({
      "color.accent-hover": "#0050b3",
      "color.layer-1": "#fafafa",
    });

    expect(resolveCanonicalToken("{color.accent-hover}", doc)).toBe("#0050b3");
    expect(resolveCanonicalToken("{color.layer-1}", doc)).toBe("#fafafa");
  });

  // ─────────────────────────────────────────────
  // Gate G-B contract: tokenResolver 와 동일 값 반환
  // ─────────────────────────────────────────────
  it("TC-R7: Gate G-B — light theme 에서 resolveToken 결과로 빌드된 doc 은 동일 값 반환", () => {
    // tokenResolver.resolveToken(ref, "light") 결과를 그대로 ResolvedTokenMap 으로 직렬화
    const refs = [
      "{color.accent}",
      "{color.base}",
      "{color.layer-1}",
      "{color.transparent}",
    ] as const;

    const tokens: ResolvedTokenMap = {};
    for (const ref of refs) {
      const match = ref.match(/^\{(\w+)\.(.+)\}$/);
      if (!match) continue;
      const [, category, name] = match;
      const value = resolveToken(ref, "light");
      tokens[`${category}.${name}`] = value;
    }

    const doc = buildDocWithTokens(tokens);

    // 모든 ref 에 대해 resolveCanonicalToken === resolveToken(ref, "light")
    for (const ref of refs) {
      const fromDoc = resolveCanonicalToken(ref, doc);
      const fromResolver = resolveToken(ref, "light");
      expect(fromDoc).toBe(fromResolver);
    }
  });

  it("TC-R8: Gate G-B — dark theme 으로 빌드된 doc 도 동일 contract 충족", () => {
    const refs = ["{color.accent}", "{color.base}", "{color.layer-1}"] as const;

    const tokens: ResolvedTokenMap = {};
    for (const ref of refs) {
      const match = ref.match(/^\{(\w+)\.(.+)\}$/);
      if (!match) continue;
      const [, category, name] = match;
      tokens[`${category}.${name}`] = resolveToken(ref, "dark");
    }

    const doc = buildDocWithTokens(tokens);

    for (const ref of refs) {
      const fromDoc = resolveCanonicalToken(ref, doc);
      const fromResolver = resolveToken(ref, "dark");
      expect(fromDoc).toBe(fromResolver);
    }
  });

  it("TC-R9: legacyToCanonical 결과 doc 으로 resolver 통합 — getTokens + resolve round-trip", () => {
    const tokens: ResolvedTokenMap = {
      "color.accent": "#0070f3",
      "size.borderRadius": 4,
    };

    const doc = legacyToCanonical(
      { elements: [], pages: [], layouts: [] },
      { ...deps, getTokens: () => tokens },
    );

    expect(resolveCanonicalToken("{color.accent}", doc)).toBe("#0070f3");
    expect(resolveCanonicalToken("{size.borderRadius}", doc)).toBe(4);
  });
});

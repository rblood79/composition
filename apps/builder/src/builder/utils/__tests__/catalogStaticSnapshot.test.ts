/**
 * ADR-916 P2-CAT ① — catalog 정적 참조 계약 (strict resolve 파이프라인 + 스냅샷).
 *
 * breakdown §2-CAT 계약 조항 1/2/C3 을 검증한다:
 *  - 조항 C3: strict resolve = resolveToken → parsePxValue → isFinite assert.
 *    `Number()` 금지 (NaN 침묵 통과 차단). 미정의 토큰 / "auto" / nested → throw.
 *  - 조항 1: 사영 = key allowlist (fontSize/lineHeight/iconSize). 서브트리 사영 금지.
 *  - 조항 2: defaultSize fallback 1급. resolve(type,size) = sizes[size] ?? sizes[defaultSize].
 *    Negative = "미존재 type → None" 만 (미존재 size 는 fallback).
 *
 * 순수 함수 — live 영향 0 (P2-CAT ① 은 배선 없음, dormant 회피).
 */
import { describe, it, expect } from "vitest";

import {
  resolveStaticMetric,
  buildCatalogStaticSnapshot,
  lookupCatalogMetric,
  serializeCatalogSnapshot,
} from "../catalogStaticSnapshot";

// ── 조항 C3: strict resolve 파이프라인 ────────────────────────────────────────

describe("ADR-916 P2-CAT ① — resolveStaticMetric (strict resolve, 조항 C3)", () => {
  it("raw number 를 그대로 반환한다", () => {
    expect(resolveStaticMetric(16, "light")).toBe(16);
  });

  it("typography TokenRef 를 숫자로 resolve 한다", () => {
    // typography.ts: text-sm=14, text-base=16
    expect(resolveStaticMetric("{typography.text-sm}", "light")).toBe(14);
    expect(resolveStaticMetric("{typography.text-base}", "light")).toBe(16);
  });

  it("line-height TokenRef 를 숫자로 resolve 한다", () => {
    // typography.ts: text-sm--line-height=20, text-base--line-height=24
    expect(
      resolveStaticMetric("{typography.text-sm--line-height}", "light"),
    ).toBe(20);
    expect(
      resolveStaticMetric("{typography.text-base--line-height}", "light"),
    ).toBe(24);
  });

  it('"auto" 는 숫자로 resolve 불가 → throw (C3: isFinite assert)', () => {
    // resolveToken("auto") = regex 불일치 → "auto" 원문 반환 → Number("auto")=NaN.
    // strict 파이프라인은 Number() 를 쓰지 않고 isFinite assert 로 침묵 통과를 차단한다.
    expect(() => resolveStaticMetric("auto", "light")).toThrow();
  });

  it("미정의 토큰 은 throw 한다 (C3: resolveToken 원문 반환 → 비수치)", () => {
    // resolveToken 은 미정의 시 console.warn + 원문 문자열 반환 (throw 안 함).
    // strict 파이프라인이 그 비수치 결과를 isFinite assert 로 잡아야 한다.
    expect(() =>
      resolveStaticMetric("{typography.does-not-exist}", "light"),
    ).toThrow();
  });

  it("숫자로 파싱 불가능한 임의 문자열 은 throw 한다", () => {
    expect(() => resolveStaticMetric("not-a-number", "light")).toThrow();
  });
});

// ── 조항 1/2: 스냅샷 (key allowlist + defaultSize fallback) ────────────────────

describe("ADR-916 P2-CAT ① — buildCatalogStaticSnapshot (조항 1/2)", () => {
  const snapshot = buildCatalogStaticSnapshot("light");

  it("등록된 type 은 defaultSize 를 값으로 보존한다 (조항 2 — 사전 전개 금지)", () => {
    // 사전 전개(모든 미존재 size 채우기) 대신 defaultSize 를 값으로 남겨
    // fallback 을 resolve 시점(lookupCatalogMetric)에 처리 → oracle 검증 가능.
    expect(snapshot.get("Avatar")?.defaultSize).toBe("md");
  });

  it("등록된 type × size 의 allowlist metric 을 숫자로 담는다 (조항 1)", () => {
    // Avatar md: fontSize={typography.text-sm}=14, iconSize 없음, lineHeight 없음.
    const avatarMd = snapshot.get("Avatar")?.sizes.get("md");
    expect(avatarMd).toBeDefined();
    expect(avatarMd?.fontSize).toBe(14);
  });

  it("allowlist 외 필드(height/borderRadius/indicator)는 스냅샷에 없다 (조항 1 — 범위 제거)", () => {
    const avatarMd = snapshot.get("Avatar")?.sizes.get("md");
    // height:32, borderRadius:"{radius.full}" 는 사영 밖.
    expect(avatarMd).not.toHaveProperty("height");
    expect(avatarMd).not.toHaveProperty("borderRadius");
    expect(avatarMd).not.toHaveProperty("indicator");
  });

  it("미존재 size 는 defaultSize 로 fallback 한다 (조항 2)", () => {
    // Avatar defaultSize="md". 미존재 size "nonexistent" → md 값.
    const avatarMd = snapshot.get("Avatar")?.sizes.get("md");
    const avatarFallback = lookupCatalogMetric(
      snapshot,
      "Avatar",
      "nonexistent",
    );
    expect(avatarFallback).toEqual(avatarMd);
  });

  it("존재하는 size 는 fallback 없이 그 size 를 반환한다 (조항 2)", () => {
    const avatarXs = snapshot.get("Avatar")?.sizes.get("xs");
    expect(lookupCatalogMetric(snapshot, "Avatar", "xs")).toEqual(avatarXs);
    // xs fontSize={typography.text-2xs}=10 ≠ md 14 (fallback 이 아님을 확증).
    expect(lookupCatalogMetric(snapshot, "Avatar", "xs")?.fontSize).not.toBe(
      14,
    );
  });

  it("미존재 type lookup 은 undefined (조항 2 — Negative)", () => {
    expect(snapshot.get("DoesNotExistComponent")).toBeUndefined();
    expect(
      lookupCatalogMetric(snapshot, "DoesNotExistComponent", "md"),
    ).toBeUndefined();
  });

  it("전 컴포넌트 전 size 의 allowlist metric 이 모두 유한 숫자다 (C3 전수)", () => {
    for (const [, entry] of snapshot) {
      for (const [, metric] of entry.sizes) {
        for (const key of ["fontSize", "lineHeight", "iconSize"] as const) {
          const v = metric[key];
          if (v !== undefined) {
            expect(Number.isFinite(v)).toBe(true);
          }
        }
      }
    }
  });
});

// ── P2-CAT ② L1: 구조 정합 (WASM 경계 계약 검증) ──────────────────────────────

describe("ADR-916 P2-CAT ② L1 — serializeCatalogSnapshot 구조 정합", () => {
  const snapshot = buildCatalogStaticSnapshot("light");
  const json = serializeCatalogSnapshot(snapshot);
  const parsed = JSON.parse(json) as Record<
    string,
    { defaultSize?: string; sizes: Record<string, Record<string, number>> }
  >;

  it("Map → JSON 직렬화가 유효한 JSON 이다 (WASM 경계 = string 계약)", () => {
    // wasm.rs 관습(nodes_json: &str)과 동형 — 스냅샷은 JSON string 으로 경계 횡단.
    expect(typeof json).toBe("string");
    expect(parsed).toBeInstanceOf(Object);
  });

  it("직렬화가 스냅샷 Map 과 roundtrip 동형이다 (type 수 + size 수 보존)", () => {
    expect(Object.keys(parsed).length).toBe(snapshot.size);
    for (const [type, entry] of snapshot) {
      expect(parsed[type]).toBeDefined();
      expect(Object.keys(parsed[type].sizes).length).toBe(entry.sizes.size);
    }
  });

  it("defaultSize 를 값으로 직렬화한다 (조항 2 — 사전 전개 금지, 미정의는 키 생략)", () => {
    // Button.defaultSize="md" → JSON 에 보존. Rust 는 Option<String> 으로 수신.
    expect(parsed.Button.defaultSize).toBe("md");
  });

  it("allowlist key 만 직렬화된다 (조항 1 — height/borderRadius/indicator 없음)", () => {
    for (const [, entry] of Object.entries(parsed)) {
      for (const [, metric] of Object.entries(entry.sizes)) {
        for (const key of Object.keys(metric)) {
          expect(["fontSize", "lineHeight", "iconSize"]).toContain(key);
        }
      }
    }
  });

  it("직렬화된 모든 metric 값이 유한 숫자다 (C3 전수 — 경계 횡단 값 안전)", () => {
    for (const [, entry] of Object.entries(parsed)) {
      for (const [, metric] of Object.entries(entry.sizes)) {
        for (const v of Object.values(metric)) {
          expect(Number.isFinite(v)).toBe(true);
        }
      }
    }
  });
});

// ── P2-CAT ② L1.5: golden 앵커 (손검증 대표값 회귀 고정) ──────────────────────

describe("ADR-916 P2-CAT ② L1.5 — Button golden 앵커 (손검증 회귀 고정)", () => {
  const snapshot = buildCatalogStaticSnapshot("light");

  // Button 전 size 손검증값 (componentRulesTable.ts:767-828 + typography.ts strict resolve):
  //   fontSize: xs={text-2xs}=10 / sm={text-xs}=12 / md={text-sm}=14 /
  //             lg={text-base}=16 / xl={text-lg}=18
  //   lineHeight: xs=16 / sm=16 / md=20 / lg=24 / xl=28
  //   iconSize(raw number): xs=14 / sm=16 / md=18 / lg=24 / xl=28
  const GOLDEN: Record<
    string,
    { fontSize: number; lineHeight: number; iconSize: number }
  > = {
    xs: { fontSize: 10, lineHeight: 16, iconSize: 14 },
    sm: { fontSize: 12, lineHeight: 16, iconSize: 16 },
    md: { fontSize: 14, lineHeight: 20, iconSize: 18 },
    lg: { fontSize: 16, lineHeight: 24, iconSize: 24 },
    xl: { fontSize: 18, lineHeight: 28, iconSize: 28 },
  };

  for (const [size, want] of Object.entries(GOLDEN)) {
    it(`Button ${size} = fontSize ${want.fontSize} / lineHeight ${want.lineHeight} / iconSize ${want.iconSize}`, () => {
      const metric = lookupCatalogMetric(snapshot, "Button", size);
      expect(metric).toEqual(want);
    });
  }
});

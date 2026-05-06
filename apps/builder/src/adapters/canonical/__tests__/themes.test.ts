/**
 * @fileoverview ADR-110 Phase 1 — themes read-only snapshot adapter tests.
 *
 * Gate G-A 검증:
 * - `snapshotThemesFromConfig()` pure function
 * - `readCanonicalThemes()` read accessor
 * - `legacyToCanonical()` + `getThemeConfig` 연동
 * - stale snapshot 방지 (R4) 단위 테스트
 * - 빈 ThemeConfig / dark mode / tint override 등
 */

import { describe, expect, it, vi } from "vitest";
import {
  snapshotThemesFromConfig,
  readCanonicalThemes,
  applyCanonicalThemes,
  type ThemeConfigInput,
  type ThemeConfigSetters,
  type ThemeSnapshot,
} from "../themesAdapter";
import { legacyToCanonical } from "../index";
import { convertComponentRole } from "../componentRoleAdapter";
import { convertPageLayout } from "../slotAndLayoutAdapter";
import type { CompositionDocument } from "@composition/shared";

const deps = { convertComponentRole, convertPageLayout };

// ─────────────────────────────────────────────
// TC-T1: snapshotThemesFromConfig — 기본 변환
// ─────────────────────────────────────────────
describe("snapshotThemesFromConfig (ADR-110 Phase 1)", () => {
  it("TC-T1: tint/darkMode/neutral/radiusScale 필드를 그대로 복사한다", () => {
    const config: ThemeConfigInput = {
      tint: "blue",
      darkMode: "light",
      neutral: "neutral",
      radiusScale: "md",
    };
    const snapshot = snapshotThemesFromConfig(config);
    expect(snapshot.tint).toBe("blue");
    expect(snapshot.darkMode).toBe("light");
    expect(snapshot.neutral).toBe("neutral");
    expect(snapshot.radiusScale).toBe("md");
  });

  // ─────────────────────────────────────────────
  // TC-T2: dark mode 시나리오
  // ─────────────────────────────────────────────
  it("TC-T2: darkMode=dark 를 snapshot 에 정확히 반영한다", () => {
    const config: ThemeConfigInput = {
      tint: "purple",
      darkMode: "dark",
      neutral: "slate",
      radiusScale: "lg",
    };
    const snapshot = snapshotThemesFromConfig(config);
    expect(snapshot.darkMode).toBe("dark");
    expect(snapshot.tint).toBe("purple");
  });

  // ─────────────────────────────────────────────
  // TC-T3: system dark mode preference
  // ─────────────────────────────────────────────
  it("TC-T3: darkMode=system 을 그대로 보존한다 (resolveSkiaTheme 는 소비자 책임)", () => {
    const config: ThemeConfigInput = {
      tint: "green",
      darkMode: "system",
      neutral: "neutral",
      radiusScale: "sm",
    };
    const snapshot = snapshotThemesFromConfig(config);
    expect(snapshot.darkMode).toBe("system");
  });

  // ─────────────────────────────────────────────
  // TC-T4: customTokens 슬롯 — 기본 미포함 확인
  // ─────────────────────────────────────────────
  it("TC-T4: customTokens 필드는 기본적으로 undefined (미포함)", () => {
    const config: ThemeConfigInput = {
      tint: "blue",
      darkMode: "light",
      neutral: "neutral",
      radiusScale: "md",
    };
    const snapshot = snapshotThemesFromConfig(config);
    expect(snapshot.customTokens).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// TC-T5: readCanonicalThemes — round-trip
// ─────────────────────────────────────────────
describe("readCanonicalThemes (ADR-110 Phase 1)", () => {
  it("TC-T5: snapshot round-trip — snapshotThemesFromConfig → doc → readCanonicalThemes", () => {
    const config: ThemeConfigInput = {
      tint: "indigo",
      darkMode: "dark",
      neutral: "zinc",
      radiusScale: "xl",
    };
    const snapshot = snapshotThemesFromConfig(config);

    // ADR-110 Phase 1: CompositionDocument.themes 타입이 ThemeSnapshot 으로 전환됨
    // 직접 할당 가능 (cast 불필요)
    const doc: CompositionDocument = {
      version: "composition-1.0",
      themes: snapshot,
      children: [],
    };

    const result = readCanonicalThemes(doc);
    expect(result).not.toBeUndefined();
    expect(result?.tint).toBe("indigo");
    expect(result?.darkMode).toBe("dark");
    expect(result?.neutral).toBe("zinc");
    expect(result?.radiusScale).toBe("xl");
  });

  it("themes 필드 없는 doc → readCanonicalThemes 는 undefined 반환", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [],
    };
    expect(readCanonicalThemes(doc)).toBeUndefined();
  });

  it("themes 에 ThemeSnapshot 구조가 아닌 값 → undefined 반환", () => {
    // 기존 stub 형태 (Record<string, string[]>) 가 ThemeSnapshot 필드를 갖지 않으면 undefined
    const doc: CompositionDocument = {
      version: "composition-1.0",
      themes: { mode: ["light", "dark"] } as Record<string, string[]>,
      children: [],
    };
    // mode 필드만 있고 tint/darkMode/neutral/radiusScale 없음 → undefined
    expect(readCanonicalThemes(doc)).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// TC-T6: legacyToCanonical + getThemeConfig 연동
// ─────────────────────────────────────────────
describe("legacyToCanonical + getThemeConfig (ADR-110 Phase 1)", () => {
  it("TC-T6: getThemeConfig 전달 시 doc.themes 에 snapshot 주입된다", () => {
    const config: ThemeConfigInput = {
      tint: "cyan",
      darkMode: "light",
      neutral: "neutral",
      radiusScale: "none",
    };

    const doc = legacyToCanonical(
      { elements: [], pages: [], layouts: [] },
      { ...deps, getThemeConfig: () => config },
    );

    expect(doc.themes).toBeDefined();
    const snapshot = readCanonicalThemes(doc);
    expect(snapshot?.tint).toBe("cyan");
    expect(snapshot?.darkMode).toBe("light");
    expect(snapshot?.radiusScale).toBe("none");
  });

  it("TC-T7: getThemeConfig 미전달 시 doc.themes 는 undefined (BC 유지)", () => {
    const doc = legacyToCanonical(
      { elements: [], pages: [], layouts: [] },
      deps,
    );
    expect(doc.themes).toBeUndefined();
  });

  it("TC-T8: getThemeConfig 는 call-time 호출 (R4 stale 방지) — 호출 횟수 1회 검증", () => {
    let callCount = 0;
    const config: ThemeConfigInput = {
      tint: "red",
      darkMode: "dark",
      neutral: "neutral",
      radiusScale: "sm",
    };

    legacyToCanonical(
      { elements: [], pages: [], layouts: [] },
      {
        ...deps,
        getThemeConfig: () => {
          callCount++;
          return config;
        },
      },
    );

    // legacyToCanonical 내에서 getThemeConfig 는 정확히 1회 호출되어야 한다
    // (subscribe 기반이 아닌 call-time 직렬화)
    expect(callCount).toBe(1);
  });

  it("TC-T9: tint override 시 snapshot 에 반영 — 변경된 값이 doc.themes 에 기록된다", () => {
    const config: ThemeConfigInput = {
      tint: "orange",
      darkMode: "light",
      neutral: "neutral",
      radiusScale: "md",
    };

    const doc1 = legacyToCanonical(
      { elements: [], pages: [], layouts: [] },
      { ...deps, getThemeConfig: () => config },
    );

    // tint 변경 후 재직렬화
    const updatedConfig: ThemeConfigInput = { ...config, tint: "pink" };
    const doc2 = legacyToCanonical(
      { elements: [], pages: [], layouts: [] },
      { ...deps, getThemeConfig: () => updatedConfig },
    );

    const snap1 = readCanonicalThemes(doc1);
    const snap2 = readCanonicalThemes(doc2);

    expect(snap1?.tint).toBe("orange");
    expect(snap2?.tint).toBe("pink");
  });

  it("TC-T10: doc.version 은 themes 주입 여부와 무관하게 composition-1.0 유지", () => {
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
      },
    );
    expect(doc.version).toBe("composition-1.0");
  });
});

// ─────────────────────────────────────────────
// Phase 2 ts-3.1 — applyCanonicalThemes (write-through)
// ─────────────────────────────────────────────
describe("applyCanonicalThemes (ADR-110 Phase 2 ts-3.1)", () => {
  function createMockSetters(): ThemeConfigSetters & {
    calls: Record<keyof ThemeConfigSetters, string[]>;
  } {
    const calls: Record<keyof ThemeConfigSetters, string[]> = {
      setTint: [],
      setDarkMode: [],
      setNeutral: [],
      setRadiusScale: [],
    };
    return {
      calls,
      setTint: vi.fn((tint: string) => calls.setTint.push(tint)),
      setDarkMode: vi.fn((mode: string) => calls.setDarkMode.push(mode)),
      setNeutral: vi.fn((neutral: string) => calls.setNeutral.push(neutral)),
      setRadiusScale: vi.fn((scale: string) =>
        calls.setRadiusScale.push(scale),
      ),
    };
  }

  it("TC-A1: doc.themes 존재 시 4 setter 모두 호출하고 true 반환", () => {
    const setters = createMockSetters();
    const doc: CompositionDocument = {
      version: "composition-1.0",
      themes: {
        tint: "indigo",
        darkMode: "dark",
        neutral: "zinc",
        radiusScale: "xl",
      },
      children: [],
    };

    const applied = applyCanonicalThemes(doc, setters);

    expect(applied).toBe(true);
    expect(setters.calls.setTint).toEqual(["indigo"]);
    expect(setters.calls.setDarkMode).toEqual(["dark"]);
    expect(setters.calls.setNeutral).toEqual(["zinc"]);
    expect(setters.calls.setRadiusScale).toEqual(["xl"]);
  });

  it("TC-A2: doc.themes 미존재 시 setter 미호출 + false 반환 (BC)", () => {
    const setters = createMockSetters();
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [],
    };

    const applied = applyCanonicalThemes(doc, setters);

    expect(applied).toBe(false);
    expect(setters.calls.setTint).toEqual([]);
    expect(setters.calls.setDarkMode).toEqual([]);
    expect(setters.calls.setNeutral).toEqual([]);
    expect(setters.calls.setRadiusScale).toEqual([]);
  });

  it("TC-A3: doc.themes 가 ThemeSnapshot 구조 미준수 시 setter 미호출 + false (R4)", () => {
    const setters = createMockSetters();
    const doc: CompositionDocument = {
      version: "composition-1.0",
      // 잘못된 구조: tint 만 있고 나머지 필드 누락
      themes: { tint: "red" } as unknown as ThemeSnapshot,
      children: [],
    };

    const applied = applyCanonicalThemes(doc, setters);

    expect(applied).toBe(false);
    expect(setters.calls.setTint).toEqual([]);
  });

  it("TC-A4: round-trip 보장 — snapshot → doc → apply → re-snapshot 동일", () => {
    // 초기 themeConfig (실제 store 대체 mock 상태)
    let storedConfig: ThemeConfigInput = {
      tint: "purple",
      darkMode: "system",
      neutral: "slate",
      radiusScale: "sm",
    };

    // 1. snapshot 생성 (snapshotThemesFromConfig)
    const snapshot1 = snapshotThemesFromConfig(storedConfig);

    // 2. canonical document 빌드 (themes 주입)
    const doc: CompositionDocument = {
      version: "composition-1.0",
      themes: snapshot1,
      children: [],
    };

    // 3. mock setters — applyCanonicalThemes 가 storedConfig 갱신
    const setters: ThemeConfigSetters = {
      setTint: (t) => {
        storedConfig = { ...storedConfig, tint: t };
      },
      setDarkMode: (m) => {
        storedConfig = { ...storedConfig, darkMode: m };
      },
      setNeutral: (n) => {
        storedConfig = { ...storedConfig, neutral: n };
      },
      setRadiusScale: (s) => {
        storedConfig = { ...storedConfig, radiusScale: s };
      },
    };

    // 4. apply
    const applied = applyCanonicalThemes(doc, setters);
    expect(applied).toBe(true);

    // 5. re-snapshot — apply 후 storedConfig 가 원래 snapshot 과 동일해야 함
    const snapshot2 = snapshotThemesFromConfig(storedConfig);
    expect(snapshot2).toEqual(snapshot1);
    expect(snapshot2.tint).toBe("purple");
    expect(snapshot2.darkMode).toBe("system");
    expect(snapshot2.neutral).toBe("slate");
    expect(snapshot2.radiusScale).toBe("sm");
  });

  it("TC-A5: idempotent — 같은 doc 으로 2회 호출 시 setter 4회씩 호출되지만 결과 동일", () => {
    const setters = createMockSetters();
    const doc: CompositionDocument = {
      version: "composition-1.0",
      themes: {
        tint: "cyan",
        darkMode: "light",
        neutral: "neutral",
        radiusScale: "md",
      },
      children: [],
    };

    applyCanonicalThemes(doc, setters);
    applyCanonicalThemes(doc, setters);

    // 2회 호출 후 각 setter 가 2회씩 호출되었지만 마지막 값은 doc.themes 값과 동일
    expect(setters.calls.setTint).toEqual(["cyan", "cyan"]);
    expect(setters.calls.setDarkMode).toEqual(["light", "light"]);
    expect(setters.calls.setNeutral).toEqual(["neutral", "neutral"]);
    expect(setters.calls.setRadiusScale).toEqual(["md", "md"]);
  });

  it("TC-A6: legacyToCanonical 결과 doc 으로 round-trip — getThemeConfig + apply", () => {
    const initialConfig: ThemeConfigInput = {
      tint: "orange",
      darkMode: "dark",
      neutral: "zinc",
      radiusScale: "lg",
    };

    // 1. legacyToCanonical 로 doc 생성 (themes 자동 주입)
    const doc = legacyToCanonical(
      { elements: [], pages: [], layouts: [] },
      { ...deps, getThemeConfig: () => initialConfig },
    );

    // 2. mock setters
    const captured: ThemeConfigInput = {
      tint: "",
      darkMode: "",
      neutral: "",
      radiusScale: "",
    };
    const setters: ThemeConfigSetters = {
      setTint: (t) => {
        captured.tint = t;
      },
      setDarkMode: (m) => {
        captured.darkMode = m;
      },
      setNeutral: (n) => {
        captured.neutral = n;
      },
      setRadiusScale: (s) => {
        captured.radiusScale = s;
      },
    };

    // 3. apply
    expect(applyCanonicalThemes(doc, setters)).toBe(true);

    // 4. captured 값 = initialConfig
    expect(captured).toEqual(initialConfig);
  });
});

import { describe, expect, it } from "vitest";
import type {
  CompositionDocument,
  ThemesCollection,
} from "../../types/composition-document.types";
import {
  BASE_TYPOGRAPHY_TOKEN_KEYS,
  DEFAULT_THEME_ID,
  DEFAULT_THEME_PRESET,
  addTheme,
  createThemeDefinition,
  createThemesCollection,
  duplicateTheme,
  getActiveTheme,
  isThemesCollection,
  migrateThemesField,
  normalizeThemesCollection,
  removeTheme,
  renameTheme,
  setActiveTheme,
  setThemePreset,
  setThemeToken,
} from "../themesCollection";

const SEED = {
  fontFamily: "Pretendard, sans-serif",
  fontSize: 16,
  lineHeight: 1.5,
};
const base = (extra: Partial<CompositionDocument> = {}): CompositionDocument =>
  ({
    version: "composition-1.0",
    children: [],
    ...extra,
  }) as CompositionDocument;
const opts = (
  patch: Partial<Parameters<typeof migrateThemesField>[1]> = {},
): Parameters<typeof migrateThemesField>[1] => ({
  legacyConfig: null,
  legacyWriteThrough: false,
  source: "local-project",
  baseTypographySeed: SEED,
  ...patch,
});

describe("ADR-227 themesCollection — 모양 · 기본 · 무결성", () => {
  it("기본 컬렉션 = Default 하나 · active/order 정합 · tokens 델타 {}", () => {
    const c = createThemesCollection();
    expect(isThemesCollection(c)).toBe(true);
    expect(c.active).toBe(DEFAULT_THEME_ID);
    expect(c.order).toEqual([DEFAULT_THEME_ID]);
    expect(c.items[DEFAULT_THEME_ID]).toEqual({
      id: DEFAULT_THEME_ID,
      name: "Default",
      preset: DEFAULT_THEME_PRESET,
      tokens: {},
    });
    expect(isThemesCollection({ active: "x", items: {}, order: [] })).toBe(
      false,
    );
    expect(isThemesCollection({ tint: "blue" })).toBe(false);
  });

  it("normalize — active 부재 → order[0] · order 는 items 키 순열 (부재 추가 · 미지/중복 제거) · id 불일치 보정 · 변경 0 이면 같은 객체", () => {
    const a = createThemeDefinition("a", "A");
    const b = createThemeDefinition("b", "B");
    const broken: ThemesCollection = {
      active: "zzz",
      items: { a, b: { ...b, id: "wrong" } },
      order: ["b", "ghost", "b"],
    };
    const { collection, issues } = normalizeThemesCollection(broken);
    expect(collection.active).toBe("b");
    expect(collection.order).toEqual(["b", "a"]);
    expect(collection.items.b!.id).toBe("b");
    expect(issues.map((i) => i.code).sort()).toEqual(
      [
        "active-missing",
        "item-id-mismatch",
        "order-duplicate",
        "order-missing-id",
        "order-unknown-id",
      ].sort(),
    );
    const ok = createThemesCollection();
    expect(normalizeThemesCollection(ok).collection).toBe(ok);
  });
});

describe("ADR-227 migrateThemesField — §3.2 행렬", () => {
  it("행 1: 이미 컬렉션 → legacy/flag 무시 · 무결성 보정만 · 무변경이면 같은 문서", () => {
    const doc = base({
      themes: createThemesCollection({ ...DEFAULT_THEME_PRESET, tint: "red" }),
    });
    const r = migrateThemesField(
      doc,
      opts({ legacyConfig: { tint: "green" }, legacyWriteThrough: true }),
    );
    expect(r.changed).toBe(false);
    expect(r.document).toBe(doc);
    expect(r.report.path).toBe("collection");
    expect(getActiveTheme(r.document)!.preset.tint).toBe("red");
  });

  it("행 2 (실전 유일 경로): 구 문서 (themes 부재) + off → legacy localStorage 실효값 · baseTypography 는 seed 와 다른 키만 델타", () => {
    const r = migrateThemesField(
      base(),
      opts({
        legacyConfig: {
          tint: "purple",
          darkMode: "dark",
          neutral: "zinc",
          radiusScale: "lg",
          baseTypography: {
            fontFamily: SEED.fontFamily,
            fontSize: 18,
            lineHeight: 1.5,
          },
        },
      }),
    );
    expect(r.changed).toBe(true);
    expect(r.report.path).toBe("legacy-config");
    const active = getActiveTheme(r.document)!;
    expect(active.preset).toEqual({
      tint: "purple",
      darkMode: "dark",
      neutral: "zinc",
      radiusScale: "lg",
    });
    expect(active.tokens).toEqual({
      [BASE_TYPOGRAPHY_TOKEN_KEYS.fontSize]: {
        type: "number",
        value: 18,
        source: "spec-token",
      },
    });
    expect(r.document.tokens).toBeUndefined();
  });

  it("행 2′: 구 문서 + off + 구 document.themes 있어도 stale — legacy 필드 우선 · legacy 없으면 기본값", () => {
    const stale = base({
      themes: {
        tint: "red",
        darkMode: "light",
        neutral: "neutral",
        radiusScale: "sm",
      } as never,
    });
    const withLegacy = migrateThemesField(
      stale,
      opts({ legacyConfig: { tint: "green" } }),
    );
    expect(withLegacy.report.path).toBe("legacy-config");
    expect(getActiveTheme(withLegacy.document)!.preset).toEqual({
      ...DEFAULT_THEME_PRESET,
      tint: "green",
    });
    const noLegacy = migrateThemesField(stale, opts());
    expect(noLegacy.report.path).toBe("default");
    expect(getActiveTheme(noLegacy.document)!.preset).toEqual(
      DEFAULT_THEME_PRESET,
    );
    expect(getActiveTheme(noLegacy.document)!.tokens).toEqual({});
  });

  it("행 3: on + 유효 구 snapshot → 구 document.themes 우선 · baseTypography 는 legacy · customTokens 는 알려진 키만 델타", () => {
    const doc = base({
      themes: {
        tint: "red",
        darkMode: "system",
        neutral: "slate",
        radiusScale: "xl",
        customTokens: {
          "color.accent": "#123456",
          "radius.md": "10",
          "weird.key": "x",
          "typography.text-sm": "13",
        },
      } as never,
    });
    const r = migrateThemesField(
      doc,
      opts({
        legacyWriteThrough: true,
        legacyConfig: {
          tint: "green",
          baseTypography: {
            fontFamily: "Inter",
            fontSize: 16,
            lineHeight: 1.5,
          },
        },
      }),
    );
    expect(r.report.path).toBe("legacy-doc");
    const active = getActiveTheme(r.document)!;
    expect(active.preset).toEqual({
      tint: "red",
      darkMode: "system",
      neutral: "slate",
      radiusScale: "xl",
    });
    expect(active.tokens).toEqual({
      [BASE_TYPOGRAPHY_TOKEN_KEYS.fontFamily]: {
        type: "string",
        value: "Inter",
        source: "spec-token",
      },
      "color.accent": { type: "color", value: "#123456", source: "spec-token" },
      "radius.md": { type: "number", value: 10, source: "spec-token" },
      "typography.text-sm": { type: "number", value: 13, source: "spec-token" },
    });
    expect(r.report.warnings.some((w) => w.includes("weird.key"))).toBe(true);
  });

  it("행 4: on + 부재/무효 snapshot → legacy → 기본값 (무효 snapshot 은 경고)", () => {
    const r = migrateThemesField(
      base({ themes: { tint: 3 } as never }),
      opts({ legacyWriteThrough: true, legacyConfig: { neutral: "gray" } }),
    );
    expect(r.report.path).toBe("legacy-config");
    expect(getActiveTheme(r.document)!.preset.neutral).toBe("gray");
    expect(r.report.warnings.some((w) => w.includes("ThemeSnapshot"))).toBe(
      true,
    );
  });

  it("행 5: import — 이 기기의 legacy 는 섞지 않는다 · 유효 구 snapshot → 기본값", () => {
    const withSnap = migrateThemesField(
      base({
        themes: {
          tint: "pink",
          darkMode: "light",
          neutral: "neutral",
          radiusScale: "none",
        } as never,
      }),
      opts({
        source: "import",
        legacyConfig: { tint: "green", baseTypography: { fontSize: 20 } },
      }),
    );
    expect(withSnap.report.path).toBe("legacy-doc");
    expect(getActiveTheme(withSnap.document)!.preset.tint).toBe("pink");
    expect(getActiveTheme(withSnap.document)!.tokens).toEqual({});
    const plain = migrateThemesField(
      base(),
      opts({ source: "import", legacyConfig: { tint: "green" } }),
    );
    expect(plain.report.path).toBe("default");
  });

  it("기존 root tokens — spec-token 은 Default 델타로 (legacy 키가 먼저) · user-defined 는 root 에 남는다 · 무효 entry 는 버림", () => {
    const r = migrateThemesField(
      base({
        tokens: {
          "color.accent": {
            type: "color",
            value: "#ff0000",
            source: "spec-token",
          },
          [BASE_TYPOGRAPHY_TOKEN_KEYS.fontSize]: {
            type: "number",
            value: 99,
            source: "spec-token",
          },
          brand: { type: "color", value: "#00ff00", source: "user-defined" },
          bad: { nope: true } as never,
        },
      }),
      opts({ legacyConfig: { baseTypography: { fontSize: 18 } } }),
    );
    const active = getActiveTheme(r.document)!;
    expect(active.tokens["color.accent"]).toEqual({
      type: "color",
      value: "#ff0000",
      source: "spec-token",
    });
    expect(active.tokens[BASE_TYPOGRAPHY_TOKEN_KEYS.fontSize]!.value).toBe(18);
    expect(r.document.tokens).toEqual({
      brand: { type: "color", value: "#00ff00", source: "user-defined" },
    });
    expect(r.report.warnings.some((w) => w.includes("tokens.bad"))).toBe(true);
  });

  it("재실행 멱등 — 두 번째는 changed=false · 같은 문서 객체", () => {
    const once = migrateThemesField(
      base(),
      opts({ legacyConfig: { tint: "cyan" } }),
    ).document;
    const twice = migrateThemesField(
      once,
      opts({ legacyConfig: { tint: "red" } }),
    );
    expect(twice.changed).toBe(false);
    expect(twice.document).toBe(once);
  });
});

describe("ADR-227 항목 연산 (pure)", () => {
  const c0 = createThemesCollection();

  it("add · duplicate(순서 = 원본 뒤) · rename · setActive · 무변경이면 같은 객체", () => {
    const c1 = addTheme(
      c0,
      createThemeDefinition("dark", "Dark", {
        ...DEFAULT_THEME_PRESET,
        darkMode: "dark",
      }),
    );
    expect(c1.order).toEqual([DEFAULT_THEME_ID, "dark"]);
    expect(addTheme(c1, createThemeDefinition("dark", "Dup"))).toBe(c1);
    const c2 = duplicateTheme(c1, DEFAULT_THEME_ID, "copy", "Default copy");
    expect(c2.order).toEqual([DEFAULT_THEME_ID, "copy", "dark"]);
    expect(c2.items.copy!.preset).toEqual(DEFAULT_THEME_PRESET);
    expect(renameTheme(c2, "copy", "Brand").items.copy!.name).toBe("Brand");
    expect(renameTheme(c2, "copy", "Default copy")).toBe(c2);
    expect(setActiveTheme(c2, "dark").active).toBe("dark");
    expect(setActiveTheme(c2, "ghost")).toBe(c2);
    expect(setActiveTheme(c2, DEFAULT_THEME_ID)).toBe(c2);
  });

  it("remove — 마지막 하나는 못 지운다 · 활성을 지우면 순서상 이웃이 활성", () => {
    expect(removeTheme(c0, DEFAULT_THEME_ID)).toBe(c0);
    let c = addTheme(c0, createThemeDefinition("a", "A"));
    c = addTheme(c, createThemeDefinition("b", "B"));
    c = setActiveTheme(c, "a");
    const r = removeTheme(c, "a");
    expect(r.order).toEqual([DEFAULT_THEME_ID, "b"]);
    expect(r.active).toBe("b");
    const r2 = removeTheme(setActiveTheme(c, "b"), "b");
    expect(r2.active).toBe("a");
  });

  it("preset patch — 유효 문자열 키만 · 같으면 같은 객체 · 다른 테마 불변", () => {
    const c1 = addTheme(c0, createThemeDefinition("a", "A"));
    const c2 = setThemePreset(c1, "a", { tint: "red", darkMode: undefined });
    expect(c2.items.a!.preset.tint).toBe("red");
    expect(c2.items[DEFAULT_THEME_ID]).toBe(c1.items[DEFAULT_THEME_ID]);
    expect(setThemePreset(c2, "a", { tint: "red" })).toBe(c2);
    expect(setThemePreset(c2, "ghost", { tint: "red" })).toBe(c2);
  });

  it("token 델타 — set/replace/remove · 같은 값이면 같은 객체 · null 로 seed 복귀", () => {
    const entry = {
      type: "color" as const,
      value: "#111111",
      source: "spec-token" as const,
    };
    const c1 = setThemeToken(c0, DEFAULT_THEME_ID, "color.accent", entry);
    expect(c1.items[DEFAULT_THEME_ID]!.tokens["color.accent"]).toEqual(entry);
    expect(
      setThemeToken(c1, DEFAULT_THEME_ID, "color.accent", { ...entry }),
    ).toBe(c1);
    const c2 = setThemeToken(c1, DEFAULT_THEME_ID, "color.accent", null);
    expect(c2.items[DEFAULT_THEME_ID]!.tokens).toEqual({});
    expect(setThemeToken(c2, DEFAULT_THEME_ID, "color.accent", null)).toBe(c2);
  });
});

import { describe, expect, it } from "vitest";
import type { ThemesCollection } from "../../types/catalog-style.types";
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
  normalizeThemesCollection,
  removeTheme,
  renameTheme,
  setActiveTheme,
  setThemePreset,
  setThemeToken,
} from "../themesCollection";

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

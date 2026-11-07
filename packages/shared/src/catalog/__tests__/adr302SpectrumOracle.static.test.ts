/**
 * ADR-302 G1 — 초기값 동일. 기본 preset (blue · neutral · light/dark) 의 모든 역할 토큰이 설치된
 * `@adobe/spectrum-design-data` (oracle fixture — `adr302-spectrum-color-extract.mjs` 로만 갱신) 의 값과 같다.
 *
 * 세 층을 따로 잰다:
 *   1. alias 표 ↔ oracle — `oracle` 이 적힌 역할은 그 design-data alias 가 가리키는 단 · 값과 같다.
 *   2. resolver 출력 ↔ alias 표 — `resolveThemeSnapshot` 의 기본 preset 출력 = 표의 단을 oracle 사다리에서 읽은 값.
 *   3. 층 · 키 — `pasteboard` 존재 · `raised` 없음 · 출력 키 = 표 키.
 *
 * Phase 0 (2026-11-08): 1 은 GREEN, 2 · 3 은 RED (지금 값이 Tailwind · 혼합 파생) — Phase 1 이 GREEN 으로.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COLOR_ALIASES, type ColorAliasEntry } from "@composition/rendering";
import { resolveThemeSnapshot } from "../runtime/resolveThemeSnapshot";

const oracle = JSON.parse(
  readFileSync(
    new URL("./fixtures/adr302-spectrum-color-oracle.json", import.meta.url),
    "utf8",
  ),
) as {
  ladders: unknown;
  aliases: unknown;
};

type Mode = "light" | "dark";
const MODES: readonly Mode[] = ["light", "dark"];

interface OracleAlias {
  value: string;
  family: string | null;
  scaleIndex: number | null;
}
const ladders = oracle.ladders as Record<
  string,
  Partial<Record<Mode, Record<string, string>>>
>;
const aliases = oracle.aliases as Record<
  string,
  Partial<Record<Mode, OracleAlias>>
>;

/** 기본 preset 의 사다리 family — tone = gray, accent = blue (tint 기본값). */
function familyOf(entry: ColorAliasEntry): string | undefined {
  if (entry.axis === "tone") return "gray";
  if (entry.axis === "accent") return "blue";
  return entry.family;
}

function expectedValue(entry: ColorAliasEntry, mode: Mode): string {
  const step = entry[mode];
  if (typeof step === "string") return step;
  const family = familyOf(entry);
  const value = family ? ladders[family]?.[mode]?.[String(step)] : undefined;
  if (!value) throw new Error(`oracle ladder ${family}-${step} (${mode}) 없음`);
  return value;
}

const DEFAULT_THEME = {
  id: "adr302-default",
  name: "default",
  preset: {
    tint: "blue",
    neutral: "neutral",
    radiusScale: "md",
    darkMode: "light",
  },
  tokens: {},
} as unknown as Parameters<typeof resolveThemeSnapshot>[0];

describe("ADR-302 G1 — 기본 preset = Spectrum 토큰 값", () => {
  it("alias 표 ↔ design-data alias: 단 · 값이 같다", () => {
    const mismatches: string[] = [];
    for (const [key, entry] of Object.entries(COLOR_ALIASES)) {
      if (!entry.oracle) continue;
      for (const mode of MODES) {
        const alias = aliases[entry.oracle]?.[mode];
        if (!alias) {
          mismatches.push(`${key}: oracle ${entry.oracle} (${mode}) 없음`);
          continue;
        }
        if (
          alias.family !== familyOf(entry) ||
          alias.scaleIndex !== entry[mode]
        )
          mismatches.push(
            `${key} ${mode}: 표 ${familyOf(entry)}-${entry[mode]} ≠ ${entry.oracle} ${alias.family}-${alias.scaleIndex}`,
          );
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("resolver 기본 preset 출력 = alias 표 × oracle 사다리 (역할마다 · 두 모드)", () => {
    const snapshot = resolveThemeSnapshot(DEFAULT_THEME, {
      baseTypographySeed: {
        fontFamily: "Pretendard",
        fontSize: 14,
        lineHeight: 1.5,
      } as never,
    });
    const mismatches: string[] = [];
    for (const [key, entry] of Object.entries(COLOR_ALIASES))
      for (const mode of MODES) {
        const want = expectedValue(entry, mode);
        const got = snapshot.colors[mode][key];
        if (got !== want)
          mismatches.push(`${key} ${mode}: ${got ?? "—"} ≠ ${want}`);
      }
    expect(mismatches).toEqual([]);
  });

  it("출력 키 = alias 표 키 (pasteboard 있음 · raised 없음)", () => {
    const snapshot = resolveThemeSnapshot(DEFAULT_THEME, {
      baseTypographySeed: {
        fontFamily: "Pretendard",
        fontSize: 14,
        lineHeight: 1.5,
      } as never,
    });
    for (const mode of MODES)
      expect(Object.keys(snapshot.colors[mode]).sort()).toEqual(
        Object.keys(COLOR_ALIASES).sort(),
      );
  });
});

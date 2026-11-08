/**
 * ADR-302 사용자 결정 8 (a) — 사다리 생성은 lazy chunk. 로드 전 비기본 preset 은 seed + `THEME_LADDERS_PENDING`
 * 경고, 로드되면 구독자가 한 번 불리고 같은 테마를 다시 풀면 생성값이다. 기본 preset 은 로드와 무관하게 seed.
 */
import { describe, expect, it, vi } from "vitest";
import { lightColors } from "@composition/rendering";
import { createThemeDefinition } from "../../theme/themesCollection";
import { DEFAULT_BASE_TYPOGRAPHY } from "../runtime/fontDefaults";

async function freshModules() {
  vi.resetModules();
  const ladders = await import("../runtime/themeLadders");
  const { resolveThemeSnapshot } =
    await import("../runtime/resolveThemeSnapshot");
  return { ladders, resolveThemeSnapshot };
}

function theme(tint: string, neutral = "neutral") {
  const t = createThemeDefinition("adr302-lazy", "lazy");
  t.preset = { ...t.preset, tint, neutral };
  return t;
}

describe("ADR-302 — 사다리 lazy 로드", () => {
  it("로드 전 비기본 preset = seed + 대기 경고 → 로드 뒤 구독자 1회 · 생성값 · 경고 없음", async () => {
    const { ladders, resolveThemeSnapshot } = await freshModules();
    const opts = { baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY };
    expect(ladders.themeLadderModule()).toBeUndefined();

    const before = resolveThemeSnapshot(theme("green", "slate"), opts);
    expect(before.warnings).toContain(ladders.THEME_LADDERS_PENDING);
    expect(before.colors.light.accent).toBe(lightColors.accent);

    const listener = vi.fn();
    ladders.onThemeLaddersLoaded(listener);
    await ladders.loadThemeLadders();
    expect(listener).toHaveBeenCalledTimes(1);

    const after = resolveThemeSnapshot(theme("green", "slate"), opts);
    expect(after.warnings).toEqual([]);
    expect(after.colors.light.accent).not.toBe(lightColors.accent);
    expect(after.colors.light["layer-1"]).not.toBe(lightColors["layer-1"]);
  });

  it("기본 preset (blue · neutral) 은 로드 전에도 경고 없이 seed", async () => {
    const { ladders, resolveThemeSnapshot } = await freshModules();
    expect(
      ladders.themeNeedsLadders(
        { tint: "blue", neutral: "neutral" },
        undefined,
      ),
    ).toBe(false);
    const s = resolveThemeSnapshot(theme("blue"), {
      baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY,
    });
    expect(s.warnings).toEqual([]);
    expect(s.colors.light.accent).toBe(lightColors.accent);
  });

  it("로드가 구독보다 먼저 끝나도 구독자를 한 번 부른다 (Builder: workspace 가 로드를 시작한 뒤 effect 가 구독)", async () => {
    const { ladders } = await freshModules();
    await ladders.loadThemeLadders();
    const late = vi.fn();
    ladders.onThemeLaddersLoaded(late);
    expect(late).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(late).toHaveBeenCalledTimes(1);
    const cancelled = vi.fn();
    ladders.onThemeLaddersLoaded(cancelled)();
    await Promise.resolve();
    expect(cancelled).not.toHaveBeenCalled();
  });
});

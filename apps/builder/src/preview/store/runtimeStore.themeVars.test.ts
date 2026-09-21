// @vitest-environment jsdom
/**
 * ADR-227 Phase 2 — Preview `THEME_VARS` replace: 활성 테마 한 벌로 통째 교체 (이전 테마 변수 제거).
 * 기본 (replace 없음) 은 종전 병합 그대로.
 */
import { describe, expect, it } from "vitest";
import { createRuntimeStore } from "./runtimeStore";

const styleText = () =>
  (document.getElementById("runtime-theme-vars") as HTMLStyleElement | null)
    ?.textContent ?? "";

describe("runtimeStore.setThemeVars", () => {
  it("병합 (기본) — 같은 name+isDark 는 덮고 나머지는 남는다", () => {
    const store = createRuntimeStore();
    store.getState().setThemeVars([
      { name: "--tint", value: "var(--blue)", isDark: false },
      { name: "--radius-md", value: "6px", isDark: false },
    ]);
    store.getState().setThemeVars([{ name: "--tint", value: "var(--red)", isDark: false }]);
    expect(store.getState().themeVars).toEqual([
      { name: "--tint", value: "var(--red)", isDark: false },
      { name: "--radius-md", value: "6px", isDark: false },
    ]);
    expect(styleText()).toContain("--radius-md: 6px");
  });

  it("replace — 이전 벌 (예: 테마 A 의 --fg override) 이 사라지고 새 벌만 · light/dark 두 블록", () => {
    const store = createRuntimeStore();
    store.getState().setThemeVars(
      [
        { name: "--tint", value: "var(--blue)", isDark: false },
        { name: "--fg", value: "#112233", isDark: false },
        { name: "--fg", value: "#112233", isDark: true },
      ],
      true,
    );
    expect(styleText()).toContain("--fg: #112233");
    store.getState().setThemeVars(
      [
        { name: "--tint", value: "var(--red)", isDark: false },
        { name: "--tint", value: "var(--red)", isDark: true },
      ],
      true,
    );
    expect(store.getState().themeVars).toHaveLength(2);
    const css = styleText();
    expect(css).not.toContain("--fg");
    expect(css).toContain(":root {\n  --tint: var(--red);\n}");
    expect(css).toContain('[data-theme="dark"] {\n  --tint: var(--red);\n}');
  });
});

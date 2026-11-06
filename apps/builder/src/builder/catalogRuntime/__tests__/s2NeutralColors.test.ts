import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { expect, it } from "vitest";
import { createThemeDefinition } from "@composition/shared";
import type { TokensSnapshot } from "@composition/shared";
import { resolveThemeSnapshot } from "../../../../../../packages/shared/src/catalog/runtime/resolveThemeSnapshot";
import { DEFAULT_BASE_TYPOGRAPHY } from "../../../../../../packages/shared/src/catalog/runtime/fontDefaults";
import { installThemeMaps } from "../../../../../../packages/shared/src/catalog/runtime/themeMaps";

const require = createRequire(import.meta.url);
const s2 = require(
  join(
    dirname(require.resolve("@react-spectrum/s2/package.json")),
    "style/dist/spectrum-theme.cjs",
  ),
);
const roles = [
  ["focus-ring", "outlineColor", "focus-ring"],
  ["neutral-content", "color", "neutral"],
  ["neutral-content-hover", "color", "neutral:hovered"],
  ["neutral-fill", "backgroundColor", "neutral"],
  ["neutral-fill-hover", "backgroundColor", "neutral:hovered"],
  ["neutral-fill-pressed", "backgroundColor", "neutral:pressed"],
  ["neutral-surface", "backgroundColor", "gray-100"],
  ["neutral-surface-hover", "backgroundColor", "gray-100:hovered"],
  ["neutral-outline", "borderColor", "gray-300"],
  ["neutral-outline-hover", "borderColor", "gray-300:hovered"],
  ["on-neutral", "color", "gray-25"],
] as const;
const snapshot = (tokens: TokensSnapshot = {}) =>
  resolveThemeSnapshot(
    createThemeDefinition("neutral", "Neutral", undefined, tokens),
    { baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY },
  );
const color = (value: string) =>
  ({ type: "color", value, source: "spec-token" }) as const;

it.each(roles)("S2 1.8.2 %s 역할 = 설치본 %s:%s", (key, property, role) => {
  const assets: string[] = [];
  s2.style.call(
    { addAsset: (asset: { content: string }) => assets.push(asset.content) },
    { [property]: role },
  );
  const pair = /light-dark\(rgb\(([^)]+)\), rgb\(([^)]+)\)\)/.exec(
    assets.join("\n"),
  );
  expect(pair).not.toBeNull();
  const resolved = snapshot();
  for (const [i, mode] of (["light", "dark"] as const).entries()) {
    const channels = pair![i + 1]!.split(",");
    const expected =
      "#" +
      channels.map((c) => Number(c).toString(16).padStart(2, "0")).join("");
    expect(resolved.colors[mode][key]).toBe(expected);
  }
});

it("내용과 바탕의 편집은 독립적이고 설치 후 기본값 복원도 오염되지 않는다", () => {
  const original = snapshot();
  const content = snapshot({ "color.neutral-content": color("#123456") });
  const fill = snapshot({ "color.neutral-fill": color("#654321") });
  for (const mode of ["light", "dark"] as const) {
    expect(content.colors[mode]["neutral-content"]).toBe("#123456");
    expect(content.colors[mode]["neutral-fill"]).toBe(
      original.colors[mode]["neutral-fill"],
    );
    expect(fill.colors[mode]["neutral-content"]).toBe(
      original.colors[mode]["neutral-content"],
    );
    expect(fill.colors[mode]["neutral-fill"]).toBe("#654321");
  }
  installThemeMaps(content);
  try {
    expect(snapshot().colors).toEqual(original.colors);
  } finally {
    installThemeMaps(null);
  }
});

it("기존 neutral 델타를 연결하되 새 역할과 명시 상태가 우선한다 (항목 순서 무관)", () => {
  const entries = [
    ["color.neutral-fill", color("#654321")],
    ["color.neutral", color("#123456")],
    ["color.neutral-fill-hover", color("#abcdef")],
  ] as const;
  for (const ordered of [entries, [...entries].reverse()]) {
    const resolved = snapshot(Object.fromEntries(ordered));
    for (const mode of ["light", "dark"] as const) {
      expect(resolved.colors[mode]["neutral-content"]).toBe("#123456");
      expect(resolved.colors[mode]["neutral-fill"]).toBe("#654321");
      expect(resolved.colors[mode]["neutral-fill-hover"]).toBe("#abcdef");
    }
  }
});

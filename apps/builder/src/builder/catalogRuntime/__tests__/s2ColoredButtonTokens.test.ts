import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { expect, it } from "vitest";
import {
  createThemeDefinition,
  DEFAULT_THEME_PRESET,
  type TokensSnapshot,
} from "@composition/shared";
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
const snapshot = (tokens: TokensSnapshot = {}, tint = "blue") =>
  resolveThemeSnapshot(
    createThemeDefinition(
      "colored",
      "Colored",
      { ...DEFAULT_THEME_PRESET, tint },
      tokens,
    ),
    { baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY },
  );
const color = (value: string) =>
  ({ type: "color", value, source: "spec-token" }) as const;

it.each([
  ["accent-fill", "accent-900", "accent-700"],
  ["accent-fill-hover", "accent-1000", "accent-600"],
  ["negative-fill", "negative-900", "negative-700"],
  ["negative-fill-hover", "negative-1000", "negative-600"],
])("%s: S2 1.8.2 Button의 light %s / dark %s", (key, light, dark) => {
  const resolved = snapshot();
  for (const [i, mode] of (["light", "dark"] as const).entries()) {
    const assets: string[] = [];
    s2.style.call(
      { addAsset: (asset: { content: string }) => assets.push(asset.content) },
      { backgroundColor: mode === "light" ? light : dark },
    );
    const pair = /light-dark\(rgb\(([^)]+)\), rgb\(([^)]+)\)\)/.exec(
      assets.join("\n"),
    );
    expect(pair).not.toBeNull();
    const channels = pair![i + 1]!.split(",");
    const expected =
      "#" +
      channels.map((c) => Number(c).toString(16).padStart(2, "0")).join("");
    expect(resolved.colors[mode][key!]).toBe(expected);
  }
});

it.each(["red", "#008866"])(
  "사용자 tint %s는 기존 accent 탐색값을 연결",
  (tint) => {
    const resolved = tint.startsWith("#")
      ? snapshot({ "color.accent": color(tint) })
      : snapshot({}, tint);
    for (const mode of ["light", "dark"] as const) {
      expect(resolved.colors[mode]["accent-fill"]).toBe(
        resolved.colors[mode].accent,
      );
      expect(resolved.colors[mode]["accent-fill-hover"]).toBe(
        resolved.colors[mode]["accent-hover"],
      );
    }
  },
);

it("명시 fill/hover가 기존 색상보다 우선하고 다른 의미 역할은 유지", () => {
  const entries = [
    ["color.negative-fill", color("#654321")],
    ["color.negative-fill-hover", color("#112233")],
    ["color.negative", color("#ff5500")],
    ["color.negative-hover", color("#ff3300")],
    ["color.accent-fill", color("#123456")],
    ["color.accent-hover", color("#445566")],
  ] as const;
  for (const ordered of [entries, [...entries].reverse()]) {
    const resolved = snapshot(Object.fromEntries(ordered));
    for (const mode of ["light", "dark"] as const) {
      expect(resolved.colors[mode]["negative-fill"]).toBe("#654321");
      expect(resolved.colors[mode]["negative-fill-hover"]).toBe("#112233");
      expect(resolved.colors[mode].negative).toBe("#ff5500");
      expect(resolved.colors[mode]["accent-fill"]).toBe("#123456");
      expect(resolved.colors[mode]["accent-fill-hover"]).toBe("#445566");
    }
  }
});

it("기존 negative 편집 연결과 theme 설치 후 S2 기본값 복원", () => {
  const original = snapshot();
  const custom = snapshot({ "color.negative": color("#123456") });
  expect(custom.colors.light["negative-fill"]).toBe("#123456");
  expect(custom.colors.light["negative-fill-hover"]).toBe(
    custom.colors.light["negative-hover"],
  );
  installThemeMaps(custom);
  try {
    expect(snapshot().colors).toEqual(original.colors);
  } finally {
    installThemeMaps(null);
  }
});

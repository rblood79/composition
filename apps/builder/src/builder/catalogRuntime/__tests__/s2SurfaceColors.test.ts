import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { lightColors, darkColors } from "@composition/rendering";
import {
  createThemeDefinition,
  DEFAULT_THEME_PRESET,
} from "@composition/shared";
import {
  resolveThemeSnapshot,
  colorTokenCssVarName,
} from "../../../../../../packages/shared/src/catalog/runtime/resolveThemeSnapshot";
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
  "base",
  "layer-1",
  "layer-2",
  "elevated",
  "border-disabled",
  "disabled",
  "disabled-content",
] as const;
function oracle(role: (typeof roles)[number]) {
  const assets: string[] = [];
  s2.style.call(
    { addAsset: (asset: { content: string }) => assets.push(asset.content) },
    role === "border-disabled"
      ? { borderColor: "disabled" }
      : role === "disabled-content"
        ? { color: "disabled" }
        : { backgroundColor: role },
  );
  const pair = /light-dark\(rgb\(([^)]+)\), rgb\(([^)]+)\)\)/.exec(
    assets.join("\n"),
  );
  if (!pair) throw new Error(`S2 color missing: ${role}`);
  return pair.slice(1).map(
    (channels) =>
      "#" +
      channels
        .split(",")
        .map((channel) => Number(channel).toString(16).padStart(2, "0"))
        .join(""),
  );
}
const snapshot = (tokens = {}) =>
  resolveThemeSnapshot(
    createThemeDefinition("surface", "Surface", DEFAULT_THEME_PRESET, tokens),
    { baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY },
  );

describe("S2 1.8.2 공통 바탕·disabled 테두리", () => {
  it.each(roles)("%s: 설치본 = seed = 기본 snapshot = DOM 변수", (role) => {
    const expected = oracle(role);
    const resolved = snapshot();
    for (const [index, mode] of (["light", "dark"] as const).entries()) {
      expect((mode === "light" ? lightColors : darkColors)[role]).toBe(
        expected[index],
      );
      expect(resolved.colors[mode][role]).toBe(expected[index]);
      expect(
        resolved.cssVars.find(
          (v) =>
            v.name === colorTokenCssVarName(role) &&
            v.isDark === (mode === "dark"),
        )?.value,
      ).toBe(expected[index]);
    }
  });
  it("사용자 색상 변경과 기본값 복원", () => {
    const custom = snapshot({
      "color.layer-1": {
        type: "color",
        value: "#123456",
        source: "spec-token",
      },
    });
    expect(custom.colors.light["layer-1"]).toBe("#123456");
    expect(custom.colors.dark["layer-1"]).toBe("#123456");
    installThemeMaps(custom);
    try {
      expect(snapshot().colors.light["layer-1"]).toBe(oracle("layer-1")[0]);
    } finally {
      installThemeMaps(null);
    }
  });
});

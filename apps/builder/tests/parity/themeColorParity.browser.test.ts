/**
 * ADR-293 G3 (RED ③) — 테마 색 토큰의 DOM 계산값 = Skia 맵 hex.
 *
 * Preview · Publish 와 같은 번들 CSS (`styles/index.css`) 를 싣고 resolver snapshot 을 Preview 와 같은
 * 함수 (`applyCatalogPreviewTheme`) 로 설치한 뒤, catalog rule 이 참조하는 `{color.X}` 전부를 두 경로로
 * 읽는다 — (a) 생성기 변환 문자열 (`tokenToCSSVar`, 폴백 포함) · (b) 생성 CSS 가 hover · pressed 에서
 * 쓰는 폴백 없는 변수 `var(--X)`. 둘 다 Skia 맵 (`snapshot.colors[mode][X]`) 과 같아야 한다.
 *
 * 이 테스트가 증명하는 것은 직렬화 · 설치 · cascade 의 연결이다. resolver 식이 맞는지 (대비 · 의도) 는
 * resolver 단위 테스트와 live 사용자 확인의 몫.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { tokenToCSSVar, type TokenRef } from "@composition/rendering";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import { COMPONENT_RULES_TABLE } from "../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { applyCatalogPreviewTheme } from "../../../../packages/shared/src/catalog/runtime/domView.runtime";
import { DEFAULT_BASE_TYPOGRAPHY } from "../../../../packages/shared/src/catalog/runtime/fontDefaults";
import { NEUTRAL_PALETTES } from "../../../../packages/shared/src/catalog/runtime/neutralToSkiaColors";
import {
  resolveThemeSnapshot,
  type ResolvedThemeSnapshot,
} from "../../../../packages/shared/src/catalog/runtime/resolveThemeSnapshot";
import type { CatalogThemeState } from "../../../../packages/shared/src/catalog/runtime/theme";
import { TINT_PRESETS } from "../../../../packages/shared/src/catalog/runtime/tintToSkiaColors";
import { createThemeDefinition } from "../../../../packages/shared/src/theme/themesCollection";
import type { TokensSnapshot } from "../../../../packages/shared/src/types/catalog-style.types";

const css = document.createElement("style");
beforeAll(() => {
  css.textContent = bundleCss;
  document.head.append(css);
  injectPreviewBaseStyles(document);
});
afterAll(() => {
  css.remove();
  document.getElementById("runtime-theme-vars")?.remove();
  document.documentElement.removeAttribute("data-theme");
});

/** catalog rule 이 참조하는 색 토큰 (CSS 키워드 `transparent` 제외). */
const CATALOG_COLOR_KEYS = [
  ...new Set(
    [
      ...JSON.stringify(COMPONENT_RULES_TABLE).matchAll(
        /\{color\.([a-z0-9-]+)\}/g,
      ),
    ].map((m) => m[1]!),
  ),
]
  .filter((key) => key !== "transparent")
  .sort();

const canvas = document.createElement("canvas");
canvas.width = canvas.height = 1;
const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
/** 계산된 CSS 색 (rgb · oklch · color(srgb …)) → `#rrggbb` (sRGB 8 bit, 불투명 위). */
function toHex(color: string): string {
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = "#000000";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((v) => v!.toString(16).padStart(2, "0")).join("")}`;
}

const probe = document.createElement("div");
function domColor(value: string): string {
  probe.style.backgroundColor = "";
  probe.style.backgroundColor = value;
  return toHex(getComputedStyle(probe).backgroundColor);
}

function install(snapshot: ResolvedThemeSnapshot, mode: "light" | "dark") {
  applyCatalogPreviewTheme({
    key: "",
    colorMode: mode,
    install: () => {},
    snapshot: () => snapshot,
  } satisfies CatalogThemeState);
  if (!probe.isConnected) document.body.append(probe);
}

const snapshotOf = (
  tint: string,
  neutral: string,
  tokens: TokensSnapshot = {},
) =>
  resolveThemeSnapshot(
    createThemeDefinition(
      "parity",
      "Parity",
      { tint, neutral, radiusScale: "md", darkMode: "light" } as never,
      tokens,
    ),
    { baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY },
  );

/** 같은 모드의 Skia hex 와 DOM 두 경로를 비교해 다른 것만 낸다. */
function diverged(
  snapshot: ResolvedThemeSnapshot,
  mode: "light" | "dark",
  keys: readonly string[] = CATALOG_COLOR_KEYS,
): string[] {
  install(snapshot, mode);
  const out: string[] = [];
  for (const key of keys) {
    const skia = snapshot.colors[mode][key];
    if (!skia || !/^#[0-9a-f]{6}$/i.test(skia)) {
      out.push(`${key}: Skia 값 ${skia}`);
      continue;
    }
    const mapped = tokenToCSSVar(`{color.${key}}` as TokenRef);
    const slot = /^var\((--[a-z0-9-]+)/i.exec(mapped)?.[1];
    const viaTable = domColor(mapped);
    const viaSlot = slot ? domColor(`var(${slot})`) : viaTable;
    const want = skia.toLowerCase();
    if (viaTable !== want || viaSlot !== want)
      out.push(
        `${key}: Skia ${want} · DOM ${viaTable}${viaSlot !== viaTable ? ` · 폴백 없는 ${slot} ${viaSlot}` : ""}`,
      );
  }
  return out;
}

describe("ADR-293 G3 — 테마 색 DOM 계산값 = Skia hex", () => {
  it("catalog 색 참조를 모았다", () => {
    expect(CATALOG_COLOR_KEYS.length).toBeGreaterThan(80);
  });

  for (const tint of Object.keys(TINT_PRESETS))
    for (const neutral of Object.keys(NEUTRAL_PALETTES))
      for (const mode of ["light", "dark"] as const)
        it(`${tint} × ${neutral} × ${mode}`, () => {
          expect(diverged(snapshotOf(tint, neutral), mode)).toEqual([]);
        });

  // 리뷰 round 1 H2 · round 2 — 델타 하나 (나머지 토큰은 그대로여야 한다)
  const DELTAS: Record<string, string> = {
    negative: "#ff0000",
    "purple-subtle": "#123456",
    raised: "#eeeeee",
    "on-negative": "#123456",
    elevated: "#fafafa",
    disabled: "#cccccc",
    neutral: "#112233",
    "neutral-subtle": "#eeeeee",
  };
  for (const [key, value] of Object.entries(DELTAS))
    for (const mode of ["light", "dark"] as const)
      it(`델타 color.${key}=${value} × ${mode}`, () => {
        const snapshot = snapshotOf("blue", "neutral", {
          [`color.${key}`]: { value },
        } as TokensSnapshot);
        // catalog 가 참조하지 않는 토큰 (elevated · disabled) 도 자기 값은 DOM 에 닿아야 한다
        const keys = [
          ...new Set([
            ...CATALOG_COLOR_KEYS,
            key,
            `${key}-hover`,
            `${key}-pressed`,
          ]),
        ].filter((k) => k in snapshot.colors[mode]);
        expect(diverged(snapshot, mode, keys)).toEqual([]);
      });
});

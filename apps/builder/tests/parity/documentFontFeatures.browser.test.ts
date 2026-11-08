/**
 * 문서 서체 기능 — Canvas paragraph 와 Preview · Publish DOM 이 같은 OpenType 기능으로 글자를 만든다.
 *
 * Canvas 는 모든 paragraph 에 `DEFAULT_FONT_FEATURES` 를 넣는다. DOM 은 문서 root 에 같은 목록을 받아야
 * 한다 — Builder 의 Preview 버튼이 여는 Publish 는 `preview.html` 의 base reset 을 싣지 않으므로
 * 두 앱이 공유하는 `applyCatalogPreviewTheme` 가 실어야 한다. 서체마다 다른 보정이 아니라 같은 목록 하나다.
 *
 * Why (2026-11-09): Publish 에 기능이 없어 Pretendard 14px "…and the" 가 Canvas 343.35 / DOM 341.80,
 * 긴 Label 의 줄 나눔이 Canvas · Preview 에서 갈렸다.
 */
import { afterAll, beforeAll, expect, it } from "vitest";
import publishStyles from "../../../publish/src/styles/index.css?inline";
import { DEFAULT_FONT_FEATURES } from "@/builder/workspace/canvas/layout/engines/cssResolver";
import { applyCatalogPreviewTheme } from "../../../../packages/shared/src/catalog/runtime/domView.runtime";
import { DEFAULT_BASE_TYPOGRAPHY } from "../../../../packages/shared/src/catalog/runtime/fontDefaults";
import { resolveThemeSnapshot } from "../../../../packages/shared/src/catalog/runtime/resolveThemeSnapshot";
import type { CatalogThemeState } from "../../../../packages/shared/src/catalog/runtime/theme";
import { createThemeDefinition } from "../../../../packages/shared/src/theme/themesCollection";

const css = document.createElement("style");
beforeAll(() => {
  // Publish 의 실제 stylesheet 만 — Builder `preview.html` 의 base reset 은 싣지 않는다.
  css.textContent = publishStyles;
  document.head.append(css);
});
afterAll(() => {
  css.remove();
  document.getElementById("runtime-theme-vars")?.remove();
  for (const element of [document.documentElement, document.body])
    element.removeAttribute("style");
});

/** `"cv02", "cv03" 0` · `"cv02" 1` → 켜진 태그 (값 0 은 꺼짐). */
function enabledTags(settings: string): string[] {
  if (settings === "normal") return [];
  return settings
    .split(",")
    .map((part) => part.trim().match(/^"(\w{4})"(?:\s+(\d+|on|off))?$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .filter((m) => m[2] !== "0" && m[2] !== "off")
    .map((m) => m[1]!)
    .sort();
}

it("Publish 문서 root 는 Canvas paragraph 와 같은 서체 기능을 받는다", () => {
  const snapshot = resolveThemeSnapshot(
    createThemeDefinition("features", "Features", {} as never, {}),
    { baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY },
  );
  applyCatalogPreviewTheme({
    key: "",
    colorMode: "light",
    install: () => {},
    snapshot: () => snapshot,
  } satisfies CatalogThemeState);
  const label = document.body.appendChild(document.createElement("span"));
  label.textContent = "Shipping address for the delivery";
  try {
    const canvas = DEFAULT_FONT_FEATURES.filter((f) => f.value !== 0)
      .map((f) => f.name)
      .sort();
    expect(canvas.length).toBeGreaterThan(0);
    expect(enabledTags(getComputedStyle(label).fontFeatureSettings)).toEqual(
      canvas,
    );
  } finally {
    label.remove();
  }
});

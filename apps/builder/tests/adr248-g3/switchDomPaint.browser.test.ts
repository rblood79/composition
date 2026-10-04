/** ADR-248: 현재 Preview CSS와 Canvas 테마 토큰의 색/비활성 계약. */
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { afterAll, beforeAll, expect, it } from "vitest";
import { Switch } from "@composition/shared/components/Switch";
import {
  createThemeDefinition,
  DEFAULT_THEME_PRESET,
} from "@composition/shared";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import { DEFAULT_BASE_TYPOGRAPHY } from "@/builder/fonts/customFonts";
import { resolveThemeSnapshot } from "@/utils/theme/resolveThemeSnapshot";

const css = document.createElement("style");
beforeAll(() => {
  css.textContent = bundleCss;
  document.head.append(css);
  injectPreviewBaseStyles(document);
});
afterAll(() => css.remove());

// computed color의 oklch 표현도 브라우저 sRGB pixel로 정규화한다.
function pixel(color: string) {
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  return [...ctx.getImageData(0, 0, 1, 1).data];
}

for (const tint of ["blue", "red"] as const) {
  for (const dark of [false, true]) {
    for (const disabled of [false, true]) {
      for (const selected of [false, true]) {
        it(`${tint}/${dark ? "dark" : "light"}/${disabled ? "disabled" : "enabled"}/${selected ? "selected" : "unselected"}: track, border, text, thumb and opacity agree`, () => {
          const theme = resolveThemeSnapshot(
            createThemeDefinition("t", "T", { ...DEFAULT_THEME_PRESET, tint }),
            { baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY },
          );
          const colors = dark ? theme.colors.dark : theme.colors.light;
          const host = document.createElement("div");
          host.dataset.theme = dark ? "dark" : "light";
          for (const v of theme.cssVars.filter((v) => v.isDark === dark))
            host.style.setProperty(v.name, v.value);
          document.body.append(host);
          const root = createRoot(host);
          try {
            flushSync(() =>
              root.render(
                createElement(Switch, {
                  children: "Switch",
                  isDisabled: disabled,
                  isSelected: selected,
                }),
              ),
            );
            const owner = host.querySelector(".react-aria-Switch")!;
            const track = owner.querySelector(".indicator")!;
            const ownerStyle = getComputedStyle(owner);
            const trackStyle = getComputedStyle(track);
            expect
              .soft(pixel(trackStyle.backgroundColor), "track")
              .toEqual(pixel(colors[selected ? "neutral" : "accent-subtle"]));
            expect
              .soft(pixel(trackStyle.borderTopColor), "border")
              .toEqual(pixel(colors[selected ? "neutral" : "border-hover"]));
            expect
              .soft(pixel(ownerStyle.color), "text")
              .toEqual(pixel(colors.neutral));
            expect
              .soft(
                pixel(getComputedStyle(track, "::before").backgroundColor),
                "thumb",
              )
              .toEqual(pixel(colors[selected ? "white" : "neutral-subtle"]));
            expect
              .soft(Number(ownerStyle.opacity), "opacity")
              .toBe(disabled ? 0.38 : 1);
          } finally {
            flushSync(() => root.unmount());
            host.remove();
          }
        });
      }
    }
  }
}

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
import { catalogThemeVarsCss } from "../../../../packages/shared/src/catalog/runtime/themeVarsCss";

const css = document.createElement("style");
const themeVars = document.createElement("style");
beforeAll(() => {
  css.textContent = bundleCss;
  document.head.append(css);
  // ADR-293 — 테마 색은 Preview 처럼 resolver snapshot 이 싣는다 (preview-system.css 는 계산하지 않는다 —
  //   없으면 트랙 `border: … var(--border)` 가 무효가 돼 테두리 폭이 0 이 된다)
  themeVars.textContent = catalogThemeVarsCss(
    resolveThemeSnapshot(createThemeDefinition("switch", "Switch"), {
      baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY,
    }),
  );
  document.head.append(themeVars);
  injectPreviewBaseStyles(document);
});
afterAll(() => {
  css.remove();
  themeVars.remove();
});

for (const size of ["S", "M", "L", "XL"] as const) {
  for (const catalog of [false, true]) {
    for (const selected of [false, true]) {
      it(`${size}/${catalog ? "catalog" : "shared"}/${selected ? "selected" : "unselected"}: pressed thumb stays inside the track`, async () => {
        // shared Switch는 label, catalog SwitchField는 div > SwitchButton label이다.
        const owner = document.createElement(catalog ? "div" : "label");
        owner.className = "react-aria-Switch";
        owner.dataset.size = size;
        owner.toggleAttribute("data-selected", selected);
        const button = catalog ? document.createElement("label") : owner;
        if (catalog) {
          button.className = "react-aria-SwitchButton";
          owner.append(button);
        }
        const track = document.createElement("div");
        track.className = "indicator";
        button.append(track);
        document.body.append(owner);
        try {
          const bounds = () => {
            const pseudo = getComputedStyle(track, "::before");
            const width = parseFloat(pseudo.width);
            const height = parseFloat(pseudo.height);
            const trackStyle = getComputedStyle(track);
            const originY = parseFloat(pseudo.transformOrigin.split(" ")[1]);
            const origin = parseFloat(pseudo.transformOrigin);
            const insetX = parseFloat(pseudo.marginLeft);
            const scale =
              pseudo.scale === "none" ? 1 : parseFloat(pseudo.scale);
            const scaleY =
              pseudo.scale === "none"
                ? 1
                : parseFloat(pseudo.scale.split(" ")[1] ?? pseudo.scale);
            const insetY =
              parseFloat(trackStyle.borderTopWidth) +
              (trackStyle.alignItems === "center"
                ? (track.clientHeight - height) / 2
                : 0);
            const translate = new DOMMatrix(pseudo.transform).m41;
            const offset =
              pseudo.translate === "none"
                ? 0
                : parseFloat(pseudo.translate) *
                  (pseudo.translate.includes("%") ? width / 100 : 1);
            return {
              left: insetX + offset + origin + scale * (translate - origin),
              right:
                insetX + offset + origin + scale * (translate + width - origin),
              top: insetY + originY * (1 - scaleY),
              bottom: insetY + originY + scaleY * (height - originY),
            };
          };
          const base = bounds();
          const edgeGap = (box: ReturnType<typeof bounds>) =>
            selected
              ? track.offsetWidth - track.clientLeft - box.right
              : track.clientLeft + box.left;
          expect(
            edgeGap(base),
            "idle outer gap equals vertical gap",
          ).toBeCloseTo(base.top);
          expect(
            (base.top + base.bottom) / 2,
            "idle thumb vertical center",
          ).toBeCloseTo(track.offsetHeight / 2);
          button.dataset.pressed = "true";
          await new Promise((resolve) => setTimeout(resolve, 250));
          const { left, right, top, bottom } = bounds();
          expect(
            edgeGap({ left, right, top, bottom }),
            "pressed outer gap equals vertical gap",
          ).toBeCloseTo(top);
          expect(
            (top + bottom) / 2,
            "pressed thumb vertical center",
          ).toBeCloseTo(track.offsetHeight / 2);
          expect(left, "thumb left edge").toBeGreaterThanOrEqual(0);
          expect(right, "thumb right edge").toBeLessThanOrEqual(
            track.clientWidth,
          );
          expect(right - left, "pressed width remains 1.2x").toBeCloseTo(
            (base.right - base.left) * 1.2,
          );
          expect(bottom - top, "pressed thumb keeps its height").toBeCloseTo(
            base.bottom - base.top,
          );
          expect(top, "thumb top edge").toBeGreaterThanOrEqual(0);
          expect(bottom, "thumb bottom edge").toBeLessThanOrEqual(
            track.offsetHeight,
          );
          expect(
            selected ? right : left,
            "outer edge stays anchored",
          ).toBeCloseTo(selected ? base.right : base.left);
        } finally {
          owner.remove();
        }
      });
    }
  }
}

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

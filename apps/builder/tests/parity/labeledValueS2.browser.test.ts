import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { Provider, LabeledValue } from "@react-spectrum/s2";

it("measures installed S2 labeled-value block and intrinsic sizing", async () => {
  const host = document.createElement("div");
  host.style.width = "800px";
  document.body.append(host);
  const root = createRoot(host);
  const intrinsic = { S: 192, M: 208, L: 224, XL: 240 };
  const line = { S: 16, M: 18, L: 20, XL: 22 };
  const control = { S: 24, M: 32, L: 40, XL: 48 };
  const topHeight = { S: 36, M: 43, L: 50, XL: 57 };
  const sideHeight = { S: 16, M: 18, L: 20, XL: 22 };
  try {
    for (const mode of ["block", "flex"] as const) {
      host.style.display = mode;
      host.style.alignItems = "start";
      for (const size of ["S", "M", "L", "XL"] as const) {
        for (const labelPosition of ["top", "side"] as const) {
          await act(async () => {
            root.render(
              createElement(Provider, {
                colorScheme: "light",
                children: createElement(LabeledValue, {
                  label: "Label",
                  value: "Value",
                  size,
                  labelPosition,
                  UNSAFE_style: {
                    fontFamily:
                      "adobe-clean-spectrum-vf, adobe-clean-variable, adobe-clean, ui-sans-serif, system-ui, sans-serif",
                  },
                }),
              }),
            );
          });
          await document.fonts.ready;
          await new Promise(requestAnimationFrame);
          const label = [...host.querySelectorAll("span")].find(
            (node) => node.textContent === "Label",
          )!;
          const value = [...host.querySelectorAll("span")].find(
            (node) => node.textContent === "Value",
          )!;
          const element = value.parentElement!;
          const css = getComputedStyle(value);
          expect(css.contain).toBe("inline-size");
          expect(css.containIntrinsicWidth).toBe(`${intrinsic[size]}px`);
          expect(css.minWidth).toBe(`${control[size]}px`);
          expect(css.lineHeight).toBe(`${line[size]}px`);
          const rect = element.getBoundingClientRect();
          const expected =
            mode === "block"
              ? 800
              : intrinsic[size] +
                (labelPosition === "side"
                  ? label.getBoundingClientRect().width + 12
                  : 0);
          expect(Math.abs(rect.width - expected)).toBeLessThan(0.1);
          expect(rect.height).toBe(
            labelPosition === "side" ? sideHeight[size] : topHeight[size],
          );
        }
      }
    }
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

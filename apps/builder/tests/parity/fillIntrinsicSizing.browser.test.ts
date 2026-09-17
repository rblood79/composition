import { beforeAll, describe, expect, it } from "vitest";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import {
  getSizingEffectiveStyle,
  resolveFillProjection,
} from "@composition/shared";
import { pipelineLeg, type CaseNode } from "./harness";

beforeAll(async () => {
  const style = document.createElement("style");
  style.textContent = bundleCss;
  document.head.appendChild(style);
  await document.fonts.ready;
  await initEngineWasm();
});

describe("ADR-224 — Fill과 leaf intrinsic 측정의 분리", () => {
  for (const direction of ["row", "column"] as const) {
    for (const mode of ["fill", "fixed"] as const) {
      it(`${direction} ${mode}: 실제 Button CSS와 Canvas 크기가 일치한다`, () => {
        const rootStyle = {
          display: "flex",
          flexDirection: direction,
          width: "900px",
          height: "240px",
          padding: "0px",
          gap: "0px",
          border: "0px",
          boxSizing: "border-box",
        };
        const children = [2, 1].map((factor) => {
          const base: Record<string, string | number> =
            mode === "fixed" ? { width: "160px", height: "45px" } : {};
          const fill = mode === "fill" ? { width: { factor } } : undefined;
          return {
            ...base,
            ...resolveFillProjection(
              fill,
              getSizingEffectiveStyle(
                {
                  id: "button",
                  type: "Button",
                  props: { size: "md", style: base },
                },
                "desktop",
              ),
              rootStyle,
            ),
          };
        });
        const host = document.createElement("div");
        Object.assign(host.style, rootStyle);
        const buttons = children.map((style) => {
          const button = document.createElement("button");
          button.className = "react-aria-Button button-base";
          button.dataset.size = "md";
          button.dataset.variant = "primary";
          button.dataset.fillStyle = "fill";
          button.textContent = "Button";
          Object.assign(button.style, { boxSizing: "border-box", ...style });
          host.appendChild(button);
          return button;
        });
        document.body.appendChild(host);
        try {
          const nodes: CaseNode[] = children.map((style, i) => ({
            label: `button-${i}`,
            elementType: "Button",
            text: "Button",
            props: { size: "md", children: "Button" },
            style,
          }));
          nodes.push({ label: "root", style: rootStyle, children: [0, 1] });
          const layout = pipelineLeg(nodes, 900, 240);
          buttons.forEach((button, i) => {
            const rect = button.getBoundingClientRect();
            expect(
              Math.abs(layout[i].w - rect.width),
              `width ${i}`,
            ).toBeLessThanOrEqual(1);
            expect(
              Math.abs(layout[i].h - rect.height),
              `height ${i}`,
            ).toBeLessThanOrEqual(1);
          });
        } finally {
          host.remove();
        }
      });
    }
  }
});

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
    for (const mode of [
      "fill",
      "height-fill",
      "both-fill",
      "fixed",
      // ADR-224 Ratio — 엔진 경계 (2026-09-18): flex 커널의 aspect 전송 (§9.4 step 7 · §9.2.3 B)
      // 과 leaf 전송값 content-box 보고. Chrome 이 oracle 이다 (실제 Button CSS).
      "ratio-fixed",
      "ratio-fill",
      "ratio-height-fill",
      "ratio-definite-cross",
      "ratio-stretch",
      "ratio-stretch-plain",
    ] as const) {
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
          const ratio = mode.startsWith("ratio")
            ? {
                aspectRatio: "2 / 1",
                ...(mode === "ratio-stretch" ? {} : { alignSelf: "start" }),
              }
            : {};
          const base: Record<string, string | number> =
            mode === "fixed"
              ? { width: "160px", height: "45px" }
              : mode === "ratio-fixed"
                ? { ...ratio, width: "200px", height: "auto" }
                : mode === "ratio-definite-cross"
                  ? { ...ratio, height: "100px" }
                  : ratio;
          const fill =
            mode === "fill" || mode === "ratio-fill" || mode === "ratio-stretch"
              ? { width: { factor } }
              : mode === "height-fill" || mode === "ratio-height-fill"
                ? { height: { factor } }
                : mode === "both-fill"
                  ? { width: { factor }, height: { factor } }
                  : undefined;
          return {
            // 두 소비자에 동일한 폰트를 지정한다. fixture의 body 상속과
            // Builder 기본 폰트 차이를 크기 계약 오류로 판정하지 않는다.
            fontFamily: "Arial",
            fontSize: "14px",
            fontWeight: "400",
            lineHeight: "20px",
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
              `width ${i}: engine ${layout[i].w} vs dom ${rect.width}`,
            ).toBeLessThanOrEqual(1);
            expect(
              Math.abs(layout[i].h - rect.height),
              `height ${i}: engine ${layout[i].h} vs dom ${rect.height}`,
            ).toBeLessThanOrEqual(1);
          });
        } finally {
          host.remove();
        }
      });
    }
  }
});

import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { IllustratedMessage } from "@composition/shared/components/IllustratedMessage";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import { pipelineLeg, type CaseNode } from "./harness";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { borderWidth } from "@composition/specs";
import { resolveComponentRule } from "@composition/shared";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { resolveContainerStylesFallback } from "@/builder/workspace/canvas/layout/engines/implicitStyles";

const sheet = document.createElement("style");
beforeAll(async () => {
  sheet.textContent = bundleCss + "\n* { box-sizing: border-box; }";
  document.head.appendChild(sheet);
  await initEngineWasm();
});
afterAll(() => sheet.remove());
function withHost(
  type: string,
  attrs: Record<string, string>,
  run: (host: HTMLDivElement) => void,
) {
  const parent = document.createElement("div");
  parent.style.width = "390px";
  const host = document.createElement("div");
  host.className = `react-aria-${type}`;
  for (const [key, value] of Object.entries(attrs))
    host.setAttribute(key, value);
  parent.appendChild(host);
  document.body.appendChild(parent);
  try {
    run(host);
  } finally {
    parent.remove();
  }
}
describe("catalog 기본값 실제 CSS와 Canvas 입력 정합", () => {
  it.each(["Select", "ComboBox", "NumberField", "SearchField", "ColorField"])(
    "%s 모든 size/top/side gap",
    (type) => {
      for (const [size, metrics] of Object.entries(
        resolveComponentRule(type)!.sizes ?? {},
      )) {
        for (const position of ["top", "side"]) {
          withHost(
            type,
            { "data-size": size, "data-label-position": position },
            (host) => {
              const dom = getComputedStyle(host);
              expect(parseFloat(dom.gap), `${type}/${size}/${position}`).toBe(
                metrics.gap,
              );
              const canvas = resolveContainerStylesFallback(
                type.toLowerCase(),
                {},
                size,
              );
              expect(canvas.gap ?? canvas.rowGap).toBe(parseFloat(dom.gap));
              host.style.gap = "31px";
              expect(getComputedStyle(host).gap).toBe("31px");
              expect(
                resolveContainerStylesFallback(
                  type.toLowerCase(),
                  { gap: 31 },
                  size,
                ).gap,
              ).toBeUndefined();
            },
          );
        }
      }
    },
  );
  it("Dialog 본문은 부모 폭 100%, column 배치", () => {
    withHost("Dialog", { "data-size": "md" }, (host) => {
      const child = document.createElement("div");
      child.style.cssText = "width:80px;height:24px;flex-shrink:0";
      host.appendChild(child);
      const nodes: CaseNode[] = [
        {
          label: "content",
          style: { width: "80px", height: "24px", flexShrink: 0 },
        },
        {
          label: "dialog",
          elementType: "Dialog",
          props: { size: "md" },
          style: {},
          children: [0],
        },
        {
          label: "root",
          style: {
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            width: "390px",
          },
          children: [1],
        },
      ];
      const bounds = pipelineLeg(nodes, 390, -1);
      expect(host.getBoundingClientRect().width).toBe(390);
      expect(bounds[1].w).toBe(host.getBoundingClientRect().width);
      expect(bounds[1].h).toBe(host.getBoundingClientRect().height);
      expect(getComputedStyle(host).flexDirection).toBe("column");
      expect(resolveContainerStylesFallback("dialog", {}, "md")).toMatchObject({
        width: "100%",
        display: "flex",
        flexDirection: "column",
      });
    });
  });
  it.each(["Tooltip", "FileUpload"])(
    "%s 인라인 제거 후 catalog 배치와 CSS가 일치",
    (type) => {
      const sizes = Object.keys(resolveComponentRule(type)!.sizes ?? {});
      for (const size of sizes) {
        withHost(type, { "data-size": size }, (host) => {
          const dom = getComputedStyle(host);
          const canvas = resolveContainerStylesFallback(
            type.toLowerCase(),
            {},
            size,
          );
          if (canvas.display) expect(dom.display).toBe(canvas.display);
          if (canvas.flexDirection)
            expect(dom.flexDirection).toBe(canvas.flexDirection);
          if (canvas.rowGap != null)
            expect(parseFloat(dom.rowGap)).toBe(canvas.rowGap);
          if (canvas.paddingTop != null)
            expect(parseFloat(dom.paddingTop)).toBe(canvas.paddingTop);
        });
      }
    },
  );
  it("IllustratedMessage 실제 컴포넌트는 catalog 배치와 size 간격을 읽는다", () => {
    const mount = document.createElement("div");
    mount.style.width = "390px";
    document.body.appendChild(mount);
    const root = createRoot(mount);
    try {
      for (const size of ["sm", "md", "lg"]) {
        flushSync(() =>
          root.render(createElement(IllustratedMessage, { size })),
        );
        const host = mount.querySelector('[role="status"]')!;
        const dom = getComputedStyle(host);
        const canvas = resolveContainerStylesFallback(
          "illustratedmessage",
          {},
          size,
        );
        expect(dom.display).toBe(canvas.display);
        expect(dom.alignItems).toBe(canvas.alignItems);
        expect(parseFloat(dom.gap)).toBe(canvas.rowGap);
        expect(parseFloat(dom.paddingTop)).toBe(canvas.paddingTop);
        expect(host.getBoundingClientRect().width).toBe(390);
      }
    } finally {
      flushSync(() => root.unmount());
      mount.remove();
    }
  });
  it("Card border는 활성 theme thin=3을 양쪽에서 읽는다", () => {
    const original = borderWidth.thin;
    try {
      borderWidth.thin = 3;
      withHost(
        "Card",
        { "data-size": "md", "data-variant": "primary" },
        (host) => {
          host.style.setProperty("--border-width-thin", "3px");
          expect(parseFloat(getComputedStyle(host).borderTopWidth)).toBe(3);
          expect(
            resolveContainerStylesFallback("card", {}, "md").borderWidth,
          ).toBe(3);
        },
      );
    } finally {
      borderWidth.thin = original;
    }
  });
});

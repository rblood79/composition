import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { IllustratedMessage } from "@composition/shared/components/IllustratedMessage";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import { pipelineLeg, type CaseNode } from "./harness";
import { page } from "@vitest/browser/context";
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
  // 실제 부모에서 잰다 (2026-09-27): Canvas 는 DialogTrigger (catalog `width: fit-content`) 안, DOM 은 RAC Modal (폭 없음 ·
  //   `max-width: min(500px, 90vw)` shrink-to-fit) 안. `width: 100%` 는 두 부모 모두에서 풀리지 않아 Canvas 가
  //   min-content 로 찌그러졌다 — 고정 부모 (390) 만 재던 종전 검사가 놓쳤다.
  it("Dialog 본문은 실제 부모 (Canvas DialogTrigger · DOM Modal) 에서 둘 다 400", async () => {
    // Modal 상한 min(500px, 90vw) 이 걸리지 않는 창 — 좁은 창의 상한은 DOM 전용 (Canvas 에는 Modal 이 없다).
    await page.viewport(1280, 800);
    const modal = document.createElement("div");
    modal.className = "react-aria-Modal";
    modal.setAttribute("data-size", "md");
    const host = document.createElement("div");
    host.className = "react-aria-Dialog";
    host.setAttribute("data-size", "md");
    const child = document.createElement("div");
    child.style.cssText = "width:80px;height:24px;flex-shrink:0";
    host.appendChild(child);
    modal.appendChild(host);
    document.body.appendChild(modal);
    try {
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
          label: "trigger",
          elementType: "DialogTrigger",
          style: {},
          children: [1],
        },
      ];
      const bounds = pipelineLeg(nodes, 1000, -1);
      const dom = host.getBoundingClientRect();
      expect(dom.width).toBe(400);
      expect(bounds[1].w).toBe(dom.width);
      expect(bounds[1].h).toBe(dom.height);
      expect(getComputedStyle(host).flexDirection).toBe("column");
    } finally {
      modal.remove();
    }
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

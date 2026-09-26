import { afterAll, beforeAll, describe, expect, it } from "vitest";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { Link } from "@composition/shared/components/Link";
import { Disclosure } from "@composition/shared/components/Disclosure";
import { IllustratedMessage } from "@composition/shared/components/IllustratedMessage";
import { resolveComponentRule } from "@composition/shared";
import {
  getSkiaPrimitive,
  resolveIllustratedMessageMetric,
  type SizeSpec,
} from "@composition/specs";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import type { Element } from "@/types/core/store.types";
import { layoutTree } from "./adr923ProductionTrees";

const LONG_TEXT =
  "A long description with several words that should wrap when its available width is limited. ".repeat(
    3,
  );
let host: HTMLDivElement;
const roots: Root[] = [];

beforeAll(async () => {
  await initEngineWasm();
  const css = document.createElement("style");
  css.id = "auto-height-candidates-css";
  css.textContent = bundleCss;
  document.head.appendChild(css);
  injectPreviewBaseStyles(document);
  host = document.createElement("div");
  host.style.cssText = "position:absolute;left:0;top:0;width:300px";
  document.body.appendChild(host);
});

afterAll(() => {
  for (const root of roots) root.unmount();
  host.remove();
  document.getElementById("auto-height-candidates-css")?.remove();
});

async function domHeight(
  node: React.ReactNode,
  selector: string,
): Promise<number> {
  const mount = document.createElement("div");
  host.appendChild(mount);
  const root = createRoot(mount);
  roots.push(root);
  root.render(node);
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  const target = mount.querySelector<HTMLElement>(selector);
  if (!target) throw new Error(`${selector}: DOM 대상 없음`);
  return target.getBoundingClientRect().height;
}

function canvasHeight(
  type: string,
  width: number,
  props: Record<string, unknown>,
  rootWidth = width,
): number {
  const elements = [
    {
      id: "body",
      type: "body",
      parent_id: null,
      props: { style: { width: `${rootWidth}px` } },
    },
    { id: "candidate", type, parent_id: "body", props },
  ] as unknown as Element[];
  return layoutTree("body", elements, rootWidth, 500).layout.get("candidate")!
    .height;
}

describe("글자 leaf의 auto 높이 후보", () => {
  it("고정 폭 Link의 여러 줄 높이", async () => {
    const width = 120;
    const style = { width: `${width}px`, height: "auto", whiteSpace: "normal" };
    const canvas = canvasHeight(
      "Link",
      width,
      { children: LONG_TEXT, style },
      300,
    );
    const dom = await domHeight(
      React.createElement(Link, { style }, LONG_TEXT),
      ".react-aria-Link",
    );
    expect(canvas).toBeCloseTo(dom, 0);
  });

  it("DisclosureContent의 여러 줄 높이", async () => {
    const width = 120;
    const style = {
      width: `${width}px`,
      height: "auto",
      padding: 0,
      fontSize: 14,
      lineHeight: "20px",
    };
    const canvas = canvasHeight(
      "DisclosureContent",
      width,
      { children: LONG_TEXT, style },
      300,
    );
    const dom = await domHeight(
      React.createElement(
        Disclosure,
        { title: "Details", defaultExpanded: true, style: { width } },
        React.createElement("div", { style }, LONG_TEXT),
      ),
      ".react-aria-DisclosurePanel > div",
    );
    expect(canvas).toBeCloseTo(dom, 0);
  });

  it("IllustratedMessage의 긴 설명 높이", async () => {
    const width = 180;
    const style = { width: `${width}px`, height: "auto" };
    const canvas = canvasHeight("IllustratedMessage", width, {
      heading: "Message",
      description: LONG_TEXT,
      style,
    });
    const dom = await domHeight(
      React.createElement(IllustratedMessage, {
        heading: "Message",
        description: LONG_TEXT,
        style,
      }),
      '[role="status"]',
    );
    expect(canvas).toBeCloseTo(dom, 0);
  });

  it.each([undefined, "24px 12px"])(
    "IllustratedMessage의 여러 줄 heading 아래 description 위치 (padding:%s)",
    async (padding) => {
      const width = 180;
      const heading = "A long heading that wraps onto several lines";
      const description = "Description after the heading";
      const style = {
        width: `${width}px`,
        height: "auto",
        ...(padding ? { padding } : {}),
      };
      const canvas = canvasHeight("IllustratedMessage", width, {
        heading,
        description,
        style,
      });
      const dom = await domHeight(
        React.createElement(IllustratedMessage, {
          heading,
          description,
          style,
        }),
        '[role="status"]',
      );
      expect(canvas).toBeCloseTo(dom, 0);

      const statuses = host.querySelectorAll<HTMLElement>('[role="status"]');
      const status = statuses[statuses.length - 1];
      const descriptionElement = status?.children[2] as HTMLElement | undefined;
      expect(status).toBeTruthy();
      expect(descriptionElement).toBeTruthy();
      const domDescriptionTop =
        descriptionElement!.getBoundingClientRect().top -
        status!.getBoundingClientRect().top;
      const size = resolveComponentRule("IllustratedMessage")!.sizes!
        .md as unknown as SizeSpec;
      const metric = resolveIllustratedMessageMetric("md", size);
      const draw = getSkiaPrimitive("illustrated_message")!;
      const shapes = draw({
        props: { heading, description, _containerWidth: width },
        size,
        visual: undefined,
        paint: { color: "{color.neutral}" } as Parameters<
          typeof draw
        >[0]["paint"],
        style,
      })!;
      const descriptionShape = shapes.find(
        (shape) => shape.id === "description",
      )!;
      if (descriptionShape.type !== "text")
        throw new Error("description shape is not text");
      expect(descriptionShape.y - metric.descLine / 2).toBeCloseTo(
        domDescriptionTop,
        0,
      );
    },
  );

  it.each(["min-content", "max-content"])(
    "텍스트 leaf의 height:%s는 내용 높이를 따른다",
    async (height) => {
      const width = 120;
      const style = {
        width: `${width}px`,
        height,
        fontSize: 14,
        lineHeight: "20px",
      };
      const canvas = canvasHeight("Text", width, {
        children: LONG_TEXT,
        style,
      });
      const dom = await domHeight(
        React.createElement(
          "div",
          { className: "intrinsic-height-text", style },
          LONG_TEXT,
        ),
        ".intrinsic-height-text",
      );
      expect(canvas).toBeCloseTo(dom, 0);
    },
  );

  it.each(["min-content", "max-content"])(
    "flex 배치에서 height:%s는 확정된 폭의 줄 수를 따른다",
    async (height) => {
      const textStyle = {
        flex: 1,
        minWidth: 0,
        height,
        fontSize: 14,
        lineHeight: "20px",
      };
      const elements = [
        {
          id: "body",
          type: "body",
          parent_id: null,
          props: { style: { width: "300px" } },
        },
        {
          id: "row",
          type: "div",
          parent_id: "body",
          props: { style: { display: "flex", width: "300px" } },
        },
        {
          id: "spacer",
          type: "div",
          parent_id: "row",
          props: { style: { width: "180px", flexShrink: 0, height: "1px" } },
        },
        {
          id: "candidate",
          type: "Text",
          parent_id: "row",
          props: { children: LONG_TEXT, style: textStyle },
        },
      ] as unknown as Element[];
      const canvas = layoutTree("body", elements, 300, 500).layout.get(
        "candidate",
      )!.height;
      const dom = await domHeight(
        React.createElement(
          "div",
          { style: { display: "flex", width: 300 } },
          React.createElement("div", {
            style: { width: 180, flexShrink: 0, height: 1 },
          }),
          React.createElement(
            "div",
            { className: "flex-intrinsic-height-text", style: textStyle },
            LONG_TEXT,
          ),
        ),
        ".flex-intrinsic-height-text",
      );
      expect(canvas).toBeCloseTo(dom, 0);
    },
  );
});

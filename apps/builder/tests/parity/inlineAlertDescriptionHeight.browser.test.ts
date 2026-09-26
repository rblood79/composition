import { beforeAll, describe, expect, it } from "vitest";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import type { Element } from "@/types/core/store.types";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { layoutTree } from "./adr923ProductionTrees";

beforeAll(async () => {
  const style = document.createElement("style");
  style.textContent = bundleCss;
  document.head.appendChild(style);
  await initEngineWasm();
});

const LONG_DESCRIPTION =
  "This is a longer description that needs to wrap across several lines in a narrow inline alert. ".repeat(
    4,
  );

function measure(descriptionText: string, descriptionHeight?: string) {
  const nodes = [
    {
      id: "body",
      type: "body",
      parent_id: null,
      page_id: "inline-alert-height",
      props: { style: { width: "240px" } },
    },
    {
      id: "alert",
      type: "InlineAlert",
      parent_id: "body",
      page_id: "inline-alert-height",
      props: { style: {} },
    },
    {
      id: "heading",
      type: "Heading",
      parent_id: "alert",
      page_id: "inline-alert-height",
      props: { children: "Heading", className: "alert-heading", style: {} },
    },
    {
      id: "description",
      type: "Description",
      parent_id: "alert",
      page_id: "inline-alert-height",
      props: {
        children: descriptionText,
        className: "react-aria-Description",
        style: descriptionHeight ? { height: descriptionHeight } : {},
      },
    },
  ] as unknown as Element[];
  const canvas = layoutTree("body", nodes, 240, 500);

  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "width:240px;display:block;position:absolute;left:0;top:0";
  const alert = document.createElement("div");
  alert.className = "react-aria-InlineAlert";
  const heading = document.createElement("div");
  heading.className = "alert-heading";
  heading.textContent = "Heading";
  const description = document.createElement("div");
  description.className = "react-aria-Description";
  description.textContent = descriptionText;
  if (descriptionHeight) description.style.height = descriptionHeight;
  alert.append(heading, description);
  wrapper.append(alert);
  document.body.append(wrapper);

  const result = {
    canvasAlert: canvas.layout.get("alert")!.height,
    canvasDescription: canvas.layout.get("description")!.height,
    domAlert: alert.getBoundingClientRect().height,
    domDescription: description.getBoundingClientRect().height,
  };
  wrapper.remove();
  return result;
}

describe("InlineAlert Description 내용 높이", () => {
  it("auto 높이는 설명 줄 수에 따라 늘고 DOM과 일치한다", () => {
    const short = measure("A short description.");
    const long = measure(LONG_DESCRIPTION);
    expect(long.domDescription).toBeGreaterThan(short.domDescription);
    expect(long.canvasDescription).toBeGreaterThan(short.canvasDescription);
    expect(long.canvasDescription).toBeCloseTo(long.domDescription, 0);
    expect(long.canvasAlert).toBeCloseTo(long.domAlert, 0);
  });

  it("100%는 부모 높이가 auto인 경우 내용 높이로 해소된다", () => {
    const result = measure(LONG_DESCRIPTION, "100%");
    expect(result.canvasDescription).toBeCloseTo(result.domDescription, 0);
    expect(result.canvasAlert).toBeCloseTo(result.domAlert, 0);
  });

  it("명시한 고정 높이는 설명이 길어도 보존한다", () => {
    const result = measure(LONG_DESCRIPTION, "24px");
    expect(result.canvasDescription).toBe(24);
    expect(result.domDescription).toBe(24);
  });
});

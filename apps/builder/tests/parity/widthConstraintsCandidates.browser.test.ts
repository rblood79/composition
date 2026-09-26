import { beforeAll, describe, expect, it } from "vitest";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import type { Element } from "@/types/core/store.types";
import { layoutTree } from "./adr923ProductionTrees";

beforeAll(async () => {
  await initEngineWasm();
});

const TEXT = "A longwordwithoutspaces and a short word";

function measure(style: Record<string, string | number | undefined>) {
  const textStyle = {
    fontFamily: "Arial",
    fontSize: "16px",
    lineHeight: "20px",
    height: "20px",
    ...style,
  };
  const elements = [
    {
      id: "body",
      type: "body",
      parent_id: null,
      props: { style: { width: "320px" } },
    },
    {
      id: "text",
      type: "Text",
      parent_id: "body",
      props: { children: TEXT, style: textStyle },
    },
  ] as unknown as Element[];
  const canvas = layoutTree("body", elements, 320, 400).layout.get(
    "text",
  )!.width;
  const host = document.createElement("div");
  host.style.cssText = "width:320px;position:absolute;left:0;top:0";
  const domNode = document.createElement("div");
  domNode.textContent = TEXT;
  Object.assign(domNode.style, textStyle);
  host.append(domNode);
  document.body.append(host);
  const dom = domNode.getBoundingClientRect().width;
  host.remove();
  return { canvas, dom };
}

describe("width/min-width/max-width intrinsic 후보", () => {
  it.each(["auto", "fit-content", "min-content", "max-content"])(
    "width:%s 텍스트 leaf",
    (width) => {
      const { canvas, dom } = measure({ width });
      expect(Math.abs(canvas - dom)).toBeLessThan(2);
    },
  );

  it.each([
    { width: "20px", minWidth: "100px" },
    { width: "300px", maxWidth: "100px" },
    { width: "20px", minWidth: "min-content" },
    { width: "20px", minWidth: "max-content" },
    { width: "300px", maxWidth: "min-content" },
    { width: "300px", maxWidth: "max-content" },
    { width: "20px", minWidth: "fit-content" },
    { width: "300px", maxWidth: "fit-content" },
  ])("폭 제약 %o", (style) => {
    const { canvas, dom } = measure(style);
    expect(Math.abs(canvas - dom)).toBeLessThan(2);
  });

  it("중첩 부모의 사용 가능한 폭으로 min-width:fit-content를 계산한다", () => {
    const elements = [
      {
        id: "body",
        type: "body",
        parent_id: null,
        props: { style: { width: "320px" } },
      },
      {
        id: "parent",
        type: "div",
        parent_id: "body",
        props: { style: { width: "160px" } },
      },
      {
        id: "text",
        type: "Text",
        parent_id: "parent",
        props: {
          children: TEXT,
          style: {
            width: "20px",
            minWidth: "fit-content",
            height: "20px",
            fontFamily: "Arial",
            fontSize: "16px",
          },
        },
      },
    ] as unknown as Element[];
    const canvas = layoutTree("body", elements, 320, 400).layout.get(
      "text",
    )!.width;
    const host = document.createElement("div");
    host.style.width = "160px";
    const text = document.createElement("div");
    text.style.cssText =
      "width:20px;min-width:fit-content;height:20px;font:16px Arial";
    text.textContent = TEXT;
    host.append(text);
    document.body.append(host);
    const dom = text.getBoundingClientRect().width;
    host.remove();
    expect(Math.abs(canvas - dom)).toBeLessThan(2);
  });

  it("고정 height인 ProgressBarValue도 부모가 투영한 긴 값의 폭을 다시 잰다", () => {
    const valueLabel = "A longer formatted progress value";
    const elements = [
      {
        id: "body",
        type: "body",
        parent_id: null,
        props: { style: { width: "320px" } },
      },
      {
        id: "progress",
        type: "ProgressBar",
        parent_id: "body",
        props: {
          value: 0,
          valueLabel,
          showValueLabel: true,
          style: { width: "240px" },
        },
      },
      {
        id: "value",
        type: "ProgressBarValue",
        parent_id: "progress",
        props: {
          children: "0",
          style: {
            width: "fit-content",
            height: "20px",
            fontSize: 14,
            fontFamily: "Arial",
            lineHeight: "20px",
            whiteSpace: "nowrap",
          },
        },
      },
      {
        id: "track",
        type: "ProgressBarTrack",
        parent_id: "progress",
        props: { style: {} },
      },
    ] as unknown as Element[];
    const canvas = Number(
      layoutTree("body", elements, 320, 400).batch.get("value")?.style
        .contentMaxWidth,
    );

    const node = document.createElement("span");
    node.style.cssText = "font:14px Arial;white-space:nowrap";
    node.textContent = valueLabel;
    document.body.append(node);
    const dom = node.getBoundingClientRect().width;
    node.remove();
    expect(Math.abs(canvas - dom)).toBeLessThan(2);
  });

  it.each([
    { width: "20px", minWidth: "min-content", expected: 100 },
    { width: "200px", maxWidth: "max-content", expected: 100 },
    { width: "20px", minWidth: "fit-content", expected: 100 },
    { width: "200px", maxWidth: "fit-content", expected: 100 },
  ])(
    "자식이 있는 컨테이너의 폭 제약 %o",
    ({ width, minWidth, maxWidth, expected }) => {
      const style = { width, height: "20px", minWidth, maxWidth };
      const elements = [
        {
          id: "body",
          type: "body",
          parent_id: null,
          props: { style: { width: "320px" } },
        },
        { id: "owner", type: "div", parent_id: "body", props: { style } },
        {
          id: "child",
          type: "div",
          parent_id: "owner",
          props: { style: { width: "100px", height: "10px" } },
        },
      ] as unknown as Element[];
      const result = layoutTree("body", elements, 320, 400);
      const canvas = result.layout.get("owner")!.width;
      const host = document.createElement("div");
      host.style.width = "320px";
      const owner = document.createElement("div");
      Object.assign(owner.style, style);
      const child = document.createElement("div");
      child.style.cssText = "width:100px;height:10px";
      owner.append(child);
      host.append(owner);
      document.body.append(host);
      const dom = owner.getBoundingClientRect().width;
      host.remove();
      expect(dom).toBe(expected);
      expect(canvas).toBeCloseTo(dom, 0);
    },
  );

  it.each(["flex", "grid"])(
    "%s 자식 컨테이너의 min-width:min-content",
    (display) => {
      const elements = [
        {
          id: "body",
          type: "body",
          parent_id: null,
          props: { style: { width: "320px" } },
        },
        {
          id: "parent",
          type: "div",
          parent_id: "body",
          props: { style: { display, width: "320px" } },
        },
        {
          id: "owner",
          type: "div",
          parent_id: "parent",
          props: { style: { width: "20px", minWidth: "min-content" } },
        },
        {
          id: "child",
          type: "div",
          parent_id: "owner",
          props: { style: { width: "100px", height: "10px" } },
        },
      ] as unknown as Element[];
      const canvas = layoutTree("body", elements, 320, 400).layout.get(
        "owner",
      )!.width;
      const parent = document.createElement("div");
      parent.style.cssText = `display:${display};width:320px`;
      const owner = document.createElement("div");
      owner.style.cssText = "width:20px;min-width:min-content";
      const child = document.createElement("div");
      child.style.cssText = "width:100px;height:10px";
      owner.append(child);
      parent.append(owner);
      document.body.append(parent);
      const dom = owner.getBoundingClientRect().width;
      parent.remove();
      expect(canvas).toBeCloseTo(dom, 0);
    },
  );
});

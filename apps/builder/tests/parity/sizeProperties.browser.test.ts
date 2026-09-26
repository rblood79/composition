import { beforeAll, describe, expect, it } from "vitest";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import type { Element } from "@/types/core/store.types";
import { layoutTree } from "./adr923ProductionTrees";

beforeAll(async () => {
  await initEngineWasm();
});

describe("크기 속성의 축별 CSS 계약", () => {
  it.each([
    { width: "300px", maxWidth: "100px", height: "auto" },
    { width: "20px", minWidth: "100px", height: "auto" },
    {
      width: "300px",
      maxWidth: "100px",
      height: "10px",
      minHeight: "min-content",
    },
  ])("확정 폭 제약에서 텍스트 높이를 재측정한다: %o", compareHeight);

  it.each(["min-content", "max-content", "fit-content"])(
    "고정 높이 + min-height:%s",
    (minHeight) => compareHeight({ height: "10px", minHeight }),
  );
  it.each(["min-content", "max-content", "fit-content"])(
    "고정 높이 + max-height:%s",
    (maxHeight) => compareHeight({ height: "300px", maxHeight }),
  );

  it.each(["block", "flex", "grid"])(
    "%s 컨테이너의 intrinsic 높이 제약",
    (display) => {
      const elements = [
        {
          id: "body",
          type: "body",
          parent_id: null,
          props: { style: { width: "320px" } },
        },
        {
          id: "owner",
          type: "div",
          parent_id: "body",
          props: {
            style: {
              display,
              width: "100px",
              height: "10px",
              minHeight: "min-content",
              padding: "10px",
            },
          },
        },
        {
          id: "child",
          type: "div",
          parent_id: "owner",
          props: { style: { width: "60px", height: "40px", flexShrink: 0 } },
        },
      ] as unknown as Element[];
      compareTree(elements, "owner");
    },
  );

  it("flex 축소 후 wrap 컨테이너의 실제 폭으로 intrinsic 높이를 잰다", () => {
    const elements = [
      {
        id: "body",
        type: "body",
        parent_id: null,
        props: { style: { display: "flex", width: "100px" } },
      },
      {
        id: "owner",
        type: "div",
        parent_id: "body",
        props: {
          style: {
            display: "flex",
            flexWrap: "wrap",
            width: "200px",
            height: "10px",
            minWidth: 0,
            minHeight: "min-content",
          },
        },
      },
      ...["one", "two"].map((id) => ({
        id,
        type: "div",
        parent_id: "owner",
        props: { style: { width: "60px", height: "20px", flexShrink: 0 } },
      })),
    ] as unknown as Element[];
    compareTree(elements, "owner", 100);
  });
});

function compareTree(elements: Element[], target: string, width = 320) {
  const result = layoutTree("body", elements, width, 400).layout.get(target)!;
  const nodes = new Map<string, HTMLDivElement>();
  for (const element of elements) {
    const node = document.createElement("div");
    node.style.boxSizing = "border-box";
    Object.assign(node.style, element.props?.style);
    nodes.set(element.id, node);
    if (element.parent_id) nodes.get(element.parent_id)!.append(node);
  }
  const root = nodes.get("body")!;
  document.body.append(root);
  const dom = nodes.get(target)!.getBoundingClientRect();
  root.remove();
  expect(result.width).toBeCloseTo(dom.width, 0);
  expect(result.height).toBeCloseTo(dom.height, 0);
}

function compareHeight(constraint: Record<string, string | undefined>) {
  const content =
    "A long sentence that wraps across several lines in this narrow text box.";
  const style = {
    width: "100px",
    fontFamily: "Arial",
    fontSize: "16px",
    lineHeight: "20px",
    ...constraint,
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
      props: { children: content, style },
    },
  ] as unknown as Element[];
  const canvas = layoutTree("body", elements, 320, 400).layout.get(
    "text",
  )!.height;
  const host = document.createElement("div");
  host.style.width = "320px";
  const text = document.createElement("div");
  Object.assign(text.style, style);
  text.textContent = content;
  host.append(text);
  document.body.append(host);
  const dom = text.getBoundingClientRect().height;
  host.remove();
  expect(canvas).toBeCloseTo(dom, 0);
}

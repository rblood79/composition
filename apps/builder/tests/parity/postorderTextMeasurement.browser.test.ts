import { beforeAll, describe, expect, it, vi } from "vitest";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import { PersistentLayoutTree } from "@/builder/workspace/canvas/layout/engines/persistentLayoutTree";
import {
  getTextMeasurer,
  setTextMeasurer,
  type TextMeasurer,
} from "@/builder/workspace/canvas/utils/textMeasure";
import type { Element } from "@/types/core/store.types";
import { layoutTree } from "./adr923ProductionTrees";

beforeAll(async () => {
  await initEngineWasm();
});

function measureProgressValue(valueLabel: string, initialChildren = "0") {
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
        children: initialChildren,
        style: {
          width: "fit-content",
          height: "auto",
          fontSize: 14,
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
  const { batch, layout } = layoutTree("body", elements, 320, 500);
  return {
    maxWidth: Number(batch.get("value")?.style.contentMaxWidth),
    height: layout.get("value")?.height,
  };
}

describe("post-order 부모 텍스트 투영", () => {
  it("ProgressBarValue의 최종 valueLabel로 intrinsic 폭을 측정한다", () => {
    const short = measureProgressValue("0");
    const long = measureProgressValue("A longer formatted progress value");
    expect(Number.isFinite(short.maxWidth)).toBe(true);
    expect(long.maxWidth).toBeGreaterThan(short.maxWidth + 80);
  });

  it("부모가 값 텍스트를 비우면 이전 leaf 높이를 남기지 않는다", () => {
    const empty = measureProgressValue("", "Previously visible value");
    const initiallyEmpty = measureProgressValue("", "");
    expect(empty.height).toBe(initiallyEmpty.height);
  });

  it("폭 확정 뒤 재측정에도 부모의 whiteSpace 상속을 유지한다", () => {
    const elements = [
      {
        id: "body",
        type: "body",
        parent_id: null,
        props: { style: { width: "150px" } },
      },
      {
        id: "row",
        type: "div",
        parent_id: "body",
        props: {
          style: {
            width: "150px",
            display: "flex",
            whiteSpace: "pre",
          },
        },
      },
      {
        id: "text",
        type: "Text",
        parent_id: "row",
        props: {
          children: "This is a long first line\nand another long second line",
          style: { flexGrow: 1, minWidth: 0 },
        },
      },
      {
        id: "side",
        type: "div",
        parent_id: "row",
        props: {
          style: { width: "50px", height: "20px", flexShrink: 0 },
        },
      },
    ] as unknown as Element[];
    const writes = vi.spyOn(PersistentLayoutTree.prototype, "updateNodeStyle");
    const { layout } = layoutTree("body", elements, 150, 500);
    const secondPassTextWrites = writes.mock.calls.filter(
      ([id]) => id === "text",
    );
    writes.mockRestore();
    expect(secondPassTextWrites.length).toBeGreaterThan(0);
    expect(layout.get("text")?.width).toBeCloseTo(100, 0);
    expect(layout.get("text")?.height).toBe(48);

    const normalElements = elements.map((element) =>
      element.id === "text"
        ? ({
            ...element,
            props: {
              ...element.props,
              style: {
                ...((element.props?.style ?? {}) as Record<string, unknown>),
                whiteSpace: "normal",
              },
            },
          } as Element)
        : element,
    );
    const normal = layoutTree("body", normalElements, 150, 500);
    expect(normal.layout.get("text")?.height).toBeGreaterThan(48);
  });

  it("GridListItem이 주입한 fontWeight로 자식 Text 폭 스칼라를 다시 측정한다", () => {
    const previous = getTextMeasurer();
    const weightedMeasurer: TextMeasurer = {
      measureWidth: (text, style) =>
        text.length * (Number(style.fontWeight) === 600 ? 20 : 10),
      measureWrapped: (text, style, width) => ({
        width: Math.min(
          width,
          text.length * (Number(style.fontWeight) === 600 ? 20 : 10),
        ),
        height:
          Math.max(
            1,
            Math.ceil(
              (text.length * (Number(style.fontWeight) === 600 ? 20 : 10)) /
                width,
            ),
          ) * (style.lineHeight ?? 24),
      }),
    };
    setTextMeasurer(weightedMeasurer);
    try {
      const elements = [
        {
          id: "body",
          type: "body",
          parent_id: null,
          props: { style: { width: "180px" } },
        },
        {
          id: "item",
          type: "GridListItem",
          parent_id: "body",
          props: { style: { width: "120px" } },
        },
        {
          id: "label",
          type: "Text",
          parent_id: "item",
          props: {
            children: "abcdefghij",
            slot: "label",
            style: { width: "100%", fontSize: 16, lineHeight: "24px" },
          },
        },
      ] as unknown as Element[];
      const { batch } = layoutTree("body", elements, 180, 500);
      expect(batch.get("label")?.style.contentMaxWidth).toBe(200);
    } finally {
      setTextMeasurer(previous);
    }
  });
});

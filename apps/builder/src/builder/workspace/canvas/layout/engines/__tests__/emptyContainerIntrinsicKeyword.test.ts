import { describe, expect, it } from "vitest";

import type { CanvasLayoutNode } from "../../layoutNode";
import { enrichWithIntrinsicSize } from "../utils";

// 사용자 보고 (2026-09-19): 같은 frame (padding 20 · width fit-content) 이 자식이 있으면 두 leg 가
// 같고, 자식이 없으면 Canvas 120 / DOM 40. 자식 0 이면 `calculateContentWidth` 가 §6
// `DEFAULT_WIDTH` 80 으로 떨어져 width 120 + minWidth 120 이 주입됐다. 비-측정 컨테이너의
// 키워드는 자식 수와 무관하게 엔진 소유 (content 0 + padding = DOM 과 같은 40).
const frame = (style: Record<string, unknown>): CanvasLayoutNode =>
  ({
    id: "frame-1",
    type: "frame",
    props: { style },
  }) as CanvasLayoutNode;

const enrich = (node: CanvasLayoutNode, isFlexChild = true) =>
  (enrichWithIntrinsicSize(node, 400, 300, undefined, [], () => [], isFlexChild)
    .props?.style ?? {}) as Record<string, unknown>;

describe("빈 컨테이너의 intrinsic width 키워드는 엔진 소유", () => {
  it("자식 0 인 fit-content frame 은 키워드를 통과시키고 width/minWidth 를 주입하지 않는다 (flex 자식)", () => {
    const style = enrich(
      frame({ display: "block", width: "fit-content", padding: "20px" }),
    );
    expect(style.width).toBe("fit-content");
    expect(style.minWidth).toBeUndefined();
  });

  it("block 자식이어도 같다", () => {
    const style = enrich(
      frame({ display: "block", width: "fit-content", padding: "20px" }),
      false,
    );
    expect(style.width).toBe("fit-content");
    expect(style.minWidth).toBeUndefined();
  });

  it("측정 leaf (button) 의 fit-content 는 종전대로 TS 가 폭을 공급한다", () => {
    const style = (enrichWithIntrinsicSize(
      {
        id: "b",
        type: "Button",
        props: { children: "OK", size: "md", style: { width: "fit-content" } },
      } as CanvasLayoutNode,
      400,
      300,
      undefined,
      [],
      () => [],
      false,
    ).props?.style ?? {}) as Record<string, unknown>;
    expect(typeof style.width).toBe("number");
  });
});

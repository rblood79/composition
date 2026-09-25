import { describe, expect, it } from "vitest";
import { applyEditToSlotFill } from "../slotFillEdit";

describe("applyEditToSlotFill — mode C 채운 노드 편집", () => {
  const descendants = {
    Content: {
      children: [
        {
          id: "fill-a",
          type: "Button",
          props: { children: "A", style: { paddingTop: 8, width: "100%" } },
        },
      ],
    },
  };

  it("style 의 `undefined` (synthetic 쓰기의 지움) 는 채운 노드에서 그 키를 삭제한다", () => {
    const next = applyEditToSlotFill(descendants, "Content/fill-a", {
      style: { paddingTop: undefined, borderRadius: 4 },
    }) as { Content: { children: Array<{ props: Record<string, unknown> }> } };
    const style = next.Content.children[0].props.style as Record<
      string,
      unknown
    >;
    expect("paddingTop" in style).toBe(false);
    expect(style).toEqual({ width: "100%", borderRadius: 4 });
  });
});

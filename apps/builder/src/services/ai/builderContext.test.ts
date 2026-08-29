import { describe, expect, it } from "vitest";
import {
  buildBuilderContext,
  type BuilderContextNode,
  type BuilderContextSource,
} from "./builderContext";

const el = (
  id: string,
  type: string,
  page: string,
  props: Record<string, unknown> = {},
) => ({ id, type, page_id: page, props, parent_id: "body" }) as BuilderContextNode;

function source(
  elements: BuilderContextNode[],
  state: BuilderContextSource["state"],
): BuilderContextSource {
  return {
    elements,
    elementsById: new Map(elements.map((e) => [e.id, e])),
    state,
  };
}

describe("buildBuilderContext", () => {
  it("빈 문서에서도 컨텍스트를 만든다 — 준비 안 됨 상태가 없다", () => {
    const context = buildBuilderContext(source([], {}));

    expect(context.currentPageId).toBe("default");
    expect(context.elements).toEqual([]);
    expect(context.selectedElement).toBeUndefined();
  });

  it("현재 페이지 요소만, 식별 정보로만 싣는다", () => {
    const context = buildBuilderContext(
      source(
        [el("b1", "Button", "page-1"), el("t9", "Text", "page-2")],
        { currentPageId: "page-1" },
      ),
    );

    expect(context.elements).toEqual([{ id: "b1", type: "Button" }]);
  });

  it("삭제된 요소는 빼고 센다", () => {
    const gone = { ...el("d1", "Text", "page-1"), deleted: true };

    const context = buildBuilderContext(
      source([el("b1", "Button", "page-1"), gone], {
        currentPageId: "page-1",
      }),
    );

    expect(context.elements).toEqual([{ id: "b1", type: "Button" }]);
  });

  /** 선택 요소의 props 는 프롬프트에 그대로 실린다 — canonical 정본에서 와야 한다. */
  it("선택 요소 상세를 canonical 값 그대로 싣는다", () => {
    const context = buildBuilderContext(
      source([el("b1", "Button", "page-1", { children: "최신값" })], {
        currentPageId: "page-1",
        selectedElementId: "b1",
      }),
    );

    expect(context.selectedElement?.props).toEqual({ children: "최신값" });
  });

  it("선택 요소가 문서에 없으면 상세를 비운다", () => {
    const context = buildBuilderContext(
      source([], { currentPageId: "page-1", selectedElementId: "gone" }),
    );

    expect(context.selectedElementId).toBe("gone");
    expect(context.selectedElement).toBeUndefined();
  });
});

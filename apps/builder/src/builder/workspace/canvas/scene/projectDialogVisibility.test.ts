import { describe, expect, it } from "vitest";
import type { CanvasSceneNode } from "./canvasSceneNode";
import { projectDialogVisibility } from "./projectDialogVisibility";
const nodes = [
  { id: "root", type: "DialogTrigger", props: {} },
  { id: "button", type: "Button", parent_id: "root", props: {} },
  { id: "dialog", type: "Dialog", parent_id: "root", props: {} },
  { id: "text", type: "Text", parent_id: "dialog", props: {} },
] as CanvasSceneNode[];
describe("Dialog Canvas 표현", () => {
  it("일반 페이지는 버튼만, Components는 본문을 함께 표시한다", () => {
    expect(projectDialogVisibility(nodes, false).map((n) => n.id)).toEqual([
      "root",
      "button",
    ]);
    expect(projectDialogVisibility(nodes, true)).toBe(nodes);
    expect(nodes[0].props).toEqual({});
  });
  it("Open 상태는 일반 페이지에서도 본문 편집을 허용한다", () => {
    const opened = [
      { ...nodes[0], props: { isOpen: true } },
      ...nodes.slice(1),
    ];
    expect(projectDialogVisibility(opened, false)).toBe(opened);
  });
  it("노드 순서와 무관하게 닫힌 본문의 모든 자손을 제외한다", () => {
    expect(
      projectDialogVisibility([...nodes].reverse(), false).map((n) => n.id),
    ).toEqual(["button", "root"]);
  });
});

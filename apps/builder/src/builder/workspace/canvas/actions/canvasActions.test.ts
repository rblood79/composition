import { afterEach, describe, expect, it, vi } from "vitest";
import { useStore } from "../../../stores";
import type { CanvasActionElement } from "./canvasActions";
import {
  alignSelection,
  buildCanvasActionElementsMap,
  copySelection,
  cutSelection,
  deleteSelection,
  distributeSelection,
  duplicateSelection,
  groupSelection,
  paste,
  ungroupSelection,
} from "./canvasActions";

function makeElement(
  id: string,
  overrides: Partial<CanvasActionElement> = {},
): CanvasActionElement {
  return {
    id,
    type: "Button",
    props: {},
    parent_id: null,
    page_id: "page-1",
    ...overrides,
  };
}

// `useStore.setState` 는 새 state 객체를 만들면서 **mock 함수까지 복사**한다.
// 그래서 `vi.restoreAllMocks()` 가 복원한 것은 버려진 옛 객체이고, 다음 테스트는
// 이전 테스트의 spy 를 그대로 물려받는다 (호출 기록 포함). 원본 액션 참조를
// 잡아 두고 afterEach 에서 명시적으로 되돌린다.
const originalStoreActions = {
  removeElements: useStore.getState().removeElements,
  // addElement/setSelectedElements 도 같은 이유로 되돌린다 — 되돌리지 않으면
  // 다음 테스트의 `vi.spyOn` 이 앞 테스트의 mock 을 그대로 감싸 호출 기록까지
  // 물려받는다 (2026-08-27: body 복제 회귀 테스트가 이 누수로 처음 실패).
  addElement: useStore.getState().addElement,
  setSelectedElements: useStore.getState().setSelectedElements,
} as const;

afterEach(() => {
  vi.restoreAllMocks();
  useStore.setState({
    ...originalStoreActions,
    currentPageId: null,
    multiSelectMode: false,
    selectedElementId: null,
    selectedElementIds: [],
  } as never);
});

describe("canvasActions", () => {
  it("normalizes panel and interactive map aliases to one action shape", () => {
    const panelMap = new Map<string, CanvasActionElement>([
      ["parent", makeElement("parent")],
      [
        "child",
        makeElement("child", { parent_id: "parent", page_id: "page-2" }),
      ],
    ]);
    const interactiveMap = new Map<string, CanvasActionElement>([
      ["parent", makeElement("parent", { parentId: null, pageId: "page-1" })],
      [
        "child",
        makeElement("child", {
          parent_id: undefined,
          page_id: undefined,
          parentId: "parent",
          pageId: "page-2",
        }),
      ],
    ]);

    expect(
      Array.from(buildCanvasActionElementsMap(panelMap).entries()),
    ).toEqual(
      Array.from(buildCanvasActionElementsMap(interactiveMap).entries()),
    );
  });

  it("uses the injected map for copy selection", async () => {
    useStore.setState({
      currentPageId: "page-1",
      selectedElementIds: ["child"],
    } as never);
    const writeClipboardText = vi.fn<(text: string) => Promise<boolean>>(
      async (_text) => true,
    );
    const elementsMap = new Map<string, CanvasActionElement>([
      ["child", makeElement("child")],
    ]);

    await copySelection({ elementsMap, writeClipboardText });

    expect(writeClipboardText).toHaveBeenCalledTimes(1);
    expect(JSON.parse(writeClipboardText.mock.calls[0][0])).toMatchObject({
      rootIds: ["child"],
    });
  });

  it("cut copies then deletes", async () => {
    useStore.setState({
      currentPageId: "page-1",
      selectedElementId: "child",
      selectedElementIds: ["child"],
    } as never);
    const removeElements = vi
      .spyOn(useStore.getState(), "removeElements")
      .mockResolvedValue(undefined);
    const writeClipboardText = vi.fn<(text: string) => Promise<boolean>>(
      async (_text) => true,
    );
    const elementsMap = new Map<string, CanvasActionElement>([
      ["child", makeElement("child")],
    ]);

    await cutSelection({ elementsMap, writeClipboardText });

    expect(writeClipboardText).toHaveBeenCalledTimes(1);
    expect(removeElements).toHaveBeenCalledWith(["child"]);
  });

  it("cut does not delete when the clipboard write fails", async () => {
    // 복사가 실패했는데 지우면 되돌릴 곳 없이 내용이 사라진다.
    useStore.setState({
      currentPageId: "page-1",
      selectedElementId: "child",
      selectedElementIds: ["child"],
    } as never);
    const removeElements = vi
      .spyOn(useStore.getState(), "removeElements")
      .mockResolvedValue(undefined);
    const writeClipboardText = vi.fn<(text: string) => Promise<boolean>>(
      async (_text) => false,
    );
    const elementsMap = new Map<string, CanvasActionElement>([
      ["child", makeElement("child")],
    ]);

    await cutSelection({ elementsMap, writeClipboardText });

    expect(writeClipboardText).toHaveBeenCalledTimes(1);
    expect(removeElements).not.toHaveBeenCalled();
  });

  it("keeps no-op guards for all eight extracted actions", async () => {
    const state = useStore.getState();
    const addElement = vi.spyOn(state, "addElement");
    const removeElement = vi.spyOn(state, "removeElement");
    const removeElements = vi.spyOn(state, "removeElements");
    const updateElement = vi.spyOn(state, "updateElement");
    const batchUpdateElementProps = vi.spyOn(state, "batchUpdateElementProps");
    const writeClipboardText = vi.fn<(text: string) => Promise<boolean>>(
      async (_text) => true,
    );
    const readClipboardText = vi.fn(async () => null);
    const context = {
      elementsMap: new Map<string, CanvasActionElement>(),
      readClipboardText,
      writeClipboardText,
    };

    await copySelection(context);
    await paste(context);
    await duplicateSelection(context);
    await deleteSelection(context);
    await groupSelection(context);
    await ungroupSelection(context);
    await alignSelection(context, "left");
    await distributeSelection(context, "horizontal");

    expect(writeClipboardText).not.toHaveBeenCalled();
    expect(readClipboardText).not.toHaveBeenCalled();
    expect(addElement).not.toHaveBeenCalled();
    expect(removeElement).not.toHaveBeenCalled();
    expect(removeElements).not.toHaveBeenCalled();
    expect(updateElement).not.toHaveBeenCalled();
    expect(batchUpdateElementProps).not.toHaveBeenCalled();
  });
});

describe("duplicateSelection — ADR-182 후속 (2026-08-27)", () => {
  it("단일 선택 · multiSelectMode=false 에서도 복제하고 새 요소를 선택한다", async () => {
    useStore.setState({
      currentPageId: "page-1",
      multiSelectMode: false,
      selectedElementId: "a",
      selectedElementIds: ["a"],
    } as never);
    const state = useStore.getState();
    const addElement = vi
      .spyOn(state, "addElement")
      .mockResolvedValue(undefined as never);
    const setSelectedElements = vi.spyOn(state, "setSelectedElements");
    const context = {
      elementsMap: new Map<string, CanvasActionElement>([
        ["a", makeElement("a")],
      ]),
    };

    await duplicateSelection(context);

    expect(addElement).toHaveBeenCalledTimes(1);
    const created = addElement.mock.calls[0][0] as { id: string };
    expect(created.id).not.toBe("a");
    expect(setSelectedElements).toHaveBeenCalledWith([created.id]);
  });

  // 2026-08-27 code-review #1 — multiSelectMode 게이트 제거로 body 단독 선택이
  // 복제 경로에 처음 도달했다. 씬은 두 번째 body 를 버리지만 문서에는 남고
  // deleteSelection 이 body 를 거부해 undo 외엔 지울 수 없다.
  it("body 단독 선택은 복제하지 않는다 (deleteSelection 과 같은 필터)", async () => {
    useStore.setState({
      currentPageId: "page-1",
      multiSelectMode: false,
      selectedElementId: "body-1",
      selectedElementIds: ["body-1"],
    } as never);
    const state = useStore.getState();
    const addElement = vi
      .spyOn(state, "addElement")
      .mockResolvedValue(undefined as never);
    const setSelectedElements = vi.spyOn(state, "setSelectedElements");
    const context = {
      elementsMap: new Map<string, CanvasActionElement>([
        ["body-1", makeElement("body-1", { type: "body" })],
        ["a", makeElement("a", { parent_id: "body-1" })],
      ]),
    };

    await duplicateSelection(context);

    expect(addElement).not.toHaveBeenCalled();
    expect(setSelectedElements).not.toHaveBeenCalled();
  });

  it("body 가 섞인 다중 선택(⌘A)은 body 를 빼고 나머지만 복제한다", async () => {
    useStore.setState({
      currentPageId: "page-1",
      multiSelectMode: true,
      selectedElementId: "body-1",
      selectedElementIds: ["body-1", "a", "b"],
    } as never);
    const state = useStore.getState();
    const addElement = vi
      .spyOn(state, "addElement")
      .mockResolvedValue(undefined as never);
    const context = {
      elementsMap: new Map<string, CanvasActionElement>([
        ["body-1", makeElement("body-1", { type: "body" })],
        ["a", makeElement("a", { parent_id: "body-1" })],
        ["b", makeElement("b", { parent_id: "body-1" })],
      ]),
    };

    await duplicateSelection(context);

    const createdTypes = addElement.mock.calls.map(
      (call) => (call[0] as { type: string }).type,
    );
    expect(createdTypes).toHaveLength(2);
    expect(createdTypes).not.toContain("body");
  });
});

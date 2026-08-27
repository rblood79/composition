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

/**
 * 2026-08-27 관찰 — `alignSelection` / `distributeSelection` / `groupSelection`
 * 은 `selectedElementIds` 를 그대로 썼다. ⌘A 는 body 까지 선택하므로 페이지
 * 루트가 정렬 대상(좌표 기록)·분배 고정점·그룹 자식이 됐다. 복제/삭제와 같은
 * body 필터를 세 경로에도 적용한다.
 */
describe("선택 행동의 body 필터 (2026-08-27 관찰)", () => {
  const boxed = (id: string, left: number, top: number) =>
    makeElement(id, {
      parent_id: "body-1",
      props: {
        style: {
          left: `${left}px`,
          top: `${top}px`,
          width: "10px",
          height: "10px",
        },
      },
    });

  function seed(ids: string[]) {
    useStore.setState({
      currentPageId: "page-1",
      multiSelectMode: true,
      selectedElementId: ids[0],
      selectedElementIds: ids,
    } as never);
    return {
      elementsMap: new Map<string, CanvasActionElement>([
        [
          "body-1",
          makeElement("body-1", {
            type: "body",
            props: {
              style: {
                left: "0px",
                top: "0px",
                width: "500px",
                height: "500px",
              },
            },
          }),
        ],
        ["a", boxed("a", 40, 10)],
        ["b", boxed("b", 90, 30)],
        ["c", boxed("c", 200, 60)],
      ]),
    };
  }

  it("copySelection 은 body 를 빼고 복사한다 — ⌘A→⌘C→⌘V 가 두 번째 body 를 만들지 않는다", async () => {
    const context = seed(["body-1", "a", "b"]);
    const writeClipboardText = vi.fn<(text: string) => Promise<boolean>>(
      async () => true,
    );

    await copySelection({ ...context, writeClipboardText });

    expect(writeClipboardText).toHaveBeenCalledTimes(1);
    const copied = JSON.parse(writeClipboardText.mock.calls[0][0]);
    expect(copied.rootIds).toEqual(["a", "b"]);
    expect(
      copied.elements.map((element: { id: string }) => element.id),
    ).not.toContain("body-1");
  });

  it("body 단독 선택은 복사하지 않는다 (클립보드 쓰기 0회)", async () => {
    const context = seed(["body-1"]);
    const writeClipboardText = vi.fn<(text: string) => Promise<boolean>>(
      async () => true,
    );

    const copied = await copySelection({ ...context, writeClipboardText });

    expect(copied).toBe(false);
    expect(writeClipboardText).not.toHaveBeenCalled();
  });

  it("alignSelection 은 body 를 제외하고 나머지만 정렬한다", async () => {
    const context = seed(["body-1", "a", "b"]);
    const batchUpdateElementProps = vi
      .spyOn(useStore.getState(), "batchUpdateElementProps")
      .mockResolvedValue(undefined as never);

    await alignSelection(context, "left");

    expect(batchUpdateElementProps).toHaveBeenCalledTimes(1);
    const updates = batchUpdateElementProps.mock.calls[0][0] as Array<{
      elementId: string;
      props: { style: Record<string, unknown> };
    }>;
    expect(updates.map((u) => u.elementId).sort()).toEqual(["a", "b"]);
    // body 를 함께 넘겼다면 가장 왼쪽(0px)인 body 가 기준이 됐을 것이다
    expect(updates.every((u) => u.props.style.left === "40px")).toBe(true);
  });

  it("body + 요소 1개 선택은 정렬하지 않는다 (남는 대상이 1개)", async () => {
    const context = seed(["body-1", "a"]);
    const batchUpdateElementProps = vi
      .spyOn(useStore.getState(), "batchUpdateElementProps")
      .mockResolvedValue(undefined as never);

    await alignSelection(context, "left");

    expect(batchUpdateElementProps).not.toHaveBeenCalled();
  });

  it("distributeSelection 은 body 를 뺀 개수로 최소 3개를 판정한다", async () => {
    const twoLeft = seed(["body-1", "a", "b"]);
    const batchUpdateElementProps = vi
      .spyOn(useStore.getState(), "batchUpdateElementProps")
      .mockResolvedValue(undefined as never);

    await distributeSelection(twoLeft, "horizontal");
    expect(batchUpdateElementProps).not.toHaveBeenCalled();

    const threeLeft = seed(["body-1", "a", "b", "c"]);
    await distributeSelection(threeLeft, "horizontal");
    expect(batchUpdateElementProps).toHaveBeenCalledTimes(1);
    const updates = batchUpdateElementProps.mock.calls[0][0] as Array<{
      elementId: string;
    }>;
    expect(updates.map((u) => u.elementId)).not.toContain("body-1");
  });

  it("groupSelection 은 body 를 새 frame 의 자식으로 넣지 않는다", async () => {
    const context = seed(["body-1", "a", "b"]);
    const state = useStore.getState();
    vi.spyOn(state, "addElement").mockResolvedValue(undefined as never);
    const updateElement = vi
      .spyOn(state, "updateElement")
      .mockResolvedValue(undefined as never);
    vi.spyOn(state, "setSelectedElement").mockReturnValue(undefined as never);

    await groupSelection(context);

    const reparented = updateElement.mock.calls.map((call) => call[0]);
    expect(reparented.sort()).toEqual(["a", "b"]);
  });
});

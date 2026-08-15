import { afterEach, describe, expect, it, vi } from "vitest";
import { useStore } from "../../../stores";
import type { CanvasActionElement } from "./canvasActions";
import {
  alignSelection,
  buildCanvasActionElementsMap,
  copySelection,
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

afterEach(() => {
  vi.restoreAllMocks();
  useStore.setState({
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

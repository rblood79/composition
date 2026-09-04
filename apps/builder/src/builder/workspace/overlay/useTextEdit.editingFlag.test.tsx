// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "../../../adapters/canonical/canonicalMutations";
import { useStore } from "../../stores";
import { useCanvasStore } from "../../stores/canvasStore";
import { useCanonicalDocumentStore } from "../../stores/canonical/canonicalDocumentStore";
import { useTextEdit } from "./useTextEdit";

vi.mock("../../../lib/db", () => ({
  getDB: vi.fn(async () => ({
    documents: { put: vi.fn() },
  })),
}));

/**
 * 2026-08-27 code-review #6 — `isEditing` 은 `useCanvasStore` 싱글턴이고
 * 내려가는 경로가 completeEdit/cancelEdit 뿐이었다. 마우스 클릭은
 * TextEditOverlay 의 document mousedown 이 먼저 완료를 부르지만, 비-마우스
 * 경로(브라우저 Back, compare 모드 토글)로 BuilderCanvas 가 사라지면 true 가
 * 남아 ADR-192 액션 바가 다시는 마운트되지 않는다.
 */
const TEXT_ELEMENT = {
  id: "text-1",
  type: "Text",
  props: { children: "hello" },
  parent_id: null,
  page_id: "page-1",
} as const;

const OTHER_TEXT_ELEMENT = {
  ...TEXT_ELEMENT,
  id: "text-2",
  props: { children: "other" },
} as const;

afterEach(() => {
  resetCanonicalMutationStoreActions();
  useCanvasStore.getState().setEditing(false);
  useStore.setState({ elements: [], elementsMap: new Map() } as never);
  useCanonicalDocumentStore.setState({
    documents: new Map(),
    currentProjectId: null,
    documentVersion: 0,
  });
});

describe("useTextEdit — 편집 플래그 회수", () => {
  it("편집 중 언마운트되면 isEditing 을 false 로 되돌린다", () => {
    useStore.setState({
      elements: [TEXT_ELEMENT],
      elementsMap: new Map([[TEXT_ELEMENT.id, TEXT_ELEMENT]]),
    } as never);

    const { result, unmount } = renderHook(() => useTextEdit());

    act(() => {
      result.current.startEdit(TEXT_ELEMENT.id);
    });
    expect(useCanvasStore.getState().isEditing).toBe(true);

    // completeEdit / cancelEdit 없이 사라지는 경로
    unmount();

    expect(useCanvasStore.getState().isEditing).toBe(false);
  });

  it("편집을 시작한 적이 없으면 언마운트가 플래그를 건드리지 않는다", () => {
    // 다른 소유자가 편집 중인 상태를 가로채 내리지 않는지 확인
    useCanvasStore.getState().setEditing(true, "someone-else");

    const { unmount } = renderHook(() => useTextEdit());
    unmount();

    expect(useCanvasStore.getState().isEditing).toBe(true);
  });

  it("다른 selection ID의 update와 cancel은 현재 편집 세션을 바꾸지 않는다", () => {
    useStore.setState({
      elements: [TEXT_ELEMENT, OTHER_TEXT_ELEMENT],
      elementsMap: new Map<string, unknown>([
        [TEXT_ELEMENT.id, TEXT_ELEMENT] as const,
        [OTHER_TEXT_ELEMENT.id, OTHER_TEXT_ELEMENT] as const,
      ]),
    } as never);

    const { result } = renderHook(() => useTextEdit());

    act(() => {
      result.current.startEdit(TEXT_ELEMENT.id);
      result.current.updateText(TEXT_ELEMENT.id, "draft");
      result.current.updateText(OTHER_TEXT_ELEMENT.id, "stale");
      result.current.cancelEdit(OTHER_TEXT_ELEMENT.id);
    });

    expect(result.current.editState).toMatchObject({
      elementId: TEXT_ELEMENT.id,
      value: "draft",
    });
    expect(useStore.getState().elements).toEqual([
      { ...TEXT_ELEMENT, props: { children: "draft" } },
      OTHER_TEXT_ELEMENT,
    ]);
    expect(useCanvasStore.getState().isEditing).toBe(true);

    act(() => {
      result.current.cancelEdit(TEXT_ELEMENT.id);
    });

    expect(useStore.getState().elements).toEqual([
      TEXT_ELEMENT,
      OTHER_TEXT_ELEMENT,
    ]);
    expect(useCanvasStore.getState().isEditing).toBe(false);
  });

  it("다른 selection ID의 complete는 무시하고 현재 편집 요소만 commit한다", () => {
    registerCanonicalMutationStoreActions({
      getCurrentProjectId: () => "text-project",
      getCurrentLegacySnapshot: () => ({
        elements: useStore.getState().elements,
        pages: [],
        layouts: [],
      }),
    });
    useCanonicalDocumentStore.setState({
      documents: new Map([
        [
          "text-project",
          {
            version: "composition-1.0",
            children: [TEXT_ELEMENT, OTHER_TEXT_ELEMENT].map((element) => ({
              id: element.id,
              type: element.type,
              props: element.props,
              children: [],
            })),
          },
        ],
      ]),
      currentProjectId: "text-project",
      documentVersion: 1,
    } as never);
    useStore.setState({
      elements: [TEXT_ELEMENT, OTHER_TEXT_ELEMENT],
      elementsMap: new Map<string, unknown>([
        [TEXT_ELEMENT.id, TEXT_ELEMENT] as const,
        [OTHER_TEXT_ELEMENT.id, OTHER_TEXT_ELEMENT] as const,
      ]),
    } as never);

    const { result } = renderHook(() => useTextEdit());

    act(() => {
      result.current.startEdit(TEXT_ELEMENT.id);
      result.current.updateText(TEXT_ELEMENT.id, "draft");
    });

    const liveDocument = useCanonicalDocumentStore
      .getState()
      .getDocument("text-project");
    if (!liveDocument) throw new Error("canonical text fixture missing");
    useCanonicalDocumentStore.getState().setDocument("text-project", {
      ...liveDocument,
      children: liveDocument.children.map((node) =>
        node.id === TEXT_ELEMENT.id
          ? { ...node, props: { ...node.props, external: "preserved" } }
          : node,
      ),
    });

    act(() => {
      result.current.updateText(TEXT_ELEMENT.id, "committed");
      result.current.completeEdit(OTHER_TEXT_ELEMENT.id);
    });

    expect(result.current.editState?.elementId).toBe(TEXT_ELEMENT.id);
    expect(useCanvasStore.getState().isEditing).toBe(true);

    act(() => {
      result.current.completeEdit(TEXT_ELEMENT.id);
    });

    expect(result.current.editState).toBeNull();
    expect(useStore.getState().elements[0]).toMatchObject({
      id: TEXT_ELEMENT.id,
      type: TEXT_ELEMENT.type,
      props: { children: "committed", external: "preserved" },
    });
    expect(useStore.getState().elements[1]).toMatchObject(OTHER_TEXT_ELEMENT);
    expect(useCanvasStore.getState().isEditing).toBe(false);
  });
});

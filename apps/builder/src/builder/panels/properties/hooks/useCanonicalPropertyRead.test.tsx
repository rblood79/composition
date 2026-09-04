import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { useStore } from "../../../stores";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import { __resetTraversalCache_TEST_ONLY__ } from "../../../stores/canonical/canonicalTraversalHelpers";
import {
  useCanonicalPropertyChildren,
  useCanonicalPropertyChildrenMap,
  useCanonicalPropertyElement,
  useCanonicalPropertyElements,
  useCanonicalPropertyElementsMap,
} from "./useCanonicalPropertyRead";

function makeDoc(children: CanonicalNode[]): CompositionDocument {
  return { schemaVersion: "1.0", children } as unknown as CompositionDocument;
}

function resetCanonicalStore(): void {
  useCanonicalDocumentStore.setState({
    documents: new Map(),
    currentProjectId: null,
    documentVersion: 0,
  });
  __resetTraversalCache_TEST_ONLY__();
}

beforeEach(() => {
  resetCanonicalStore();
  useStore.setState({ elements: [] });
});

afterEach(() => {
  resetCanonicalStore();
  useStore.setState({ elements: [] });
});

describe("useCanonicalPropertyElement", () => {
  it("selection id가 바뀌면 같은 document에서 즉시 다른 canonical node를 반환한다", () => {
    const store = useCanonicalDocumentStore.getState();
    store.setDocument(
      "project-1",
      makeDoc([
        { id: "first", type: "Button", props: { children: "First" } },
        { id: "second", type: "Button", props: { children: "Second" } },
      ] as CanonicalNode[]),
    );
    store.setCurrentProject("project-1");

    const { result, rerender } = renderHook(
      ({ elementId }) => useCanonicalPropertyElement(elementId),
      { initialProps: { elementId: "first" } },
    );

    expect(result.current?.props.children).toBe("First");
    rerender({ elementId: "second" });
    expect(result.current?.props.children).toBe("Second");
  });

  it("page ref descendant의 parent/page scope와 canonical update를 보존한다", () => {
    const makePageDocument = (label: string): CompositionDocument =>
      makeDoc([
        {
          id: "page-ref",
          type: "ref",
          ref: "layout-1",
          metadata: { type: "legacy-page", pageId: "page-1" },
          descendants: {
            content: {
              children: [
                {
                  id: "body-1",
                  type: "body",
                  props: {},
                  children: [
                    {
                      id: "field-1",
                      type: "TextField",
                      props: { label },
                    },
                  ],
                },
              ],
            },
          },
        } as CanonicalNode,
      ]);
    const store = useCanonicalDocumentStore.getState();
    store.setDocument("project-1", makePageDocument("Before"));
    store.setCurrentProject("project-1");

    const { result } = renderHook(() => useCanonicalPropertyElement("field-1"));

    expect(result.current).toMatchObject({
      id: "field-1",
      parent_id: "body-1",
      page_id: "page-1",
      props: { label: "Before" },
    });

    act(() => {
      useCanonicalDocumentStore
        .getState()
        .setDocument("project-1", makePageDocument("After"));
    });

    expect(result.current?.props.label).toBe("After");
  });

  it("canonical document가 없을 때만 store elements fallback을 사용한다", () => {
    useStore.setState({
      elements: [
        {
          id: "legacy-only",
          type: "Button",
          props: { children: "Fallback" },
        },
      ],
    });

    const { result } = renderHook(() =>
      useCanonicalPropertyElement("legacy-only"),
    );

    expect(result.current?.props.children).toBe("Fallback");
  });
});

describe("canonical aggregate property read index", () => {
  it("ref descendants의 DFS/parent/page scope와 O(1) lookup을 함께 보존한다", () => {
    const store = useCanonicalDocumentStore.getState();
    store.setDocument(
      "project-1",
      makeDoc([
        {
          id: "page-ref",
          type: "ref",
          ref: "layout-1",
          metadata: { type: "legacy-page", pageId: "page-1" },
          descendants: {
            content: {
              children: [
                {
                  id: "body-1",
                  type: "body",
                  props: {},
                  children: [
                    {
                      id: "field-1",
                      type: "TextField",
                      props: { label: "Field" },
                    },
                  ],
                },
              ],
            },
          },
        } as CanonicalNode,
      ]),
    );
    store.setCurrentProject("project-1");

    const { result } = renderHook(() => ({
      elements: useCanonicalPropertyElements(),
      elementsById: useCanonicalPropertyElementsMap(),
      children: useCanonicalPropertyChildren("body-1"),
      childrenByParent: useCanonicalPropertyChildrenMap(),
    }));

    expect(result.current.elements.map((element) => element.id)).toEqual([
      "body-1",
      "field-1",
    ]);
    expect(result.current.elementsById.get("field-1")).toMatchObject({
      parent_id: "body-1",
      page_id: "page-1",
      props: { label: "Field" },
    });
    expect(result.current.children).toEqual(
      result.current.childrenByParent.get("body-1"),
    );
    expect(result.current.children.map((element) => element.id)).toEqual([
      "field-1",
    ]);
  });

  it("문서별 index를 hook 인스턴스 사이에 공유하고 mutation 때만 교체한다", () => {
    const makeAggregateDocument = (label: string): CompositionDocument =>
      makeDoc([
        {
          id: "root",
          type: "frame",
          props: {},
          children: [{ id: "child", type: "Text", props: { children: label } }],
        } as CanonicalNode,
      ]);
    const store = useCanonicalDocumentStore.getState();
    store.setDocument("project-1", makeAggregateDocument("Before"));
    store.setCurrentProject("project-1");

    const first = renderHook(() => useCanonicalPropertyElementsMap());
    const second = renderHook(() => useCanonicalPropertyElementsMap());
    const before = first.result.current;

    expect(second.result.current).toBe(before);
    first.rerender();
    expect(first.result.current).toBe(before);

    act(() => {
      useCanonicalDocumentStore
        .getState()
        .setDocument("project-1", makeAggregateDocument("After"));
    });

    expect(first.result.current).not.toBe(before);
    expect(first.result.current.get("child")?.props.children).toBe("After");
  });

  it("duplicate id의 map last-match와 단일 lookup first-match 의미를 유지한다", () => {
    const store = useCanonicalDocumentStore.getState();
    store.setDocument(
      "project-1",
      makeDoc([
        { id: "duplicate", type: "Text", props: { children: "First" } },
        { id: "duplicate", type: "Text", props: { children: "Last" } },
      ] as CanonicalNode[]),
    );
    store.setCurrentProject("project-1");

    const aggregate = renderHook(() => useCanonicalPropertyElementsMap());
    const leaf = renderHook(() => useCanonicalPropertyElement("duplicate"));

    expect(aggregate.result.current.get("duplicate")?.props.children).toBe(
      "Last",
    );
    expect(leaf.result.current?.props.children).toBe("First");
  });

  it("canonical document가 없을 때 legacy aggregate fallback을 공유한다", () => {
    useStore.setState({
      elements: [
        {
          id: "legacy-parent",
          type: "div",
          props: {},
        },
        {
          id: "legacy-child",
          type: "Button",
          parent_id: "legacy-parent",
          props: { children: "Fallback" },
        },
      ],
    });

    const elementsMap = renderHook(() => useCanonicalPropertyElementsMap());
    const childrenMap = renderHook(() => useCanonicalPropertyChildrenMap());

    expect(elementsMap.result.current.get("legacy-child")?.props.children).toBe(
      "Fallback",
    );
    expect(childrenMap.result.current.get("legacy-parent")?.[0]?.id).toBe(
      "legacy-child",
    );
  });
});

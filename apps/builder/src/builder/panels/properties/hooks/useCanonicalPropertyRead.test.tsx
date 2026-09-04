import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { useStore } from "../../../stores";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import { __resetTraversalCache_TEST_ONLY__ } from "../../../stores/canonical/canonicalTraversalHelpers";
import { useCanonicalPropertyElement } from "./useCanonicalPropertyRead";

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

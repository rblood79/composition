// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import type { Element } from "../../types/core/store.types";
import { withComponentInstanceMirror } from "@/adapters/canonical/componentSemanticsMirror";
import {
  useChildElements,
  useCurrentPageElementCount,
  useCurrentPageElements,
  useElementById,
  useSelectedElementData,
  useStore,
} from "./index";
import { useCanonicalDocumentStore } from "./canonical/canonicalDocumentStore";

function makeElement(id: string, overrides: Partial<Element> = {}): Element {
  return {
    id,
    type: "Text",
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    props: {},
    ...overrides,
  } as Element;
}

describe("useSelectedElementData", () => {
  beforeEach(() => {
    useStore.setState({
      elements: [],
      elementsMap: new Map(),
      selectedElementId: null,
      selectedElementProps: {},
    } as never);
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
  });

  it("presents canonical ref instances as their origin component in properties panel data", () => {
    const origin = makeElement("origin", {
      type: "NumberField",
      reusable: true,
      props: { label: "Amount", minValue: 0, style: { width: "100%" } },
    });
    const instance = makeElement("instance", {
      type: "ref",
      ref: "origin",
      props: { maxValue: 10 },
    } as never);

    useStore.setState({
      elements: [origin, instance],
      elementsMap: new Map([
        [origin.id, origin],
        [instance.id, instance],
      ]),
      selectedElementId: "instance",
      selectedElementProps: {},
    } as never);

    const { result } = renderHook(() => useSelectedElementData());

    expect(result.current).toMatchObject({
      id: "instance",
      type: "NumberField",
      properties: {
        label: "Amount",
        minValue: 0,
        maxValue: 10,
      },
      style: { width: "100%" },
    });
  });

  it("presents legacy component instances from overrides in properties panel data", () => {
    const origin = makeElement("origin", {
      type: "Button",
      reusable: true,
      props: { label: "Origin", size: "md", style: { width: 120 } },
    });
    const instance = withComponentInstanceMirror(
      makeElement("instance", {
        type: "Button",
        props: {},
      } as never),
      "origin",
      { overrideProps: { label: "Instance" } },
    );

    useStore.setState({
      elements: [origin, instance],
      elementsMap: new Map([
        [origin.id, origin],
        [instance.id, instance],
      ]),
      selectedElementId: "instance",
      selectedElementProps: {},
    } as never);

    const { result } = renderHook(() => useSelectedElementData());

    expect(result.current).toMatchObject({
      id: "instance",
      type: "Button",
      properties: {
        label: "Instance",
        size: "md",
      },
      style: { width: 120 },
    });
  });

  it("keeps canonical-store ref instances origin-shaped when raw selected props are hydrated", () => {
    const doc: CompositionDocument = {
      schemaVersion: "1.0",
      children: [
        {
          id: "origin",
          type: "NumberField",
          reusable: true,
          props: { label: "Amount", minValue: 0, style: { width: "100%" } },
        },
        {
          id: "instance",
          type: "ref",
          ref: "origin",
          props: { maxValue: 10 },
        } as CanonicalNode,
      ],
    };

    act(() => {
      const state = useCanonicalDocumentStore.getState();
      state.setDocument("proj-a", doc);
      state.setCurrentProject("proj-a");
    });

    useStore.setState({
      elements: [],
      elementsMap: new Map(),
      selectedElementId: "instance",
      selectedElementProps: { maxValue: 10, type: "ref" },
    } as never);

    const { result } = renderHook(() => useSelectedElementData());

    expect(result.current).toMatchObject({
      id: "instance",
      type: "NumberField",
      properties: {
        label: "Amount",
        minValue: 0,
        maxValue: 10,
      },
      style: { width: "100%" },
    });
  });

  it("uses canonical ref override props as the source for origin-shaped selected data", () => {
    const doc: CompositionDocument = {
      schemaVersion: "1.0",
      children: [
        {
          id: "origin",
          type: "NumberField",
          reusable: true,
          props: {
            label: "Origin amount",
            minValue: 0,
            style: { width: "100%", minWidth: 120 },
          },
        },
        {
          id: "instance",
          type: "ref",
          ref: "origin",
          props: {
            label: "Instance amount",
            style: { minWidth: 240 },
          },
        } as CanonicalNode,
      ],
    };

    act(() => {
      const state = useCanonicalDocumentStore.getState();
      state.setDocument("proj-a", doc);
      state.setCurrentProject("proj-a");
    });

    useStore.setState({
      elements: [],
      elementsMap: new Map(),
      selectedElementId: "instance",
      selectedElementProps: {
        label: "Stale amount",
        style: { minWidth: 999 },
        type: "ref",
      },
    } as never);

    const { result } = renderHook(() => useSelectedElementData());

    expect(result.current).toMatchObject({
      id: "instance",
      type: "NumberField",
      properties: {
        label: "Instance amount",
        minValue: 0,
      },
      style: { width: "100%", minWidth: 240 },
    });
  });

  it("does not let stale selected props reapply a reset canonical ref override", () => {
    const initialDoc: CompositionDocument = {
      schemaVersion: "1.0",
      children: [
        {
          id: "origin",
          type: "NumberField",
          reusable: true,
          props: { label: "Origin amount", minValue: 0 },
        },
        {
          id: "instance",
          type: "ref",
          ref: "origin",
          props: { label: "Instance amount" },
        } as CanonicalNode,
      ],
    };
    const resetDoc: CompositionDocument = {
      ...initialDoc,
      children: [
        initialDoc.children[0],
        {
          ...initialDoc.children[1],
          props: {},
        } as CanonicalNode,
      ],
    };

    act(() => {
      const state = useCanonicalDocumentStore.getState();
      state.setDocument("proj-a", initialDoc);
      state.setCurrentProject("proj-a");
    });

    useStore.setState({
      elements: [],
      elementsMap: new Map(),
      selectedElementId: "instance",
      selectedElementProps: { label: "Instance amount", type: "ref" },
    } as never);

    const { result } = renderHook(() => useSelectedElementData());

    expect(result.current?.properties.label).toBe("Instance amount");

    act(() => {
      useCanonicalDocumentStore.getState().setDocument("proj-a", resetDoc);
    });

    expect(result.current).toMatchObject({
      id: "instance",
      type: "NumberField",
      properties: {
        label: "Origin amount",
        minValue: 0,
      },
    });
  });

  it("uses active canonical elements for exported lookup selectors", () => {
    const doc: CompositionDocument = {
      schemaVersion: "1.0",
      children: [
        {
          id: "parent",
          type: "Section",
          props: {},
          children: [
            {
              id: "child",
              type: "Text",
              props: { children: "canonical" },
            },
          ],
        },
      ],
    };

    act(() => {
      const state = useCanonicalDocumentStore.getState();
      state.setDocument("proj-a", doc);
      state.setCurrentProject("proj-a");
    });

    useStore.setState({
      elements: [makeElement("legacy-only")],
      elementsMap: new Map(),
    } as never);

    const { result } = renderHook(() => ({
      parent: useElementById("parent"),
      children: useChildElements("parent"),
    }));

    expect(result.current.parent?.id).toBe("parent");
    expect(result.current.children.map((element) => element.id)).toEqual([
      "child",
    ]);
  });

  it("uses active canonical elements for current page selectors", () => {
    const doc: CompositionDocument = {
      schemaVersion: "1.0",
      children: [
        {
          id: "page-1",
          type: "frame",
          props: {},
          children: [
            {
              id: "page-1-child",
              type: "Text",
              props: { children: "canonical page" },
            },
          ],
        },
        {
          id: "page-2",
          type: "frame",
          props: {},
          children: [
            {
              id: "page-2-child",
              type: "Text",
              props: { children: "other page" },
            },
          ],
        },
      ],
    };

    act(() => {
      const state = useCanonicalDocumentStore.getState();
      state.setDocument("proj-a", doc);
      state.setCurrentProject("proj-a");
    });

    useStore.setState({
      currentPageId: "page-1",
      elements: [makeElement("legacy-only", { page_id: "page-1" })],
      pageElementsSnapshot: {
        "page-1": [makeElement("stale-snapshot", { page_id: "page-1" })],
      },
    } as never);

    const { result } = renderHook(() => ({
      elements: useCurrentPageElements(),
      count: useCurrentPageElementCount(),
    }));

    expect(result.current.elements.map((element) => element.id)).toEqual([
      "page-1",
      "page-1-child",
    ]);
    expect(result.current.count).toBe(2);
  });
});

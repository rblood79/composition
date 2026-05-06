// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import type { Element } from "../../types/core/store.types";
import { useSelectedElementData, useStore } from "./index";
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
    const instance = makeElement("instance", {
      type: "Button",
      componentRole: "instance",
      masterId: "origin",
      props: {},
      overrides: { label: "Instance" },
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

  it("overlays local canonical ref override props onto origin-shaped selected data", () => {
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
          props: {},
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
        label: "Instance amount",
        style: { minWidth: 240 },
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
});

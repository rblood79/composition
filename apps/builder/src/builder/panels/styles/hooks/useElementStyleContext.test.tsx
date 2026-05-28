// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import type { Element } from "../../../../types/core/store.types";
import { useStore } from "../../../stores";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import { useElementStyleContext } from "./useElementStyleContext";

function makeElement(id: string, overrides: Partial<Element> = {}): Element {
  return {
    id,
    type: "Button",
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    props: {},
    ...overrides,
  } as Element;
}

describe("useElementStyleContext", () => {
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

  it("resolves a canonical ref instance style type from its reusable origin", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "button-origin",
          type: "Button",
          name: "PrimaryAction",
          reusable: true,
          props: {
            size: "md",
            style: { width: "120px" },
          },
        },
        {
          id: "button-instance",
          type: "ref",
          ref: "button-origin",
          name: "PrimaryAction",
          props: {
            size: "md",
            style: { width: "240px" },
          },
        },
      ],
    } as never;

    useCanonicalDocumentStore.setState({
      currentProjectId: "project-1",
      documents: new Map([["project-1", doc]]),
      documentVersion: 1,
    });

    const { result } = renderHook(() =>
      useElementStyleContext("button-instance"),
    );

    expect(result.current.type).toBe("Button");
    expect(result.current.style?.width).toBe("240px");
  });

  it("uses a registered componentName as fallback for a ref instance without a hydrated origin", () => {
    const listBoxRef = makeElement("listbox-instance", {
      type: "ref",
      ref: "component-listbox",
      componentName: "ListBox",
      props: {
        orientation: "vertical",
        style: { width: "100%" },
      },
    } as never);

    useStore.setState({
      elements: [listBoxRef],
      elementsMap: new Map([[listBoxRef.id, listBoxRef]]),
    } as never);

    const { result } = renderHook(() =>
      useElementStyleContext("listbox-instance"),
    );

    expect(result.current.type).toBe("ListBox");
    expect(result.current.style?.width).toBe("100%");
  });

  it("does not treat arbitrary instance names as component spec types", () => {
    const ref = makeElement("missing-origin-instance", {
      type: "ref",
      ref: "missing-origin",
      componentName: "PrimaryAction",
      props: { style: {} },
    } as never);

    useStore.setState({
      elements: [ref],
      elementsMap: new Map([[ref.id, ref]]),
    } as never);

    const { result } = renderHook(() =>
      useElementStyleContext("missing-origin-instance"),
    );

    expect(result.current.type).toBe("ref");
  });
});

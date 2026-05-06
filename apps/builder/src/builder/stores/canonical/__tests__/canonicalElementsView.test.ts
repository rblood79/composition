/**
 * @fileoverview canonicalElementsView unit tests — ADR-916 direct cutover.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type {
  CanonicalNode,
  CompositionDocument,
  CompositionExtension,
} from "@composition/shared";
import { ButtonSpec, SectionSpec, TextFieldSpec } from "@composition/specs";

import {
  canonicalDocumentToElements,
  useCanonicalSelectedElement,
} from "../canonicalElementsView";
import { useCanonicalDocumentStore } from "../canonicalDocumentStore";

function makeDoc(
  children: CompositionDocument["children"],
): CompositionDocument {
  return {
    schemaVersion: "1.0",
    children,
  };
}

describe("canonicalDocumentToElements", () => {
  it("converts canonical props nodes into Elements", () => {
    const doc = makeDoc([
      {
        id: "button-1",
        type: "Button",
        name: "Primary CTA",
        props: { variant: "primary", children: "Click me", size: "md" },
      },
    ]);

    const elements = canonicalDocumentToElements(doc);

    expect(elements).toEqual([
      expect.objectContaining({
        id: "button-1",
        type: "Button",
        componentName: "Primary CTA",
        parent_id: null,
        order_num: 0,
        page_id: null,
        props: { variant: "primary", children: "Click me", size: "md" },
      }),
    ]);
  });

  it("walks nested children and derives parent/order from tree context", () => {
    const doc = makeDoc([
      {
        id: "section-1",
        type: "Section",
        props: { variant: "default" },
        children: [
          {
            id: "button-1",
            type: "Button",
            props: { variant: "primary", children: "Inside section" },
          },
          {
            id: "button-2",
            type: "Button",
            props: { variant: "secondary", children: "Second" },
          },
        ],
      },
    ]);

    const elements = canonicalDocumentToElements(doc);

    expect(elements.map((element) => element.id)).toEqual([
      "section-1",
      "button-1",
      "button-2",
    ]);
    expect(elements[1]).toMatchObject({
      parent_id: "section-1",
      order_num: 0,
    });
    expect(elements[2]).toMatchObject({
      parent_id: "section-1",
      order_num: 1,
    });
  });

  it("skips structural nodes without props while preserving child parent context", () => {
    const doc = makeDoc([
      {
        id: "page-placeholder",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-1" },
        children: [
          {
            id: "button-1",
            type: "Button",
            props: { children: "Real child" },
          },
        ],
      },
    ]);

    const elements = canonicalDocumentToElements(doc);

    expect(elements).toHaveLength(1);
    expect(elements[0]).toMatchObject({
      id: "button-1",
      parent_id: null,
      page_id: "page-1",
      props: { children: "Real child" },
    });
  });

  it("preserves page scope for page body children", () => {
    const doc = makeDoc([
      {
        id: "page-1",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-1" },
        children: [
          {
            id: "body-1",
            type: "body",
            props: { className: "react-aria-Body" },
          },
        ],
      },
      {
        id: "page-2",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-2" },
        children: [
          {
            id: "body-2",
            type: "body",
            props: { className: "react-aria-Body" },
          },
        ],
      },
    ]);

    const elements = canonicalDocumentToElements(doc);

    expect(elements).toEqual([
      expect.objectContaining({ id: "body-1", page_id: "page-1" }),
      expect.objectContaining({ id: "body-2", page_id: "page-2" }),
    ]);
  });

  it("preserves reusable frame scope for each frame body", () => {
    const doc = makeDoc([
      {
        id: "layout-frame-a",
        type: "frame",
        reusable: true,
        metadata: { type: "legacy-layout", layoutId: "frame-a" },
        children: [
          {
            id: "body-frame-a",
            type: "body",
            props: { className: "react-aria-Body" },
          },
        ],
      },
      {
        id: "layout-frame-b",
        type: "frame",
        reusable: true,
        metadata: { type: "legacy-layout", layoutId: "frame-b" },
        children: [
          {
            id: "body-frame-b",
            type: "body",
            props: { className: "react-aria-Body" },
          },
        ],
      },
    ]);

    const elements = canonicalDocumentToElements(doc);

    expect(elements).toEqual([
      expect.objectContaining({
        id: "body-frame-a",
        page_id: null,
        layout_id: "frame-a",
      }),
      expect.objectContaining({
        id: "body-frame-b",
        page_id: null,
        layout_id: "frame-b",
      }),
    ]);
  });

  it("restores composition extension fields", () => {
    const extension: CompositionExtension = {
      events: [{ kind: "click", actionRef: "action-1" }],
      dataBinding: { type: "value", value: "hello" },
    };
    const doc = makeDoc([
      {
        id: "button-1",
        type: "Button",
        props: { children: "Submit" },
        "x-composition": extension,
      } as CanonicalNode,
    ]);

    const [element] = canonicalDocumentToElements(doc);

    expect(element.events).toEqual(extension.events);
    expect(element.dataBinding).toEqual(extension.dataBinding);
  });

  it("preserves canonical component origin and instance mirror fields", () => {
    const elements = canonicalDocumentToElements(
      makeDoc([
        {
          id: "origin",
          type: "NumberField",
          name: "Amount Field",
          reusable: true,
          props: { label: "Amount" },
          children: [
            {
              id: "label",
              type: "Label",
              props: { text: "Amount" },
            },
          ],
        },
        {
          id: "instance",
          type: "ref",
          ref: "origin",
          descendants: {
            label: { props: { text: "Price" } },
          },
        },
      ] as CanonicalNode[]),
    );

    expect(elements).toEqual([
      expect.objectContaining({
        id: "origin",
        reusable: true,
      }),
      expect.objectContaining({
        id: "label",
      }),
      expect.objectContaining({
        id: "instance",
        type: "ref",
        ref: "origin",
        descendants: {
          label: { props: { text: "Price" } },
        },
      }),
    ]);
  });
});

describe("canonicalDocumentToElements — spec consumer parity", () => {
  const sizeContext = { width: 120, height: 32, fontSize: 14 };

  it("ButtonSpec.render.shapes() consumes canonical props", () => {
    const [element] = canonicalDocumentToElements(
      makeDoc([
        {
          id: "button-1",
          type: "Button",
          props: { variant: "primary", children: "Click", size: "md" },
        },
      ]),
    );

    expect(
      ButtonSpec.render!.shapes!(element.props, sizeContext, "default"),
    ).toBeDefined();
  });

  it("TextFieldSpec.render.shapes() consumes canonical props", () => {
    const [element] = canonicalDocumentToElements(
      makeDoc([
        {
          id: "textfield-1",
          type: "TextField",
          props: { label: "Email", placeholder: "you@example.com", size: "md" },
        },
      ]),
    );

    expect(
      TextFieldSpec.render!.shapes!(element.props, sizeContext, "default"),
    ).toBeDefined();
  });

  it("SectionSpec.render.shapes() consumes canonical props", () => {
    const [element] = canonicalDocumentToElements(
      makeDoc([
        {
          id: "section-1",
          type: "Section",
          props: { variant: "default" },
        },
      ]),
    );

    expect(
      SectionSpec.render!.shapes!(element.props, sizeContext, "default"),
    ).toBeDefined();
  });
});

function resetCanonicalStore(): void {
  useCanonicalDocumentStore.setState({
    documents: new Map(),
    currentProjectId: null,
    documentVersion: 0,
  });
}

describe("useCanonicalSelectedElement", () => {
  beforeEach(() => {
    resetCanonicalStore();
  });

  afterEach(() => {
    resetCanonicalStore();
  });

  function seedDoc(children: CanonicalNode[]): void {
    const doc: CompositionDocument = { schemaVersion: "1.0", children };
    act(() => {
      const s = useCanonicalDocumentStore.getState();
      s.setDocument("proj-a", doc);
      s.setCurrentProject("proj-a");
    });
  }

  it("returns null when selectedElementId is null", () => {
    seedDoc([{ id: "button-1", type: "Button", props: { label: "A" } }]);

    const { result } = renderHook(() => useCanonicalSelectedElement(null));

    expect(result.current).toBeNull();
  });

  it("returns null when canonical store is inactive", () => {
    const { result } = renderHook(() =>
      useCanonicalSelectedElement("button-1"),
    );

    expect(result.current).toBeNull();
  });

  it("returns selected canonical node as an Element", () => {
    seedDoc([
      {
        id: "button-1",
        type: "Button",
        props: { label: "Click" },
      },
    ]);

    const { result } = renderHook(() =>
      useCanonicalSelectedElement("button-1"),
    );

    expect(result.current).toMatchObject({
      id: "button-1",
      type: "Button",
      props: { label: "Click" },
    });
  });

  it("resolves selected canonical ref nodes to origin-shaped instance elements", () => {
    seedDoc([
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
    ]);

    const { result } = renderHook(() =>
      useCanonicalSelectedElement("instance"),
    );

    expect(result.current).toMatchObject({
      id: "instance",
      type: "NumberField",
      ref: "origin",
      props: {
        label: "Amount",
        minValue: 0,
        maxValue: 10,
        style: { width: "100%" },
      },
    });
  });

  it("returns null when selected node has no props", () => {
    seedDoc([{ id: "page-1", type: "frame" }]);

    const { result } = renderHook(() => useCanonicalSelectedElement("page-1"));

    expect(result.current).toBeNull();
  });

  it("reacts to canonical store mutation", () => {
    seedDoc([
      {
        id: "button-1",
        type: "Button",
        props: { label: "old" },
      },
    ]);

    const { result } = renderHook(() =>
      useCanonicalSelectedElement("button-1"),
    );
    expect(result.current?.props).toEqual({ label: "old" });

    act(() => {
      useCanonicalDocumentStore.getState().setDocument("proj-a", {
        schemaVersion: "1.0",
        children: [
          {
            id: "button-1",
            type: "Button",
            props: { label: "new" },
          },
        ],
      });
    });

    expect(result.current?.props).toEqual({ label: "new" });
  });
});

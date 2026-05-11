/**
 * @fileoverview canonicalElementsView unit tests — ADR-116 direct cutover.
 */

import { describe, expect, it } from "vitest";
import type {
  CanonicalNode,
  CompositionDocument,
  CompositionExtension,
} from "@composition/shared";
import { ButtonSpec, SectionSpec, TextFieldSpec } from "@composition/specs";

import { canonicalDocumentToElements } from "../canonicalElementsView";

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
        page_id: null,
        props: { variant: "primary", children: "Click me", size: "md" },
      }),
    ]);
    expect(elements[0]).not.toHaveProperty("order_num");
  });

  it("walks nested children and preserves tree source order without order_num", () => {
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
    });
    expect(elements[2]).toMatchObject({
      parent_id: "section-1",
    });
    expect(elements.every((element) => !("order_num" in element))).toBe(true);
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

  it("hydrates Card origin structure from page ref descendants after refresh", () => {
    const doc = makeDoc([
      {
        id: "layout-frame-1",
        type: "frame",
        reusable: true,
        metadata: { type: "legacy-layout", layoutId: "frame-1" },
        children: [],
      },
      {
        id: "page-1",
        type: "ref",
        ref: "layout-frame-1",
        metadata: { type: "legacy-page", pageId: "page-1" },
        descendants: {
          content: {
            children: [
              {
                id: "page-1-body",
                type: "body",
                props: { className: "react-aria-Body" },
                children: [
                  {
                    id: "card-origin",
                    type: "Card",
                    reusable: true,
                    props: {
                      title: "Card Title",
                      description: "Card description text goes here.",
                    },
                    children: [
                      {
                        id: "card-preview",
                        type: "CardPreview",
                        props: {},
                      },
                      {
                        id: "card-header",
                        type: "CardHeader",
                        props: {},
                      },
                      {
                        id: "card-content",
                        type: "CardContent",
                        props: {},
                      },
                      {
                        id: "card-footer",
                        type: "CardFooter",
                        props: {},
                      },
                    ],
                  },
                  {
                    id: "card-instance",
                    type: "ref",
                    ref: "card-origin",
                    props: {},
                  } as CanonicalNode,
                ],
              },
            ],
          },
        },
      } as CanonicalNode,
    ]);

    const elements = canonicalDocumentToElements(doc);
    const cardOrigin = elements.find((element) => element.id === "card-origin");
    const cardStructuralChildren = elements
      .filter((element) => element.parent_id === "card-origin")
      .map((element) => element.type);

    expect(cardOrigin).toMatchObject({
      id: "card-origin",
      page_id: "page-1",
      parent_id: "page-1-body",
      reusable: true,
    });
    expect(cardStructuralChildren).toEqual([
      "CardPreview",
      "CardHeader",
      "CardContent",
      "CardFooter",
    ]);
    expect(elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "card-instance",
          type: "ref",
          ref: "card-origin",
          parent_id: "page-1-body",
          page_id: "page-1",
        }),
      ]),
    );
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

  it("keeps component ref descendant children as override payloads instead of duplicated elements", () => {
    const elements = canonicalDocumentToElements(
      makeDoc([
        {
          id: "card-origin",
          type: "Card",
          reusable: true,
          props: {},
          children: [
            {
              id: "card-header",
              type: "CardHeader",
              props: {},
              children: [
                {
                  id: "card-heading",
                  type: "Heading",
                  props: { children: "Origin" },
                },
              ],
            },
          ],
        },
        {
          id: "card-instance",
          type: "ref",
          ref: "card-origin",
          props: {},
          descendants: {
            "card-header": {
              children: [
                {
                  id: "card-heading",
                  type: "Heading",
                  props: { children: "Instance" },
                },
              ],
            },
          },
        } as CanonicalNode,
      ] as CanonicalNode[]),
    );

    expect(
      elements.filter((element) => element.id === "card-heading"),
    ).toHaveLength(1);
    expect(
      elements.find((element) => element.id === "card-instance"),
    ).toMatchObject({
      type: "ref",
      ref: "card-origin",
      descendants: {
        "card-header": {
          children: [
            expect.objectContaining({
              id: "card-heading",
              type: "Heading",
            }),
          ],
        },
      },
    });
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

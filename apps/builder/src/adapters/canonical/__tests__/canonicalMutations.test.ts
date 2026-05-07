import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import type { Element, Page } from "@/types/builder/unified.types";
import type { Layout } from "@/types/builder/layout.types";
import { useCanonicalDocumentStore } from "../../../builder/stores/canonical/canonicalDocumentStore";
import {
  mergeElementsCanonicalPrimary,
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
  setElementsCanonicalPrimary,
} from "../canonicalMutations";

function makeElement(
  id: string,
  type: string,
  patch: Partial<Element> = {},
): Element {
  return {
    id,
    type,
    props: {},
    parent_id: null,
    page_id: null,
    layout_id: null,
    order_num: 0,
    ...patch,
  } as Element;
}

function makePage(id: string): Page {
  return {
    id,
    title: id,
    project_id: "project-1",
    slug: `/${id}`,
    order_num: 0,
  } as Page;
}

function makeLayout(id: string): Layout {
  return {
    id,
    name: id,
    project_id: "project-1",
  };
}

function makeDocument(children: CompositionDocument["children"] = []) {
  return {
    version: "composition-1.0",
    children,
  } satisfies CompositionDocument;
}

function makeCanonicalElementNode(
  element: Element,
  children: CompositionDocument["children"] = [],
): CompositionDocument["children"][number] {
  return {
    id: element.id,
    type: element.type as CompositionDocument["children"][number]["type"],
    props: element.props as Record<string, unknown>,
    metadata: {
      type: "legacy-element-props",
      sourceParentId: element.parent_id,
      sourceSlotName: (element as Element & { slot_name?: string | null })
        .slot_name,
      sourceComponentRole: (
        element as Element & { componentRole?: string | null }
      ).componentRole,
      sourceMasterId: (element as Element & { masterId?: string | null })
        .masterId,
      sourceElementType: element.type,
      sourceOrderNum: element.order_num,
      legacyProps: {
        ...element.props,
        id: element.id,
        parent_id: element.parent_id,
        page_id: element.page_id,
        layout_id: element.layout_id,
        order_num: element.order_num,
        type: element.type,
      },
    },
    ...(children.length > 0 ? { children } : {}),
  };
}

describe("canonical mutation wrappers", () => {
  beforeEach(() => {
    resetCanonicalMutationStoreActions();
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
  });

  it("mergeElementsCanonicalPrimary upserts frame-owned elements into active canonical document", () => {
    const setElements = vi.fn();
    const layout = makeLayout("frame-1");
    const doc = makeDocument([
      {
        id: "layout-frame-1",
        type: "frame",
        reusable: true,
        metadata: { type: "legacy-layout", layoutId: "frame-1" },
        children: [],
      },
    ]);
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", doc);
    registerCanonicalMutationStoreActions({
      mergeElements: vi.fn(),
      setElements,
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [],
        layouts: [layout],
      }),
      getCurrentProjectId: () => "project-1",
    });

    mergeElementsCanonicalPrimary([
      makeElement("body-1", "body", {
        layout_id: "frame-1",
        props: { role: "body" },
      }),
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const frame = nextDoc?.children.find(
      (node) => node.id === "layout-frame-1",
    );
    expect(frame?.children).toEqual([
      expect.objectContaining({
        id: "body-1",
        type: "body",
        metadata: expect.objectContaining({
          legacyProps: expect.objectContaining({ id: "body-1" }),
        }),
      }),
    ]);
    expect(setElements).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "body-1",
        page_id: null,
        props: { role: "body" },
      }),
    ]);
  });

  it("setElementsCanonicalPrimary preserves page shell order metadata", () => {
    const setElements = vi.fn();
    const pages = [
      { ...makePage("page-home"), title: "Home", slug: "/", order_num: 0 },
      { ...makePage("page-two"), title: "Page 2", order_num: 1 },
      { ...makePage("page-three"), title: "Page 3", order_num: 2 },
    ] as Page[];
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    registerCanonicalMutationStoreActions({
      mergeElements: vi.fn(),
      setElements,
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages,
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    setElementsCanonicalPrimary([]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNodes = nextDoc?.children.filter(
      (node) =>
        (node.metadata as { type?: unknown } | undefined)?.type ===
        "legacy-page",
    );
    expect(pageNodes?.map((node) => node.id)).toEqual([
      "page-home",
      "page-two",
      "page-three",
    ]);
    expect(pageNodes?.map((node) => node.metadata?.order_num)).toEqual([
      0, 1, 2,
    ]);
  });

  it("mergeElementsCanonicalPrimary preserves parent-child ordering in page-owned batches", () => {
    const setElements = vi.fn();
    const page = makePage("page-1");
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      mergeElements: vi.fn(),
      setElements,
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    mergeElementsCanonicalPrimary([
      makeElement("child-1", "Text", {
        parent_id: "parent-1",
        page_id: "page-1",
        order_num: 1,
      }),
      makeElement("parent-1", "Box", {
        page_id: "page-1",
        order_num: 0,
      }),
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    expect(pageNode?.children).toEqual([
      expect.objectContaining({
        id: "parent-1",
        children: [expect.objectContaining({ id: "child-1" })],
      }),
    ]);
    expect(setElements).toHaveBeenCalledWith([
      expect.objectContaining({ id: "parent-1", page_id: "page-1" }),
      expect.objectContaining({
        id: "child-1",
        parent_id: "parent-1",
        page_id: "page-1",
      }),
    ]);
  });

  it("mergeElementsCanonicalPrimary preserves reordered sibling order after canonical export", () => {
    const setElements = vi.fn();
    const page = makePage("page-1");
    const body = makeElement("body", "body", {
      page_id: "page-1",
      order_num: 0,
    });
    const childA = makeElement("child-a", "Button", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 0,
    });
    const childB = makeElement("child-b", "Heading", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 1,
    });
    const childC = makeElement("child-c", "Text", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 2,
    });
    const childD = makeElement("child-d", "Image", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 3,
    });

    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            makeCanonicalElementNode(body, [
              makeCanonicalElementNode(childA),
              makeCanonicalElementNode(childB),
              makeCanonicalElementNode(childC),
              makeCanonicalElementNode(childD),
            ]),
          ],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      mergeElements: vi.fn(),
      setElements,
      getCurrentLegacySnapshot: () => ({
        elements: [body, childA, childB, childC, childD],
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    mergeElementsCanonicalPrimary([
      { ...childC, order_num: 0 },
      { ...childA, order_num: 1 },
      { ...childB, order_num: 2 },
      childD,
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    const bodyNode = pageNode?.children?.find((node) => node.id === body.id);
    expect(bodyNode?.children?.map((node) => node.id)).toEqual([
      "child-c",
      "child-a",
      "child-b",
      "child-d",
    ]);

    const exportedIds = (setElements.mock.calls.at(-1)?.[0] as Element[]).map(
      (element) => element.id,
    );
    expect(exportedIds).toEqual([
      "body",
      "child-c",
      "child-a",
      "child-b",
      "child-d",
    ]);
  });

  it("mergeElementsCanonicalPrimary does not reorder siblings for props-only batches", () => {
    const setElements = vi.fn();
    const page = makePage("page-1");
    const body = makeElement("body", "body", {
      page_id: "page-1",
      order_num: 0,
    });
    const childA = makeElement("child-a", "Button", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 0,
      props: { label: "A" },
    });
    const childB = makeElement("child-b", "Button", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 0,
      props: { label: "B" },
    });

    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            makeCanonicalElementNode(body, [
              makeCanonicalElementNode(childB),
              makeCanonicalElementNode(childA),
            ]),
          ],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      mergeElements: vi.fn(),
      setElements,
      getCurrentLegacySnapshot: () => ({
        elements: [body, childB, childA],
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    mergeElementsCanonicalPrimary([
      { ...childA, props: { label: "A updated" } },
      childB,
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    const bodyNode = pageNode?.children?.find((node) => node.id === body.id);
    expect(bodyNode?.children?.map((node) => node.id)).toEqual([
      "child-b",
      "child-a",
    ]);
  });

  it("mergeElementsCanonicalPrimary can nest children inside page ref descendants", () => {
    const setElements = vi.fn();
    const page = makePage("page-1");
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
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
          metadata: {
            type: "legacy-page",
            pageId: "page-1",
            layoutId: "frame-1",
          },
          descendants: {},
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      mergeElements: vi.fn(),
      setElements,
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [page],
        layouts: [makeLayout("frame-1")],
      }),
      getCurrentProjectId: () => "project-1",
    });

    mergeElementsCanonicalPrimary([
      makeElement("child-1", "Text", {
        parent_id: "parent-1",
        page_id: "page-1",
        order_num: 1,
      }),
      makeElement("parent-1", "Box", {
        page_id: "page-1",
        slot_name: "content",
        order_num: 0,
      }),
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    expect(pageNode).toEqual(
      expect.objectContaining({
        type: "ref",
        descendants: {
          content: {
            children: [
              expect.objectContaining({
                id: "parent-1",
                children: [expect.objectContaining({ id: "child-1" })],
              }),
            ],
          },
        },
      }),
    );
  });

  it("setElementsCanonicalPrimary rebuilds canonical shell without legacy projection", () => {
    const setElements = vi.fn();
    const page = {
      ...makePage("page-1"),
      layout_id: "frame-1",
    } as Page;
    const layout = makeLayout("frame-1");
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore
      .getState()
      .setDocument("project-1", makeDocument());
    registerCanonicalMutationStoreActions({
      mergeElements: vi.fn(),
      setElements,
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [page],
        layouts: [layout],
      }),
      getCurrentProjectId: () => "project-1",
    });

    setElementsCanonicalPrimary([
      makeElement("frame-body", "body", {
        layout_id: "frame-1",
      }),
      makeElement("slot-content", "Slot", {
        parent_id: "frame-body",
        layout_id: "frame-1",
        props: { name: "content" },
        slot_name: "content",
      }),
      makeElement("page-box", "Box", {
        page_id: "page-1",
        slot_name: "content",
      }),
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    expect(nextDoc?.children).toEqual([
      expect.objectContaining({
        id: "layout-frame-1",
        type: "frame",
        reusable: true,
        children: [
          expect.objectContaining({
            id: "frame-body",
            children: [
              expect.objectContaining({
                id: "slot-content",
                metadata: expect.objectContaining({
                  type: "legacy-slot-hoisted",
                  slotName: "content",
                }),
              }),
            ],
          }),
        ],
      }),
      expect.objectContaining({
        id: "page-1",
        type: "ref",
        ref: "layout-frame-1",
        descendants: {
          "frame-body/slot-content": {
            children: [expect.objectContaining({ id: "page-box" })],
          },
        },
      }),
    ]);
    expect(setElements).toHaveBeenCalledWith([
      expect.objectContaining({ id: "frame-body", page_id: null }),
      expect.objectContaining({ id: "slot-content", page_id: null }),
      expect.objectContaining({ id: "page-box", page_id: "page-1" }),
    ]);
  });

  it("setElementsCanonicalPrimary preserves an unbound page body during page-shell rebuild", () => {
    const setElements = vi.fn();
    const page = makePage("page-1") as Page;
    const layout = makeLayout("frame-1");
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "layout-frame-1",
          type: "frame",
          reusable: true,
          metadata: { type: "legacy-layout", layoutId: "frame-1" },
          children: [],
        },
        {
          id: "page-1",
          type: "frame",
          metadata: {
            type: "legacy-page",
            pageId: "page-1",
          },
          children: [
            {
              id: "page-body",
              type: "body",
              props: { className: "react-aria-Body" },
            },
          ],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      mergeElements: vi.fn(),
      setElements,
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [page],
        layouts: [layout],
      }),
      getCurrentProjectId: () => "project-1",
    });

    setElementsCanonicalPrimary([
      makeElement("frame-body", "body", {
        layout_id: "frame-1",
      }),
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    expect(nextDoc?.children).toEqual([
      expect.objectContaining({
        id: "layout-frame-1",
        children: [expect.objectContaining({ id: "frame-body" })],
      }),
      expect.objectContaining({
        id: "page-1",
        type: "frame",
        children: [expect.objectContaining({ id: "page-body" })],
      }),
    ]);
    expect(setElements).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "page-body", page_id: "page-1" }),
        expect.objectContaining({ id: "frame-body", page_id: null }),
      ]),
    );
  });

  it("setElementsCanonicalPrimary clears omitted page-owned origin children during full replace", () => {
    const setElements = vi.fn();
    const page = makePage("page-1") as Page;
    const body = makeElement("page-body", "body", {
      page_id: "page-1",
      props: { className: "react-aria-Body" },
    });
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "page-1",
          type: "frame",
          metadata: {
            type: "legacy-page",
            pageId: "page-1",
          },
          children: [
            {
              id: "page-body",
              type: "body",
              props: body.props as Record<string, unknown>,
              children: [
                {
                  id: "origin",
                  type: "Button",
                  reusable: true,
                  props: { label: "Origin" },
                  children: [
                    {
                      id: "origin-label",
                      type: "Label",
                      props: { text: "Origin" },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      mergeElements: vi.fn(),
      setElements,
      getCurrentLegacySnapshot: () => ({
        elements: [body],
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    setElementsCanonicalPrimary([body]);

    const pageNode = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1")?.children[0];
    const pageBody = pageNode?.children?.find(
      (node) => node.id === "page-body",
    );
    expect(pageBody?.children ?? []).toEqual([]);
    expect(setElements).toHaveBeenCalledWith([
      expect.objectContaining({ id: "page-body", page_id: "page-1" }),
    ]);
  });

  it("mergeElementsCanonicalPrimary appends repeated slot fills in order", () => {
    const setElements = vi.fn();
    const page = {
      ...makePage("page-1"),
      layout_id: "frame-1",
    } as Page;
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "layout-frame-1",
          type: "frame",
          reusable: true,
          metadata: { type: "legacy-layout", layoutId: "frame-1" },
          children: [
            {
              id: "frame-body",
              type: "body",
              metadata: { legacyProps: { id: "frame-body", order_num: 0 } },
              children: [
                {
                  id: "content",
                  type: "frame",
                  placeholder: true,
                  metadata: {
                    type: "legacy-slot-hoisted",
                    slotName: "content",
                  },
                  children: [],
                },
              ],
            },
          ],
        },
        {
          id: "page-1",
          type: "ref",
          ref: "layout-frame-1",
          metadata: {
            type: "legacy-page",
            pageId: "page-1",
            layoutId: "frame-1",
          },
          descendants: {},
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      mergeElements: vi.fn(),
      setElements,
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [page],
        layouts: [makeLayout("frame-1")],
      }),
      getCurrentProjectId: () => "project-1",
    });

    mergeElementsCanonicalPrimary([
      makeElement("slot-fill-a", "Button", {
        page_id: "page-1",
        slot_name: "content",
        order_num: 0,
      }),
      makeElement("slot-fill-b", "Text", {
        page_id: "page-1",
        slot_name: "content",
        order_num: 1,
      }),
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    expect(pageNode).toEqual(
      expect.objectContaining({
        descendants: {
          "frame-body/content": {
            children: [
              expect.objectContaining({ id: "slot-fill-a" }),
              expect.objectContaining({ id: "slot-fill-b" }),
            ],
          },
        },
      }),
    );
    expect(setElements).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "slot-fill-a", page_id: "page-1" }),
        expect.objectContaining({ id: "slot-fill-b", page_id: "page-1" }),
      ]),
    );
  });

  it("mergeElementsCanonicalPrimary preserves reordered slot descendants after canonical export", () => {
    const setElements = vi.fn();
    const page = {
      ...makePage("page-1"),
      layout_id: "frame-1",
    } as Page;
    const slotFillA = makeElement("slot-fill-a", "Button", {
      page_id: "page-1",
      slot_name: "content",
      order_num: 0,
    } as never);
    const slotFillB = makeElement("slot-fill-b", "Heading", {
      page_id: "page-1",
      slot_name: "content",
      order_num: 1,
    } as never);
    const slotFillC = makeElement("slot-fill-c", "Text", {
      page_id: "page-1",
      slot_name: "content",
      order_num: 2,
    } as never);
    const slotFillD = makeElement("slot-fill-d", "Image", {
      page_id: "page-1",
      slot_name: "content",
      order_num: 3,
    } as never);

    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "layout-frame-1",
          type: "frame",
          reusable: true,
          metadata: { type: "legacy-layout", layoutId: "frame-1" },
          children: [
            {
              id: "frame-body",
              type: "body",
              props: {},
              metadata: { legacyProps: { id: "frame-body", order_num: 0 } },
              children: [
                {
                  id: "content",
                  type: "frame",
                  placeholder: true,
                  metadata: {
                    type: "legacy-slot-hoisted",
                    slotName: "content",
                  },
                  children: [],
                },
              ],
            },
          ],
        },
        {
          id: "page-1",
          type: "ref",
          ref: "layout-frame-1",
          metadata: {
            type: "legacy-page",
            pageId: "page-1",
            layoutId: "frame-1",
          },
          descendants: {
            "frame-body/content": {
              children: [
                makeCanonicalElementNode(slotFillA),
                makeCanonicalElementNode(slotFillB),
                makeCanonicalElementNode(slotFillC),
                makeCanonicalElementNode(slotFillD),
              ],
            },
          },
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      mergeElements: vi.fn(),
      setElements,
      getCurrentLegacySnapshot: () => ({
        elements: [slotFillA, slotFillB, slotFillC, slotFillD],
        pages: [page],
        layouts: [makeLayout("frame-1")],
      }),
      getCurrentProjectId: () => "project-1",
    });

    mergeElementsCanonicalPrimary([
      { ...slotFillC, order_num: 0 },
      { ...slotFillA, order_num: 1 },
      { ...slotFillB, order_num: 2 },
      slotFillD,
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    const descendants = (pageNode as { descendants?: unknown })?.descendants as
      | Record<string, { children?: CompositionDocument["children"] }>
      | undefined;
    expect(
      descendants?.["frame-body/content"]?.children?.map((node) => node.id),
    ).toEqual(["slot-fill-c", "slot-fill-a", "slot-fill-b", "slot-fill-d"]);

    const exportedIds = (setElements.mock.calls.at(-1)?.[0] as Element[])
      .filter((element) => element.id.startsWith("slot-fill-"))
      .map((element) => element.id);
    expect(exportedIds).toEqual([
      "slot-fill-c",
      "slot-fill-a",
      "slot-fill-b",
      "slot-fill-d",
    ]);
  });

  it("setElementsCanonicalPrimary clears omitted slot fills during full replace", () => {
    const setElements = vi.fn();
    const page = {
      ...makePage("page-1"),
      layout_id: "frame-1",
    } as Page;
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
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
          metadata: {
            type: "legacy-page",
            pageId: "page-1",
            layoutId: "frame-1",
          },
          descendants: {
            "frame-body/content": {
              children: [
                {
                  id: "old-fill",
                  type: "Button",
                  props: {},
                  metadata: {
                    legacyProps: {
                      id: "old-fill",
                      page_id: "page-1",
                      slot_name: "content",
                    },
                  },
                },
              ],
            },
          },
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      mergeElements: vi.fn(),
      setElements,
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [page],
        layouts: [makeLayout("frame-1")],
      }),
      getCurrentProjectId: () => "project-1",
    });

    setElementsCanonicalPrimary([
      makeElement("frame-body", "body", {
        layout_id: "frame-1",
      }),
      makeElement("slot-content", "Slot", {
        parent_id: "frame-body",
        layout_id: "frame-1",
        props: { name: "content" },
        slot_name: "content",
      }),
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    expect(pageNode).toEqual(
      expect.objectContaining({
        type: "ref",
        descendants: {},
      }),
    );
    expect(setElements).toHaveBeenCalledWith(
      expect.not.arrayContaining([expect.objectContaining({ id: "old-fill" })]),
    );
  });

  it("mergeElementsCanonicalPrimary preserves ref and descendants mirror fields for legacy export", () => {
    const setElements = vi.fn();
    const page = makePage("page-1");
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      mergeElements: vi.fn(),
      setElements,
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    mergeElementsCanonicalPrimary([
      makeElement("master", "Button", {
        componentRole: "master",
        componentName: "Master Button",
        order_num: 0,
      }),
      makeElement("master-label", "Text", {
        parent_id: "master",
        order_num: 1,
      }),
      makeElement("instance", "Button", {
        page_id: "page-1",
        componentRole: "instance",
        masterId: "master",
        overrides: { children: "Override" },
        descendants: { "master-label": { children: "Child Override" } },
        order_num: 2,
      }),
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    expect(pageNode?.children).toEqual([
      expect.objectContaining({
        id: "instance",
        type: "ref",
        ref: "master",
        props: { children: "Override" },
        descendants: {
          "master-label": { children: "Child Override" },
        },
      }),
    ]);
    expect(setElements).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "master",
          componentRole: "master",
          componentName: "Master Button",
        }),
        expect.objectContaining({
          id: "instance",
          componentRole: "instance",
          masterId: "master",
          overrides: { children: "Override" },
          descendants: { "master-label": { children: "Child Override" } },
        }),
      ]),
    );
  });

  it("mergeElementsCanonicalPrimary preserves canonical ref fields from pasted component instances", () => {
    const setElements = vi.fn();
    const page = makePage("page-1");
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            {
              id: "origin",
              type: "Button",
              reusable: true,
              name: "Primary Button",
              props: { children: "Origin" },
              children: [
                {
                  id: "origin-label",
                  type: "Text",
                  props: { children: "Label" },
                },
              ],
            },
          ],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      mergeElements: vi.fn(),
      setElements,
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    mergeElementsCanonicalPrimary([
      makeElement("instance", "ref", {
        page_id: "page-1",
        ref: "origin",
        props: { style: { left: "24px" } },
        order_num: 1,
      } as never),
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    expect(pageNode?.children).toEqual([
      expect.objectContaining({
        id: "origin",
        reusable: true,
      }),
      expect.objectContaining({
        id: "instance",
        type: "ref",
        ref: "origin",
        props: { style: { left: "24px" } },
      }),
    ]);
    expect(setElements).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "instance",
          type: "ref",
          ref: "origin",
          componentRole: "instance",
          masterId: "origin",
          overrides: { style: { left: "24px" } },
        }),
      ]),
    );
  });

  it("mergeElementsCanonicalPrimary stores origin-shaped ref mirrors as RefNode overrides", () => {
    const setElements = vi.fn();
    const page = makePage("page-1");
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            {
              id: "origin",
              type: "Button",
              reusable: true,
              props: {
                children: "Origin",
                size: "md",
                style: { color: "red", minWidth: 120 },
              },
            },
          ],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      mergeElements: vi.fn(),
      setElements,
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    mergeElementsCanonicalPrimary([
      makeElement("instance", "Button", {
        page_id: "page-1",
        ref: "origin",
        props: {
          children: "Instance",
          size: "md",
          style: { color: "red", minWidth: 240 },
        },
        order_num: 1,
      } as never),
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    expect(pageNode?.children).toEqual([
      expect.objectContaining({
        id: "origin",
        reusable: true,
      }),
      expect.objectContaining({
        id: "instance",
        type: "ref",
        ref: "origin",
        props: {
          children: "Instance",
          style: { minWidth: 240 },
        },
        metadata: expect.objectContaining({
          legacyProps: expect.objectContaining({
            overrides: {
              children: "Instance",
              style: { minWidth: 240 },
            },
          }),
        }),
      }),
    ]);
  });

  it("mergeElementsCanonicalPrimary preserves reusable page origins across export round-trip", () => {
    const setElements = vi.fn();
    const page = makePage("page-1");
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      mergeElements: vi.fn(),
      setElements,
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    mergeElementsCanonicalPrimary([
      makeElement("origin", "Button", {
        page_id: "page-1",
        componentName: "primary-action",
        reusable: true,
        order_num: 0,
      } as never),
    ]);

    const firstDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const firstPageNode = firstDoc?.children.find(
      (node) => node.id === "page-1",
    );
    expect(firstPageNode?.children).toEqual([
      expect.objectContaining({
        id: "origin",
        reusable: true,
        metadata: expect.objectContaining({
          legacyProps: expect.objectContaining({
            componentRole: "master",
            page_id: "page-1",
          }),
        }),
      }),
    ]);

    const exportedElements = setElements.mock.calls.at(-1)?.[0] as
      | Element[]
      | undefined;
    const exportedOrigin = exportedElements?.find(
      (element) => element.id === "origin",
    );
    expect(exportedOrigin).toMatchObject({
      id: "origin",
      page_id: "page-1",
      parent_id: null,
      componentRole: "master",
      reusable: true,
    });

    mergeElementsCanonicalPrimary([exportedOrigin as Element]);

    const roundTripDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const roundTripPageNode = roundTripDoc?.children.find(
      (node) => node.id === "page-1",
    );
    expect(
      roundTripDoc?.children.filter((node) => node.id === "origin"),
    ).toHaveLength(0);
    expect(roundTripPageNode?.children).toEqual([
      expect.objectContaining({
        id: "origin",
        reusable: true,
      }),
    ]);
  });

  it("merge path does not rebuild via legacyToCanonical", async () => {
    const source = await readFile(
      resolve(__dirname, "../canonicalMutations.ts"),
      "utf-8",
    );
    const mergeBody = source.slice(
      source.indexOf("function applyCanonicalPrimaryMerge"),
      source.indexOf("function applyCanonicalPrimarySet"),
    );

    expect(mergeBody).not.toContain("legacyToCanonical(");
  });

  it("set path does not rebuild via legacyToCanonical", async () => {
    const source = await readFile(
      resolve(__dirname, "../canonicalMutations.ts"),
      "utf-8",
    );
    const setBody = source.slice(
      source.indexOf("function applyCanonicalPrimarySet"),
      source.indexOf(
        "// ─────────────────────────────────────────────\n// In-memory store wrapper API",
      ),
    );

    expect(setBody).not.toContain("legacyToCanonical(");
  });
});

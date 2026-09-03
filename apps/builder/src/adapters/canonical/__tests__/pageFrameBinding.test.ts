import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CanonicalNode,
  CompositionDocument,
  RefNode,
} from "@composition/shared";
import type { Element, Page } from "@/types/builder/unified.types";
import { useCanonicalDocumentStore } from "../../../builder/stores/canonical/canonicalDocumentStore";
import { canonicalDocumentToElements } from "../../../builder/stores/canonical/canonicalElementsView";
import {
  readImmediateSelectionSnapshot,
  useStore,
} from "../../../builder/stores";
import {
  applyPageFrameBindingExplicit,
  applyPageFrameBindingFromSelection,
} from "../pageFrameBinding";

const mocks = vi.hoisted(() => ({
  db: {
    documents: {
      put: vi.fn(),
    },
  },
  getDB: vi.fn(),
  enqueuePagePersistence: vi.fn(),
  loadFrameElements: vi.fn(),
  mergeElementsCanonicalPrimary: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDB: mocks.getDB,
}));

vi.mock("@/builder/utils/pagePersistenceQueue", () => ({
  enqueuePagePersistence: mocks.enqueuePagePersistence,
}));

vi.mock("../frameElementLoader", () => ({
  loadFrameElements: mocks.loadFrameElements,
}));

vi.mock("../canonicalMutations", () => ({
  mergeElementsCanonicalPrimary: mocks.mergeElementsCanonicalPrimary,
}));

function makePage(id = "page-1", layoutId: string | null = null): Page {
  return {
    id,
    title: id,
    project_id: "project-1",
    slug: `/${id}`,
    layout_id: layoutId,
    order_num: 0,
  } as Page;
}

function makeElement(id = "frame-body"): Element {
  return {
    id,
    type: "body",
    props: {},
    parent_id: null,
    page_id: null,
    layout_id: "frame-1",
    order_num: 0,
  } as Element;
}

function makeDoc(children: CanonicalNode[] = []): CompositionDocument {
  return {
    version: "composition-1.0",
    children,
  };
}

function makeFrameNode(frameId = "frame-1"): CanonicalNode {
  return {
    id: `layout-${frameId}`,
    type: "frame",
    reusable: true,
    name: "Frame",
    metadata: {
      type: "legacy-layout",
      layoutId: frameId,
    },
  };
}

function makeNativeFrameNode(frameId = "frame-native"): CanonicalNode {
  return {
    id: frameId,
    type: "frame",
    reusable: true,
    name: "Native Frame",
  };
}

describe("pageFrameBinding canonical primary helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDB.mockResolvedValue(mocks.db);
    mocks.enqueuePagePersistence.mockImplementation(
      async (task: () => Promise<void>) => {
        await task();
      },
    );
    mocks.loadFrameElements.mockResolvedValue([makeElement()]);
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
    useStore.setState({
      currentPageId: null,
      selectedElementId: null,
    } as never);
  });

  it("selection entrypoint applies the frame to the live current page only", async () => {
    const pageA = makePage("page-a");
    const pageB = makePage("page-b");
    const state = {
      pages: [pageA, pageB],
      currentPageId: "page-b",
      elementsMap: new Map<string, Element>(),
    } as Parameters<typeof applyPageFrameBindingFromSelection>[0] extends {
      getElementsState: () => infer S;
    }
      ? S
      : never;
    const setPages = vi.fn();
    useStore.setState({
      currentPageId: "page-b",
      selectedElementId: "page-b-body",
    } as never);
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore
      .getState()
      .setDocument("project-1", makeDoc([makeFrameNode("frame-2")]));

    await applyPageFrameBindingFromSelection({
      snapshot: readImmediateSelectionSnapshot(),
      frameId: "frame-2",
      getElementsState: () => state,
      setPages,
    });

    expect(setPages).toHaveBeenCalledWith([
      expect.objectContaining({ id: "page-a", layout_id: null }),
      expect.objectContaining({ id: "page-b", layout_id: "frame-2" }),
    ]);
  });

  it("selection entrypoint skips mutation when the snapshot is stale", async () => {
    const pageA = makePage("page-a");
    const pageB = makePage("page-b");
    const setPages = vi.fn();
    useStore.setState({
      currentPageId: "page-a",
      selectedElementId: "page-a-body",
    } as never);
    const snapshot = readImmediateSelectionSnapshot();
    const state = {
      pages: [pageA, pageB],
      currentPageId: "page-b",
      elementsMap: new Map<string, Element>(),
    } as Parameters<typeof applyPageFrameBindingFromSelection>[0] extends {
      getElementsState: () => infer S;
    }
      ? S
      : never;

    await applyPageFrameBindingFromSelection({
      snapshot,
      frameId: "frame-2",
      getElementsState: () => state,
      setPages,
    });

    expect(setPages).not.toHaveBeenCalled();
  });

  it("updates page binding without rewriting the reusable frame subtree", async () => {
    const page = makePage();
    const state = {
      pages: [page],
      elementsMap: new Map<string, Element>(),
    } as Parameters<typeof applyPageFrameBindingExplicit>[0] extends {
      getElementsState: () => infer S;
    }
      ? S
      : never;
    const setPages = vi.fn();
    const frameBody: CanonicalNode = {
      id: "frame-body",
      type: "Body",
      props: {},
      children: [
        {
          id: "slot-content",
          type: "frame",
          props: { name: "content" },
          metadata: { type: "legacy-slot-hoisted", slotName: "content" },
        },
      ],
    };
    const baseFrame = {
      ...makeFrameNode(),
      children: [frameBody],
    } as CanonicalNode;
    const baseDoc = makeDoc([baseFrame]);
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", baseDoc);

    await applyPageFrameBindingExplicit({
      pageId: page.id,
      contextReason: "page-frame-binding-test",
      frameId: "frame-1",
      getElementsState: () => state,
      setPages,
    });

    expect(mocks.loadFrameElements).not.toHaveBeenCalled();
    expect(mocks.mergeElementsCanonicalPrimary).not.toHaveBeenCalled();
    const doc = useCanonicalDocumentStore.getState().getDocument("project-1");
    const pageNode = doc?.children.find((node) => node.id === "page-1") as
      RefNode | undefined;
    expect(pageNode).toEqual(
      expect.objectContaining({
        id: "page-1",
        type: "ref",
        ref: "layout-frame-1",
        metadata: expect.objectContaining({
          type: "legacy-page",
          pageId: "page-1",
          layoutId: "frame-1",
        }),
      }),
    );
    expect(
      useCanonicalDocumentStore.getState().getDocument("project-1"),
    ).toEqual(
      expect.objectContaining({
        children: expect.arrayContaining([
          baseFrame,
          expect.objectContaining({ id: "page-1", type: "ref" }),
        ]),
      }),
    );
    expect(setPages).toHaveBeenCalledWith([
      expect.objectContaining({ id: "page-1", layout_id: "frame-1" }),
    ]);
    expect(mocks.db.documents.put).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({ version: "composition-1.0" }),
    );
  });

  it("clears frame binding without loading frame elements and inserts missing page mirror", async () => {
    const page = makePage("page-2", "frame-1");
    const state = {
      pages: [page],
      elementsMap: new Map<string, Element>(),
    } as Parameters<typeof applyPageFrameBindingExplicit>[0] extends {
      getElementsState: () => infer S;
    }
      ? S
      : never;
    const setPages = vi.fn();
    const existingPageRef: RefNode = {
      id: "page-2",
      type: "ref",
      ref: "layout-frame-1",
      metadata: {
        type: "legacy-page",
        pageId: "page-2",
        slug: "/page-2",
        layoutId: "frame-1",
      },
      descendants: {
        content: {
          children: [
            {
              id: "child-1",
              type: "Text",
              metadata: {
                type: "legacy-element-props",
                legacyProps: { text: "Hello" },
              },
            },
          ],
        },
      },
    };
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore
      .getState()
      .setDocument("project-1", makeDoc([makeFrameNode(), existingPageRef]));

    await applyPageFrameBindingExplicit({
      pageId: page.id,
      contextReason: "page-frame-binding-test",
      frameId: null,
      getElementsState: () => state,
      setPages,
    });

    expect(mocks.loadFrameElements).not.toHaveBeenCalled();
    expect(setPages).toHaveBeenCalledWith([
      expect.objectContaining({ id: "page-2", layout_id: null }),
    ]);
    const doc = useCanonicalDocumentStore.getState().getDocument("project-1");
    expect(mocks.db.documents.put).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({ version: "composition-1.0" }),
    );
    expect(doc?.children.find((node) => node.id === "page-2")).toEqual(
      expect.objectContaining({
        id: "page-2",
        type: "frame",
        metadata: expect.not.objectContaining({ layoutId: "frame-1" }),
        children: expect.arrayContaining([
          expect.objectContaining({ id: "page-2-body", type: "body" }),
          expect.objectContaining({ id: "child-1" }),
        ]),
      }),
    );
  });

  it("keeps the page body as a canonical child when applying a frame binding", async () => {
    const page = makePage("page-5");
    const pageBody: CanonicalNode = {
      id: "page-5-body",
      type: "Body",
      props: {
        className: "react-aria-Body",
        style: { width: "100%", height: "100%" },
      },
      children: [],
    };
    const pageCard: CanonicalNode = {
      id: "page-5-card",
      type: "Card",
      props: { label: "Card" },
      metadata: {
        type: "legacy-element-props",
        pageFrameDescendantPath: "content",
      },
    };
    const existingPageNode: CanonicalNode = {
      id: "page-5",
      type: "frame",
      name: "Page 5",
      metadata: {
        type: "legacy-page",
        pageId: "page-5",
        slug: "/page-5",
      },
      children: [pageBody, pageCard],
    };
    const state = {
      pages: [page],
      elementsMap: new Map<string, Element>(),
    } as Parameters<typeof applyPageFrameBindingExplicit>[0] extends {
      getElementsState: () => infer S;
    }
      ? S
      : never;
    const setPages = vi.fn();
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore
      .getState()
      .setDocument("project-1", makeDoc([makeFrameNode(), existingPageNode]));

    await applyPageFrameBindingExplicit({
      pageId: page.id,
      contextReason: "page-frame-binding-test",
      frameId: "frame-1",
      getElementsState: () => state,
      setPages,
    });

    const doc = useCanonicalDocumentStore.getState().getDocument("project-1");
    const pageNode = doc?.children.find((node) => node.id === "page-5") as
      RefNode | undefined;
    expect(pageNode).toEqual(
      expect.objectContaining({
        id: "page-5",
        type: "ref",
        children: [
          expect.objectContaining({
            id: "page-5-body",
            type: "Body",
            props: expect.objectContaining({
              style: { width: "100%", height: "100%" },
            }),
          }),
        ],
        descendants: {
          content: {
            children: [expect.objectContaining({ id: "page-5-card" })],
          },
        },
      }),
    );
  });

  it("rebuilds canonical-derived mirror before setPages notifies page shell subscribers", async () => {
    const page = makePage("page-2", "frame-1");
    const draggedChild: CanonicalNode = {
      id: "dragged-card",
      type: "Card",
      props: { label: "Dragged" },
    };
    const state = {
      pages: [page],
      elementsMap: new Map<string, Element>([
        [
          "dragged-card",
          {
            id: "dragged-card",
            type: "Card",
            props: { label: "Dragged" },
            parent_id: "page-1-body",
            page_id: "page-1",
            layout_id: null,
          } as Element,
        ],
      ]),
      _rebuildIndexes: vi.fn(() => {
        const doc = useCanonicalDocumentStore
          .getState()
          .getDocument("project-1");
        const elements = doc ? canonicalDocumentToElements(doc) : [];
        state.elementsMap = new Map(
          elements.map((element) => [element.id, element]),
        );
      }),
    } as Parameters<typeof applyPageFrameBindingExplicit>[0] extends {
      getElementsState: () => infer S;
    }
      ? S
      : never;
    const setPages = vi.fn(() => {
      expect(state.elementsMap?.get("dragged-card")?.page_id).toBe("page-2");
    });
    const existingPageRef: RefNode = {
      id: "page-2",
      type: "ref",
      ref: "layout-frame-1",
      metadata: {
        type: "legacy-page",
        pageId: "page-2",
        slug: "/page-2",
        layoutId: "frame-1",
      },
      descendants: {
        "frame-body/slot-content": {
          children: [draggedChild],
        },
      },
    };

    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore
      .getState()
      .setDocument("project-1", makeDoc([makeFrameNode(), existingPageRef]));

    await applyPageFrameBindingExplicit({
      pageId: page.id,
      contextReason: "page-frame-binding-test",
      frameId: null,
      getElementsState: () => state,
      setPages,
    });

    expect(
      (state._rebuildIndexes as ReturnType<typeof vi.fn>).mock
        .invocationCallOrder[0],
    ).toBeLessThan(setPages.mock.invocationCallOrder[0]);
    expect(setPages).toHaveBeenCalledOnce();
  });

  it("clears frame binding to a page frame with a body when the ref has no descendants", async () => {
    const page = makePage("page-3", "frame-1");
    const state = {
      pages: [page],
      elementsMap: new Map<string, Element>([
        ["frame-body", makeElement("frame-body")],
      ]),
    } as Parameters<typeof applyPageFrameBindingExplicit>[0] extends {
      getElementsState: () => infer S;
    }
      ? S
      : never;
    const setPages = vi.fn();
    const existingPageRef: RefNode = {
      id: "page-3",
      type: "ref",
      ref: "layout-frame-1",
      metadata: {
        type: "legacy-page",
        pageId: "page-3",
        slug: "/page-3",
        layoutId: "frame-1",
      },
    };
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore
      .getState()
      .setDocument("project-1", makeDoc([makeFrameNode(), existingPageRef]));

    await applyPageFrameBindingExplicit({
      pageId: page.id,
      contextReason: "page-frame-binding-test",
      frameId: null,
      getElementsState: () => state,
      setPages,
    });

    const doc = useCanonicalDocumentStore.getState().getDocument("project-1");
    expect(doc?.children.find((node) => node.id === "page-3")).toEqual(
      expect.objectContaining({
        id: "page-3",
        type: "frame",
        children: [
          expect.objectContaining({
            id: "page-3-body",
            type: "body",
            props: expect.objectContaining({
              className: "react-aria-Body",
            }),
          }),
        ],
      }),
    );
  });

  it("clears frame binding from a refreshed frame-bound model without dropping the page body", async () => {
    const page = makePage("page-4", "frame-1");
    const hydratedPageBody: Element = {
      id: "page-4-body",
      type: "body",
      props: {
        className: "react-aria-Body",
        style: { width: "100%", height: "100%" },
      },
      parent_id: null,
      page_id: "page-4",
      layout_id: null,
      order_num: 0,
    } as Element;
    const state = {
      pages: [page],
      elementsMap: new Map<string, Element>([
        [hydratedPageBody.id, hydratedPageBody],
        ["frame-body", makeElement("frame-body")],
      ]),
    } as Parameters<typeof applyPageFrameBindingExplicit>[0] extends {
      getElementsState: () => infer S;
    }
      ? S
      : never;
    const setPages = vi.fn();
    const existingPageRef: RefNode = {
      id: "page-4",
      type: "ref",
      ref: "layout-frame-1",
      metadata: {
        type: "legacy-page",
        pageId: "page-4",
        slug: "/page-4",
        layoutId: "frame-1",
      },
    };
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore
      .getState()
      .setDocument("project-1", makeDoc([makeFrameNode(), existingPageRef]));

    await applyPageFrameBindingExplicit({
      pageId: page.id,
      contextReason: "page-frame-binding-test",
      frameId: null,
      getElementsState: () => state,
      setPages,
    });

    const doc = useCanonicalDocumentStore.getState().getDocument("project-1");
    expect(doc?.children.find((node) => node.id === "page-4")).toEqual(
      expect.objectContaining({
        id: "page-4",
        type: "frame",
        children: [
          expect.objectContaining({
            id: "page-4-body",
            type: "body",
            props: expect.objectContaining({
              style: { width: "100%", height: "100%" },
            }),
          }),
        ],
      }),
    );
  });

  it("clears frame binding without dropping page-owned body children", async () => {
    const page = makePage("page-6", "frame-1");
    const pageButton: CanonicalNode = {
      id: "page-6-button",
      type: "Button",
      props: { children: "Submit" },
    };
    const pageInstance: RefNode = {
      id: "page-6-instance",
      type: "ref",
      ref: "component-card",
      props: {},
    };
    const pageBody: CanonicalNode = {
      id: "page-6-body",
      type: "Body",
      props: {
        className: "react-aria-Body",
        style: { width: "100%", height: "100%" },
      },
      children: [pageButton, pageInstance],
    };
    const state = {
      pages: [page],
      elementsMap: new Map<string, Element>(),
    } as Parameters<typeof applyPageFrameBindingExplicit>[0] extends {
      getElementsState: () => infer S;
    }
      ? S
      : never;
    const setPages = vi.fn();
    const existingPageRef: RefNode = {
      id: "page-6",
      type: "ref",
      ref: "layout-frame-1",
      metadata: {
        type: "legacy-page",
        pageId: "page-6",
        slug: "/page-6",
        layoutId: "frame-1",
      },
      children: [pageBody],
    };
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore
      .getState()
      .setDocument("project-1", makeDoc([makeFrameNode(), existingPageRef]));

    await applyPageFrameBindingExplicit({
      pageId: page.id,
      contextReason: "page-frame-binding-test",
      frameId: null,
      getElementsState: () => state,
      setPages,
    });

    const doc = useCanonicalDocumentStore.getState().getDocument("project-1");
    const pageNode = doc?.children.find((node) => node.id === "page-6");
    expect(pageNode).toEqual(
      expect.objectContaining({
        id: "page-6",
        type: "frame",
        children: [
          expect.objectContaining({
            id: "page-6-body",
            children: [
              expect.objectContaining({ id: "page-6-button" }),
              expect.objectContaining({ id: "page-6-instance" }),
            ],
          }),
        ],
      }),
    );
  });

  it("uses the actual canonical FrameNode id for native frame bindings", async () => {
    const page = makePage();
    const state = {
      pages: [page],
      elementsMap: new Map<string, Element>(),
    } as Parameters<typeof applyPageFrameBindingExplicit>[0] extends {
      getElementsState: () => infer S;
    }
      ? S
      : never;
    const setPages = vi.fn();
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore
      .getState()
      .setDocument("project-1", makeDoc([makeNativeFrameNode()]));

    await applyPageFrameBindingExplicit({
      pageId: page.id,
      contextReason: "page-frame-binding-test",
      frameId: "frame-native",
      getElementsState: () => state,
      setPages,
    });

    const doc = useCanonicalDocumentStore.getState().getDocument("project-1");
    const pageNode = doc?.children.find((node) => node.id === "page-1") as
      RefNode | undefined;
    expect(pageNode).toEqual(
      expect.objectContaining({
        id: "page-1",
        type: "ref",
        ref: "frame-native",
        metadata: expect.objectContaining({
          layoutId: "frame-native",
        }),
      }),
    );
  });

  it("maps a mirror frame id to a layout-prefixed canonical FrameNode id", async () => {
    const page = makePage();
    const state = {
      pages: [page],
      elementsMap: new Map<string, Element>(),
    } as Parameters<typeof applyPageFrameBindingExplicit>[0] extends {
      getElementsState: () => infer S;
    }
      ? S
      : never;
    const setPages = vi.fn();
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore
      .getState()
      .setDocument("project-1", makeDoc([makeFrameNode("frame-2")]));

    await applyPageFrameBindingExplicit({
      pageId: page.id,
      contextReason: "page-frame-binding-test",
      frameId: "frame-2",
      getElementsState: () => state,
      setPages,
    });

    const doc = useCanonicalDocumentStore.getState().getDocument("project-1");
    const pageNode = doc?.children.find((node) => node.id === "page-1") as
      RefNode | undefined;
    expect(pageNode).toEqual(
      expect.objectContaining({
        id: "page-1",
        type: "ref",
        ref: "layout-frame-2",
        metadata: expect.objectContaining({
          layoutId: "frame-2",
        }),
      }),
    );
  });
});

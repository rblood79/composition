import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CanonicalNode,
  CompositionDocument,
  FrameNode,
  RefNode,
} from "@composition/shared";
import type { Element, Page } from "../../../../types/builder/unified.types";
import type { Layout } from "../../../../types/builder/layout.types";
import { saveService } from "../../../../services/save";
import { useCanonicalDocumentStore } from "../../canonical/canonicalDocumentStore";
import {
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
  setElementsCanonicalPrimary,
} from "@/adapters/canonical/canonicalMutations";
import { withComponentInstanceMirror } from "@/adapters/canonical/componentSemanticsMirror";
import { buildLegacyElementMetadata } from "@/adapters/canonical/legacyMetadata";
import { createInspectorActionsSlice } from "../../inspectorActions";
import { createRemoveElementsAction } from "../elementRemoval";
import {
  createBatchUpdateElementsAction,
  createBatchUpdateElementPropsAction,
  createUpdateElementPropsAction,
} from "../elementUpdate";

const mocks = vi.hoisted(() => ({
  db: {
    elements: {
      deleteMany: vi.fn(async () => {}),
      insertMany: vi.fn(async () => {}),
      update: vi.fn(async () => {}),
    },
    documents: {
      put: vi.fn(async () => {}),
    },
  },
}));

vi.mock("../../../../lib/db", () => ({
  getDB: vi.fn(async () => mocks.db),
}));

vi.mock("../../history", () => ({
  historyManager: {
    addEntry: vi.fn(),
    addBatchDiffEntry: vi.fn(),
  },
}));

vi.mock("../../../../services/save", () => ({
  saveService: {
    savePropertyChange: vi.fn(async () => {}),
  },
}));

type MockState = {
  elements: Element[];
  elementsMap: Map<string, Element>;
  childrenMap: Map<string, Element[]>;
  currentPageId: string | null;
  pages: Page[];
  selectedElementId: string | null;
  selectedElementIds: string[];
  selectedElementIdsSet: Set<string>;
  selectedElementProps: Record<string, unknown>;
  editingContextId: string | null;
  dirtyElementIds: Set<string>;
  layoutVersion: number;
  batchUpdateElementOrders: ReturnType<typeof vi.fn>;
  _cancelHydrateSelectedProps: ReturnType<typeof vi.fn>;
  updateElement: ReturnType<typeof vi.fn>;
  batchUpdateElementProps: ReturnType<typeof vi.fn>;
};

function makeElement(
  id: string,
  type: string,
  patch: Partial<Element> & Record<string, unknown> = {},
): Element {
  return {
    id,
    type,
    props: {},
    parent_id: null,
    page_id: null,
    order_num: 0,
    ...patch,
  } as Element;
}

function makeLayout(id: string): Layout {
  return {
    id,
    name: id,
    project_id: "project-1",
  };
}

function makePage(id: string, layoutId?: string): Page {
  return {
    id,
    project_id: "project-1",
    title: id,
    slug: `/${id}`,
    parent_id: null,
    order_num: 0,
    ...(layoutId
      ? {
          metadata: {
            frameBinding: {
              frameId: layoutId,
            },
          },
        }
      : {}),
  } as Page;
}

function makeCanonicalElementNode(element: Element): CanonicalNode {
  return {
    id: element.id,
    type: element.type,
    props: element.props as Record<string, unknown>,
    metadata: buildLegacyElementMetadata(element),
  } as CanonicalNode;
}

function makeState(elements: Element[]): MockState {
  const elementsMap = new Map(elements.map((element) => [element.id, element]));
  const childrenMap = new Map<string, Element[]>();
  for (const element of elements) {
    const parentId = element.parent_id ?? "root";
    childrenMap.set(parentId, [...(childrenMap.get(parentId) ?? []), element]);
  }
  return {
    elements,
    elementsMap,
    childrenMap,
    currentPageId: null,
    pages: [],
    selectedElementId: null,
    selectedElementIds: [],
    selectedElementIdsSet: new Set(),
    selectedElementProps: {},
    editingContextId: null,
    dirtyElementIds: new Set(),
    layoutVersion: 0,
    batchUpdateElementOrders: vi.fn(),
    _cancelHydrateSelectedProps: vi.fn(),
    updateElement: vi.fn(),
    batchUpdateElementProps: vi.fn(),
  };
}

function replaceStateElements(state: MockState, elements: Element[]): void {
  const next = makeState(elements);
  state.elements = next.elements;
  state.elementsMap = next.elementsMap;
  state.childrenMap = next.childrenMap;
}

function createSetMock(state: MockState) {
  return vi.fn(
    (
      patch: Partial<MockState> | ((current: MockState) => Partial<MockState>),
    ) => {
      const nextPatch = typeof patch === "function" ? patch(state) : patch;
      Object.assign(state, nextPatch);
    },
  );
}

function registerCanonicalActions(
  state: MockState,
  layouts: Layout[] = [makeLayout("frame-1")],
): void {
  registerCanonicalMutationStoreActions({
    mergeElements: vi.fn(),
    setElements: (elements) => replaceStateElements(state, elements),
    getCurrentLegacySnapshot: () => ({
      elements: state.elements,
      pages: state.pages,
      layouts,
    }),
    getCurrentProjectId: () => "project-1",
  });
}

function makeFrameDocument(
  children: FrameNode["children"],
): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "layout-frame-1",
        type: "frame",
        reusable: true,
        metadata: { type: "legacy-layout", layoutId: "frame-1" },
        children,
      } satisfies FrameNode,
    ],
  };
}

describe("element mutations keep canonical document primary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.elements.update.mockImplementation(async () => {});
    mocks.db.elements.deleteMany.mockImplementation(async () => {});
    mocks.db.elements.insertMany.mockImplementation(async () => {});
    mocks.db.documents.put.mockImplementation(async () => {});
    vi.mocked(saveService.savePropertyChange).mockResolvedValue(undefined);
    resetCanonicalMutationStoreActions();
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: "project-1",
      documentVersion: 0,
    });
    (globalThis as { indexedDB?: unknown }).indexedDB = {};
  });

  it("removeElements removes frame slots from active canonical document before the next preset insert", async () => {
    const body = makeElement("frame-body", "body", {
      layout_id: "frame-1",
      props: { style: { display: "flex" } },
    });
    const header = makeElement("slot-header", "Slot", {
      parent_id: "frame-body",
      layout_id: "frame-1",
      props: { name: "header" },
      slot_name: "header",
    });
    const content = makeElement("slot-content", "Slot", {
      parent_id: "frame-body",
      layout_id: "frame-1",
      props: { name: "content" },
      slot_name: "content",
    });
    const state = makeState([body, header, content]);
    registerCanonicalActions(state);
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeFrameDocument([
        {
          id: "frame-body",
          type: "body",
          props: body.props as Record<string, unknown>,
          children: [
            {
              id: "slot-header",
              type: "frame",
              placeholder: true,
              props: { name: "header" },
              metadata: {
                type: "legacy-slot-hoisted",
                slotName: "header",
              },
              children: [],
            },
            {
              id: "slot-content",
              type: "frame",
              placeholder: true,
              props: { name: "content" },
              metadata: {
                type: "legacy-slot-hoisted",
                slotName: "content",
              },
              children: [],
            },
          ],
        },
      ]),
    );

    await createRemoveElementsAction(
      createSetMock(state),
      () => state as never,
    )(["slot-header", "slot-content"]);

    const frame = useCanonicalDocumentStore.getState().getDocument("project-1")
      ?.children[0] as FrameNode;
    const frameBody = frame.children?.find((node) => node.id === "frame-body");
    expect(frameBody?.children ?? []).toEqual([]);
    expect(state.elements.map((element) => element.id)).toEqual(["frame-body"]);
  });

  it("removeElements deletes page-owned origins from the active canonical document", async () => {
    const page = makePage("page-1");
    const body = makeElement("page-body", "body", {
      page_id: page.id,
      props: { className: "react-aria-Body" },
    });
    const origin = makeElement("origin", "Button", {
      parent_id: body.id,
      page_id: page.id,
      reusable: true,
      props: { label: "Origin" },
    });
    const label = makeElement("origin-label", "Label", {
      parent_id: origin.id,
      page_id: page.id,
      props: { text: "Origin" },
    });
    const instance = makeElement("instance", "ref", {
      parent_id: body.id,
      page_id: page.id,
      ref: "origin",
      props: { label: "Instance" },
    } as Partial<Element> & Record<string, unknown>);
    const state = makeState([body, origin, label, instance]);
    state.pages = [page];
    state.currentPageId = page.id;
    registerCanonicalActions(state, []);
    useCanonicalDocumentStore.getState().setDocument("project-1", {
      version: "composition-1.0",
      children: [
        {
          id: page.id,
          type: "frame",
          metadata: {
            type: "legacy-page",
            pageId: page.id,
          },
          children: [
            {
              id: body.id,
              type: "body",
              props: body.props as Record<string, unknown>,
              children: [
                {
                  id: origin.id,
                  type: "Button",
                  reusable: true,
                  props: origin.props as Record<string, unknown>,
                  children: [
                    {
                      id: label.id,
                      type: "Label",
                      props: label.props as Record<string, unknown>,
                    },
                  ],
                },
                {
                  id: instance.id,
                  type: "ref",
                  ref: "origin",
                  props: instance.props as Record<string, unknown>,
                } satisfies RefNode,
              ],
            },
          ],
        } satisfies FrameNode,
      ],
    });

    await createRemoveElementsAction(
      createSetMock(state),
      () => state as never,
    )(["origin"]);

    const pageNode = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1")?.children[0] as FrameNode;
    const pageBody = pageNode.children?.find((node) => node.id === body.id);
    expect(pageBody?.children?.map((node) => node.id)).not.toContain("origin");
    expect(pageBody?.children?.map((node) => node.id)).toContain("instance");
    const detachedInstance = pageBody?.children?.find(
      (node) => node.id === "instance",
    );
    expect(detachedInstance).toMatchObject({
      id: "instance",
      type: "Button",
      props: expect.objectContaining({ label: "Instance" }),
    });
    expect(state.elementsMap.has("origin")).toBe(false);
  });

  it("updateElementProps merges body preset props into active canonical document", async () => {
    const body = makeElement("frame-body", "body", {
      layout_id: "frame-1",
      props: { style: { display: "flex" } },
    });
    const state = makeState([body]);
    registerCanonicalActions(state);
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeFrameDocument([
        {
          id: "frame-body",
          type: "body",
          props: body.props as Record<string, unknown>,
          children: [],
        },
      ]),
    );

    await createUpdateElementPropsAction(
      createSetMock(state),
      () => state as never,
    )("frame-body", {
      style: { display: "grid", gridTemplateRows: "auto 1fr" },
      appliedPreset: "vertical-2",
    });

    const frame = useCanonicalDocumentStore.getState().getDocument("project-1")
      ?.children[0] as FrameNode;
    const frameBody = frame.children?.find((node) => node.id === "frame-body");
    expect(frameBody?.props).toEqual({
      style: { display: "grid", gridTemplateRows: "auto 1fr" },
      appliedPreset: "vertical-2",
    });
    expect(state.elementsMap.get("frame-body")?.props).toEqual({
      style: { display: "grid", gridTemplateRows: "auto 1fr" },
      appliedPreset: "vertical-2",
    });
  });

  it("batchUpdateElementProps persists canonical origin and propagated child updates when a legacy mirror row is missing", async () => {
    const origin = makeElement("origin", "Button", {
      reusable: true,
      props: { size: "md" },
    });
    const label = makeElement("label", "Label", {
      parent_id: "origin",
      props: { size: "md" },
    });
    const state = makeState([origin, label]);
    registerCanonicalActions(state, []);
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", {
      version: "composition-1.0",
      children: [
        {
          id: "origin",
          type: "Button",
          reusable: true,
          props: origin.props as Record<string, unknown>,
          children: [
            {
              id: "label",
              type: "Label",
              props: label.props as Record<string, unknown>,
            },
          ],
        } satisfies CanonicalNode,
      ],
    });
    mocks.db.elements.update.mockImplementation(async (id: string) => {
      if (id === "label") {
        throw new Error("Element not found: label");
      }
    });

    await createBatchUpdateElementPropsAction(
      createSetMock(state),
      () => state as never,
    )([
      { elementId: "origin", props: { size: "lg" } },
      { elementId: "label", props: { size: "lg" } },
    ]);

    const originNode = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1")?.children[0] as FrameNode;
    expect(originNode.props).toMatchObject({ size: "lg" });
    expect(originNode.children?.[0]?.props).toMatchObject({ size: "lg" });
    expect(state.elementsMap.get("origin")?.props).toMatchObject({
      size: "lg",
    });
    expect(state.elementsMap.get("label")?.props).toMatchObject({ size: "lg" });
    await vi.waitFor(() => {
      expect(mocks.db.documents.put).toHaveBeenCalledWith(
        "project-1",
        expect.objectContaining({
          children: expect.arrayContaining([
            expect.objectContaining({
              id: "origin",
            }),
          ]),
        }),
      );
    });
  });

  it("batchUpdateElements persists structural order changes into canonical document", async () => {
    const body = makeElement("body", "body", {
      page_id: "page-1",
      order_num: 0,
    });
    const buttonOne = makeElement("button-one", "Button", {
      parent_id: "body",
      page_id: "page-1",
      order_num: 0,
    });
    const buttonTwo = makeElement("button-two", "Button", {
      parent_id: "body",
      page_id: "page-1",
      order_num: 1,
    });
    const state = makeState([body, buttonOne, buttonTwo]);
    state.pages = [makePage("page-1")];
    registerCanonicalActions(state, []);
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", {
      version: "composition-1.0",
      children: [
        {
          id: "page-1",
          type: "frame",
          name: "Page 1",
          metadata: {
            type: "legacy-page",
            pageId: "page-1",
            slug: "/page-1",
            order_num: 0,
            parent_id: null,
          },
          children: [
            {
              ...makeCanonicalElementNode(body),
              children: [
                makeCanonicalElementNode(buttonOne),
                makeCanonicalElementNode(buttonTwo),
              ],
            },
          ],
        } satisfies FrameNode,
      ],
    });

    await createBatchUpdateElementsAction(
      createSetMock(state),
      () => state as never,
    )([
      { elementId: "button-two", updates: { order_num: 0 } },
      { elementId: "button-one", updates: { order_num: 1 } },
    ]);

    const doc = useCanonicalDocumentStore.getState().getDocument("project-1");
    const page = doc?.children.find((node) => node.id === "page-1") as
      | FrameNode
      | undefined;
    const bodyNode = page?.children?.find((node) => node.id === "body") as
      | FrameNode
      | undefined;

    expect(bodyNode?.children?.map((node) => node.id)).toEqual([
      "button-two",
      "button-one",
    ]);
    expect(state.elementsMap.get("button-two")?.order_num).toBe(0);
    expect(state.elementsMap.get("button-one")?.order_num).toBe(1);
    expect(mocks.db.elements.update).toHaveBeenCalledWith("button-two", {
      order_num: 0,
    });
    expect(mocks.db.elements.update).toHaveBeenCalledWith("button-one", {
      order_num: 1,
    });
    expect(mocks.db.documents.put).toHaveBeenCalledWith("project-1", doc);
  });

  it("updateSelectedProperties stores canonical ref root overrides when the legacy mirror row is missing", async () => {
    const origin = makeElement("origin", "Button", {
      reusable: true,
      props: { label: "Origin", size: "md" },
    });
    const instance = makeElement("instance", "ref", {
      ref: "origin",
      props: {},
    } as Partial<Element> & Record<string, unknown>);
    const state = makeState([origin, instance]);
    state.selectedElementId = "instance";
    state.selectedElementIds = ["instance"];
    state.selectedElementIdsSet = new Set(["instance"]);
    state.selectedElementProps = {};
    registerCanonicalActions(state, []);
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", {
      version: "composition-1.0",
      children: [
        {
          id: "origin",
          type: "Button",
          reusable: true,
          props: origin.props as Record<string, unknown>,
        } satisfies CanonicalNode,
        {
          id: "instance",
          type: "ref",
          ref: "origin",
          props: {},
        } satisfies RefNode,
      ],
    });
    mocks.db.elements.update.mockImplementation(async (id: string) => {
      if (id === "instance") {
        throw new Error("Element not found: instance");
      }
    });

    const inspectorActions = createInspectorActionsSlice(
      createSetMock(state) as never,
      () => state as never,
      {} as never,
    );

    inspectorActions.updateSelectedProperties({ label: "Instance" });

    const instanceNode = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1")
      ?.children.find((node) => node.id === "instance") as RefNode | undefined;
    expect(instanceNode).toMatchObject({
      id: "instance",
      type: "ref",
      ref: "origin",
      props: { label: "Instance" },
    });
    expect(state.elementsMap.get("instance")?.props).toMatchObject({
      label: "Instance",
    });
    await vi.waitFor(() => {
      expect(mocks.db.documents.put).toHaveBeenCalledWith(
        "project-1",
        expect.objectContaining({
          children: expect.arrayContaining([
            expect.objectContaining({
              id: "instance",
              props: { label: "Instance" },
            }),
          ]),
        }),
      );
    });
    expect(saveService.savePropertyChange).not.toHaveBeenCalled();
  });

  it("updateSelectedProperties writes legacy instance edits to overrides instead of raw props", () => {
    const origin = makeElement("origin", "Button", {
      reusable: true,
      props: { label: "Origin", size: "md" },
    });
    const instance = withComponentInstanceMirror(
      makeElement("instance", "Button", {
        props: {},
      } as Partial<Element> & Record<string, unknown>),
      "origin",
    );
    const state = makeState([origin, instance]);
    state.selectedElementId = "instance";
    state.selectedElementIds = ["instance"];
    state.selectedElementIdsSet = new Set(["instance"]);
    state.selectedElementProps = {};

    const inspectorActions = createInspectorActionsSlice(
      createSetMock(state) as never,
      () => state as never,
      {} as never,
    );

    inspectorActions.updateSelectedProperties({ label: "Instance" });

    expect(state.elementsMap.get("instance")?.props).toEqual({});
    expect(state.elementsMap.get("instance")).toMatchObject(
      withComponentInstanceMirror({}, "origin", {
        overrideProps: { label: "Instance" },
      }),
    );
    expect(state.selectedElementProps).toMatchObject({
      label: "Instance",
      size: "md",
    });
  });

  it("updateSelectedCustomId keeps origin and instance IDs independent through canonical sync", () => {
    const origin = makeElement("origin", "Button", {
      customId: "origin-id",
      reusable: true,
      props: { label: "Origin" },
    });
    const instance = withComponentInstanceMirror(
      makeElement("instance", "Button", {
        customId: "instance-id",
        props: {},
      } as Partial<Element> & Record<string, unknown>),
      "origin",
    );
    const state = makeState([origin, instance]);
    state.selectedElementId = "instance";
    state.selectedElementIds = ["instance"];
    state.selectedElementIdsSet = new Set(["instance"]);
    registerCanonicalActions(state, []);
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", {
      version: "composition-1.0",
      children: [
        {
          id: "origin",
          type: "Button",
          reusable: true,
          props: origin.props as Record<string, unknown>,
          metadata: {
            type: "legacy-element-props",
            legacyProps: {
              id: "origin",
              customId: "origin-id",
              type: "Button",
            },
          },
        },
        {
          id: "instance",
          type: "ref",
          ref: "origin",
          props: {},
          metadata: buildLegacyElementMetadata(
            withComponentInstanceMirror(
              makeElement("instance", "Button", {
                customId: "instance-id",
                props: {},
              }),
              "origin",
            ),
          ),
        } satisfies RefNode,
      ],
    });

    const inspectorActions = createInspectorActionsSlice(
      createSetMock(state) as never,
      () => state as never,
      {} as never,
    );

    inspectorActions.updateSelectedCustomId("instance-new");

    expect(state.elementsMap.get("origin")?.customId).toBe("origin-id");
    expect(state.elementsMap.get("instance")?.customId).toBe("instance-new");
    const instanceNode = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1")
      ?.children.find((node) => node.id === "instance") as RefNode | undefined;
    expect(instanceNode).toMatchObject({
      id: "instance",
      type: "ref",
      ref: "origin",
      metadata: expect.objectContaining({
        legacyProps: expect.objectContaining({
          customId: "instance-new",
        }),
      }),
    });
  });

  it("updateSelectedProperties stores origin-shaped ref mirror edits as instance overrides", async () => {
    const origin = makeElement("origin", "Button", {
      reusable: true,
      props: { label: "Origin", size: "md" },
    });
    const instance = makeElement("instance", "Button", {
      ref: "origin",
      props: { label: "Origin", size: "md" },
    } as Partial<Element> & Record<string, unknown>);
    const state = makeState([origin, instance]);
    state.selectedElementId = "instance";
    state.selectedElementIds = ["instance"];
    state.selectedElementIdsSet = new Set(["instance"]);
    state.selectedElementProps = instance.props as Record<string, unknown>;
    registerCanonicalActions(state, []);
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", {
      version: "composition-1.0",
      children: [
        {
          id: "origin",
          type: "Button",
          reusable: true,
          props: origin.props as Record<string, unknown>,
        } satisfies CanonicalNode,
        {
          id: "instance",
          type: "ref",
          ref: "origin",
          props: {},
        } satisfies RefNode,
      ],
    });

    const inspectorActions = createInspectorActionsSlice(
      createSetMock(state) as never,
      () => state as never,
      {} as never,
    );

    inspectorActions.updateSelectedProperties({ label: "Instance" });

    const instanceNode = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1")
      ?.children.find((node) => node.id === "instance") as RefNode | undefined;
    expect(instanceNode).toMatchObject({
      id: "instance",
      type: "ref",
      ref: "origin",
      props: { label: "Instance" },
    });
    expect(instanceNode?.props).not.toHaveProperty("size");
    await vi.waitFor(() => {
      expect(mocks.db.documents.put).toHaveBeenCalledWith(
        "project-1",
        expect.objectContaining({
          children: expect.arrayContaining([
            expect.objectContaining({
              id: "instance",
              props: { label: "Instance" },
            }),
          ]),
        }),
      );
    });
    expect(saveService.savePropertyChange).not.toHaveBeenCalled();
  });

  it("updateSelectedProperties stores canonical ref overrides when only the canonical document is hydrated", async () => {
    const state = makeState([]);
    state.selectedElementId = "instance";
    state.selectedElementIds = ["instance"];
    state.selectedElementIdsSet = new Set(["instance"]);
    registerCanonicalActions(state, []);
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", {
      version: "composition-1.0",
      children: [
        {
          id: "origin",
          type: "Button",
          reusable: true,
          props: { label: "Origin", size: "md" },
        } satisfies CanonicalNode,
        {
          id: "instance",
          type: "ref",
          ref: "origin",
          props: {},
        } satisfies RefNode,
      ],
    });

    const inspectorActions = createInspectorActionsSlice(
      createSetMock(state) as never,
      () => state as never,
      {} as never,
    );

    inspectorActions.updateSelectedProperties({ label: "Instance" });

    const instanceNode = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1")
      ?.children.find((node) => node.id === "instance") as RefNode | undefined;
    expect(instanceNode).toMatchObject({
      id: "instance",
      type: "ref",
      ref: "origin",
      props: { label: "Instance" },
    });
    expect(state.elementsMap.get("instance")?.props).toMatchObject({
      label: "Instance",
    });
    await vi.waitFor(() => {
      expect(mocks.db.documents.put).toHaveBeenCalledWith(
        "project-1",
        expect.objectContaining({
          children: expect.arrayContaining([
            expect.objectContaining({
              id: "instance",
              props: { label: "Instance" },
            }),
          ]),
        }),
      );
    });
    expect(saveService.savePropertyChange).not.toHaveBeenCalled();
  });

  it("updateSelectedPropertiesWithChildren stores component instance propagation as ref descendant patches", async () => {
    const origin = makeElement("card-origin", "Card", {
      reusable: true,
      props: {
        title: "Origin title",
        description: "Origin description",
      },
    });
    const header = makeElement("card-header", "CardHeader", {
      parent_id: "card-origin",
      order_num: 0,
      props: {},
    });
    const heading = makeElement("card-heading", "Heading", {
      parent_id: "card-header",
      order_num: 0,
      props: { children: "Origin title" },
    });
    const content = makeElement("card-content", "CardContent", {
      parent_id: "card-origin",
      order_num: 1,
      props: {},
    });
    const description = makeElement("card-description", "Description", {
      parent_id: "card-content",
      order_num: 0,
      props: { children: "Origin description" },
    });
    const instance = withComponentInstanceMirror(
      makeElement("card-instance", "Card", {
        props: {},
      } as Partial<Element> & Record<string, unknown>),
      "card-origin",
    );
    const state = makeState([
      origin,
      header,
      heading,
      content,
      description,
      instance,
    ]);
    state.selectedElementId = "card-instance";
    state.selectedElementIds = ["card-instance"];
    state.selectedElementIdsSet = new Set(["card-instance"]);
    registerCanonicalActions(state, []);
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", {
      version: "composition-1.0",
      children: [
        {
          id: "card-origin",
          type: "Card",
          reusable: true,
          props: origin.props as Record<string, unknown>,
          children: [
            {
              id: "card-header",
              type: "CardHeader",
              props: {},
              children: [
                {
                  id: "card-heading",
                  type: "Heading",
                  props: { children: "Origin title" },
                },
              ],
            },
            {
              id: "card-content",
              type: "CardContent",
              props: {},
              children: [
                {
                  id: "card-description",
                  type: "Description",
                  props: { children: "Origin description" },
                },
              ],
            },
          ],
        } satisfies CanonicalNode,
        {
          id: "card-instance",
          type: "ref",
          ref: "card-origin",
          props: {},
        } satisfies RefNode,
      ],
    });

    const inspectorActions = createInspectorActionsSlice(
      createSetMock(state) as never,
      () => state as never,
      {} as never,
    );

    inspectorActions.updateSelectedPropertiesWithChildren(
      { title: "Instance title" },
      [
        {
          elementId: "card-instance/card-header/card-heading",
          props: { children: "Instance title" },
        },
      ],
    );

    const doc = useCanonicalDocumentStore.getState().getDocument("project-1");
    const instanceNode = doc?.children.find(
      (node) => node.id === "card-instance",
    ) as RefNode | undefined;
    expect(instanceNode).toMatchObject({
      id: "card-instance",
      type: "ref",
      ref: "card-origin",
      props: { title: "Instance title" },
      descendants: {
        "card-header/card-heading": { children: "Instance title" },
      },
    });
    const originNode = doc?.children.find(
      (node) => node.id === "card-origin",
    ) as CanonicalNode | undefined;
    expect(originNode?.children?.[0]?.children?.[0]?.props).toMatchObject({
      children: "Origin title",
    });
    expect(state.elementsMap.get("card-instance")).toMatchObject({
      overrides: { title: "Instance title" },
      descendants: {
        "card-header/card-heading": { children: "Instance title" },
      },
    });
    expect(state.selectedElementProps).toMatchObject({
      title: "Instance title",
      description: "Origin description",
    });
    await vi.waitFor(() => {
      expect(mocks.db.documents.put).toHaveBeenCalledWith(
        "project-1",
        expect.objectContaining({
          children: expect.arrayContaining([
            expect.objectContaining({
              id: "card-instance",
              props: { title: "Instance title" },
            }),
          ]),
        }),
      );
    });
  });

  it("style panel layout edits merge frame body and slot style into active canonical document", () => {
    const body = makeElement("frame-body", "body", {
      layout_id: "frame-1",
      props: { style: { display: "block" } },
    });
    const slot = makeElement("slot-content", "Slot", {
      parent_id: "frame-body",
      layout_id: "frame-1",
      props: { name: "content", style: { display: "block" } },
      slot_name: "content",
    });
    const state = makeState([body, slot]);
    state.selectedElementId = "frame-body";
    state.selectedElementIds = ["frame-body"];
    state.selectedElementIdsSet = new Set(["frame-body"]);
    state.selectedElementProps = body.props as Record<string, unknown>;
    registerCanonicalActions(state);
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeFrameDocument([
        {
          id: "frame-body",
          type: "body",
          props: body.props as Record<string, unknown>,
          children: [
            {
              id: "slot-content",
              type: "frame",
              placeholder: true,
              props: slot.props as Record<string, unknown>,
              metadata: {
                type: "legacy-slot-hoisted",
                slotName: "content",
              },
              children: [],
            },
          ],
        },
      ]),
    );

    const inspectorActions = createInspectorActionsSlice(
      createSetMock(state) as never,
      () => state as never,
      {} as never,
    );

    inspectorActions.updateSelectedStyles({
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    });

    const frame = useCanonicalDocumentStore.getState().getDocument("project-1")
      ?.children[0] as FrameNode;
    const frameBody = frame.children?.find((node) => node.id === "frame-body");
    expect(frameBody?.props?.style).toMatchObject({
      display: "flex",
      flexDirection: "column",
      rowGap: 12,
      columnGap: 12,
    });
    expect(frameBody?.props?.style).not.toHaveProperty("gap");
    expect(state.elementsMap.get("frame-body")?.props.style).toMatchObject({
      display: "flex",
      flexDirection: "column",
      rowGap: 12,
      columnGap: 12,
    });

    state.selectedElementId = "slot-content";
    state.selectedElementIds = ["slot-content"];
    state.selectedElementIdsSet = new Set(["slot-content"]);
    state.selectedElementProps = slot.props as Record<string, unknown>;
    inspectorActions.updateSelectedStyle("padding", "8px");

    const updatedFrame = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1")?.children[0] as FrameNode;
    const updatedFrameBody = updatedFrame.children?.find(
      (node) => node.id === "frame-body",
    );
    const slotNode = updatedFrameBody?.children?.find(
      (node) => node.id === "slot-content",
    );
    expect(slotNode?.props?.style).toMatchObject({
      display: "block",
      paddingTop: 8,
      paddingRight: 8,
      paddingBottom: 8,
      paddingLeft: 8,
    });
    expect(state.elementsMap.get("slot-content")?.props.style).toMatchObject({
      display: "block",
      paddingTop: 8,
      paddingRight: 8,
      paddingBottom: 8,
      paddingLeft: 8,
    });
  });

  it("updateElementProps preserves frame slot sibling order", async () => {
    const body = makeElement("frame-body", "body", {
      layout_id: "frame-1",
      props: { style: { display: "flex" } },
    });
    const header = makeElement("slot-header", "Slot", {
      parent_id: "frame-body",
      layout_id: "frame-1",
      order_num: 0,
      props: { name: "header" },
      slot_name: "header",
    });
    const content = makeElement("slot-content", "Slot", {
      parent_id: "frame-body",
      layout_id: "frame-1",
      order_num: 1,
      props: { name: "content", style: { padding: 4 } },
      slot_name: "content",
    });
    const footer = makeElement("slot-footer", "Slot", {
      parent_id: "frame-body",
      layout_id: "frame-1",
      order_num: 2,
      props: { name: "footer" },
      slot_name: "footer",
    });
    const state = makeState([body, header, content, footer]);
    registerCanonicalActions(state);
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    setElementsCanonicalPrimary(state.elements);

    await createUpdateElementPropsAction(
      createSetMock(state),
      () => state as never,
    )("slot-content", {
      style: { padding: 8 },
    });

    const frame = useCanonicalDocumentStore.getState().getDocument("project-1")
      ?.children[0] as FrameNode;
    const frameBody = frame.children?.find((node) => node.id === "frame-body");
    expect(frameBody?.children?.map((node) => node.id)).toEqual([
      "slot-header",
      "slot-content",
      "slot-footer",
    ]);
    expect(
      state.childrenMap.get("frame-body")?.map((element) => element.id),
    ).toEqual(["slot-header", "slot-content", "slot-footer"]);
    expect(state.elementsMap.get("slot-content")?.order_num).toBe(1);
  });

  it("updateElementProps preserves plain page body child order", async () => {
    const page = makePage("page-1");
    const body = makeElement("page-body", "body", {
      page_id: page.id,
      props: { style: { display: "flex" } },
    });
    const first = makeElement("page-card-a", "Card", {
      parent_id: "page-body",
      page_id: page.id,
      order_num: 0,
      props: { label: "A" },
    });
    const second = makeElement("page-card-b", "Card", {
      parent_id: "page-body",
      page_id: page.id,
      order_num: 1,
      props: { label: "B" },
    });
    const state = makeState([body, first, second]);
    state.pages = [page];
    state.currentPageId = page.id;
    registerCanonicalActions(state, []);
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    setElementsCanonicalPrimary(state.elements);

    await createUpdateElementPropsAction(
      createSetMock(state),
      () => state as never,
    )("page-card-a", {
      label: "A edited",
    });

    const pageNode = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1")?.children[0] as FrameNode;
    const pageBody = pageNode.children?.find((node) => node.id === "page-body");
    expect(pageBody?.children?.map((node) => node.id)).toEqual([
      "page-card-a",
      "page-card-b",
    ]);
    expect(
      state.childrenMap.get("page-body")?.map((element) => element.id),
    ).toEqual(["page-card-a", "page-card-b"]);
    expect(state.elementsMap.get("page-card-a")?.order_num).toBe(0);
  });

  it("updateElementProps preserves plain page body child order when canonical ownership metadata is stale", async () => {
    const page = makePage("page-1");
    const body = makeElement("page-body", "body", {
      page_id: page.id,
      props: { style: { display: "flex" } },
    });
    const first = makeElement("page-card-a", "Card", {
      parent_id: "page-body",
      page_id: page.id,
      order_num: 0,
      props: { label: "A" },
    });
    const second = makeElement("page-card-b", "Card", {
      parent_id: "page-body",
      page_id: page.id,
      order_num: 1,
      props: { label: "B" },
    });
    const firstCanonical = makeCanonicalElementNode({
      ...first,
      page_id: null,
    });
    const secondCanonical = makeCanonicalElementNode({
      ...second,
      page_id: null,
    });
    const state = makeState([body, first, second]);
    state.pages = [page];
    state.currentPageId = page.id;
    registerCanonicalActions(state, []);
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", {
      version: "composition-1.0",
      children: [
        {
          id: page.id,
          type: "frame",
          name: page.title,
          metadata: {
            type: "legacy-page",
            pageId: page.id,
          },
          children: [
            {
              ...makeCanonicalElementNode(body),
              children: [firstCanonical, secondCanonical],
            },
          ],
        } satisfies FrameNode,
      ],
    });

    await createUpdateElementPropsAction(
      createSetMock(state),
      () => state as never,
    )("page-card-a", {
      label: "A edited",
    });

    const pageNode = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1")?.children[0] as FrameNode;
    const pageBody = pageNode.children?.find((node) => node.id === "page-body");
    expect(pageBody?.children?.map((node) => node.id)).toEqual([
      "page-card-a",
      "page-card-b",
    ]);
    expect(
      state.childrenMap.get("page-body")?.map((element) => element.id),
    ).toEqual(["page-card-a", "page-card-b"]);
  });

  it("updateElementProps preserves frame-bound page slot child order", async () => {
    const page = makePage("page-1", "frame-1");
    const first = makeElement("page-card-a", "Card", {
      parent_id: "page-body",
      page_id: page.id,
      order_num: 0,
      props: { label: "A" },
      slot_name: "content",
    });
    const second = makeElement("page-card-b", "Card", {
      parent_id: "page-body",
      page_id: page.id,
      order_num: 1,
      props: { label: "B" },
      slot_name: "content",
    });
    const state = makeState([first, second]);
    state.pages = [page];
    state.currentPageId = page.id;
    registerCanonicalActions(state);
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", {
      version: "composition-1.0",
      children: [
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
              children: [
                {
                  id: "slot-content",
                  type: "frame",
                  placeholder: true,
                  props: { name: "content" },
                  metadata: {
                    type: "legacy-slot-hoisted",
                    slotName: "content",
                  },
                  children: [],
                },
              ],
            },
          ],
        } satisfies FrameNode,
        {
          id: page.id,
          type: "ref",
          ref: "layout-frame-1",
          name: page.title,
          metadata: {
            type: "legacy-page",
            pageId: page.id,
            layoutId: "frame-1",
          },
          descendants: {
            "frame-body/slot-content": {
              children: [
                makeCanonicalElementNode(first),
                makeCanonicalElementNode(second),
              ],
            },
          },
        } satisfies RefNode,
      ],
    });

    await createUpdateElementPropsAction(
      createSetMock(state),
      () => state as never,
    )("page-card-a", {
      label: "A edited",
    });

    const pageRef = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1")
      ?.children.find((node) => node.id === page.id) as RefNode | undefined;
    const children =
      pageRef?.descendants?.["frame-body/slot-content"]?.children;
    expect(children?.map((node) => node.id)).toEqual([
      "page-card-a",
      "page-card-b",
    ]);
  });
});

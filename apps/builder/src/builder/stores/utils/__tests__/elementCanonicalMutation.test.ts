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
import { historyManager } from "../../history";
import { useCanonicalDocumentStore } from "../../canonical/canonicalDocumentStore";
import {
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
  setElementsCanonicalPrimary,
  moveElementCanonicalPrimary,
} from "@/adapters/canonical/canonicalMutations";
import { withComponentInstanceMirror } from "@/adapters/canonical/componentSemanticsMirror";
import { buildLegacyElementMetadata } from "@/adapters/canonical/legacyMetadata";
import { createInspectorActionsSlice } from "../../inspectorActions";
import { createRemoveElementsAction } from "../elementRemoval";
import {
  createBatchUpdateElementPropsAction,
  createUpdateElementAction,
  createUpdateElementPropsAction,
} from "../elementUpdate";

const mocks = vi.hoisted(() => ({
  db: {
    elements: {
      deleteMany: vi.fn(async () => {}),
      insertMany: vi.fn(async () => {}),
      update: vi.fn(async (_id: string) => {}),
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
  activeBreakpoint: "desktop" | "tablet" | "mobile";
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
    // ADR-154: responsive override 를 canonical 노드에 전파 (getSelectedElement 가 canonical
    // 을 읽으므로, 미전파 시 shouldWriteBreakpointOverride 가 override 를 못 본다).
    ...(element.responsive ? { responsive: element.responsive } : {}),
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
    // ADR-154: updateSelectedStyle 은 activeBreakpoint !== "desktop" 일 때 base 대신
    // responsive override 로 저장한다. mock state 가 이 값을 누락하면 undefined !==
    // "desktop" 이 참이 되어 base 편집 테스트가 responsive 분기로 새어 실패한다 —
    // 기본값 desktop(base) 을 명시.
    activeBreakpoint: "desktop",
    _cancelHydrateSelectedProps: vi.fn(),
    updateElement: vi.fn(),
    batchUpdateElementProps: vi.fn(),
  };
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
          type: "body" as CanonicalNode["type"],
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
            } as FrameNode,
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
            } as FrameNode,
          ],
        },
      ]),
    );

    await createRemoveElementsAction(
      createSetMock(state) as never,
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
              type: "body" as CanonicalNode["type"],
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
                } as RefNode,
              ],
            },
          ],
        } satisfies FrameNode,
      ],
    });

    await createRemoveElementsAction(
      createSetMock(state) as never,
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
          type: "body" as CanonicalNode["type"],
          props: body.props as Record<string, unknown>,
          children: [],
        },
      ]),
    );

    await createUpdateElementPropsAction(
      createSetMock(state) as never,
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

  it("updateElement replaces one canonical node and derived row without rebuilding indexes", async () => {
    const first = makeElement("first", "Button", {
      layout_id: "frame-1",
      customId: "first",
      props: { label: "First" },
    });
    const target = makeElement("target", "Button", {
      layout_id: "frame-1",
      customId: "before",
      props: { label: "Target" },
    });
    const last = makeElement("last", "Button", {
      layout_id: "frame-1",
      customId: "last",
      props: { label: "Last" },
    });
    const state = makeState([first, target, last]) as ReturnType<
      typeof makeState
    > & {
      _rebuildIndexes: ReturnType<typeof vi.fn>;
    };
    state._rebuildIndexes = vi.fn();
    state.currentPageId = "page-1";
    registerCanonicalActions(state);
    useCanonicalDocumentStore
      .getState()
      .setDocument(
        "project-1",
        makeFrameDocument([
          makeCanonicalElementNode(first),
          makeCanonicalElementNode(target),
          makeCanonicalElementNode(last),
        ]),
      );

    await createUpdateElementAction(
      createSetMock(state) as never,
      () => state as never,
    )("target", { customId: "after" });

    const frame = useCanonicalDocumentStore.getState().getDocument("project-1")
      ?.children[0] as FrameNode;
    expect(frame.children?.map((node) => node.id)).toEqual([
      "first",
      "target",
      "last",
    ]);
    expect(frame.children?.[1]?.metadata).toMatchObject({
      customId: "after",
      legacyProps: expect.objectContaining({ customId: "after" }),
    });
    expect(state.elementsMap.get("target")?.customId).toBe("after");
    expect(state._rebuildIndexes).not.toHaveBeenCalled();
    expect(historyManager.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "update",
        elementId: "target",
        data: {
          canonicalEvents: [
            expect.objectContaining({ type: "remove" }),
            expect.objectContaining({ type: "insert" }),
          ],
        },
      }),
    );
  });

  it("updateElement preserves duplicate-id all-occurrence compatibility", async () => {
    const first = makeElement("duplicate", "Button", {
      layout_id: "frame-1",
      props: { label: "First" },
    });
    const second = makeElement("duplicate", "Button", {
      layout_id: "frame-1",
      props: { label: "Second" },
    });
    const state = makeState([first, second]) as ReturnType<typeof makeState> & {
      _rebuildIndexes: ReturnType<typeof vi.fn>;
    };
    state._rebuildIndexes = vi.fn();
    registerCanonicalActions(state);
    useCanonicalDocumentStore
      .getState()
      .setDocument(
        "project-1",
        makeFrameDocument([
          makeCanonicalElementNode(first),
          makeCanonicalElementNode(second),
        ]),
      );

    await createUpdateElementAction(
      createSetMock(state) as never,
      () => state as never,
    )("duplicate", { props: { label: "Edited" } });

    const frame = useCanonicalDocumentStore.getState().getDocument("project-1")
      ?.children[0] as FrameNode;
    expect(frame.children?.map((node) => node.props?.label)).toEqual([
      "Edited",
      "Edited",
    ]);
    expect(state._rebuildIndexes).toHaveBeenCalledTimes(1);
  });

  it("updateElement keeps structural parent changes on the rebuild path", async () => {
    const body = makeElement("body", "body", {
      layout_id: "frame-1",
      props: {},
    });
    const child = makeElement("child", "Button", {
      parent_id: "body",
      layout_id: "frame-1",
      props: { label: "Child" },
    });
    const group = makeElement("group", "frame", {
      parent_id: "body",
      layout_id: "frame-1",
      props: {},
    });
    const state = makeState([body, child, group]) as ReturnType<
      typeof makeState
    > & {
      _rebuildIndexes: ReturnType<typeof vi.fn>;
    };
    state._rebuildIndexes = vi.fn();
    registerCanonicalActions(state);
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeFrameDocument([
        {
          ...makeCanonicalElementNode(body),
          children: [
            makeCanonicalElementNode(child),
            { ...makeCanonicalElementNode(group), children: [] },
          ],
        },
      ]),
    );

    await createUpdateElementAction(
      createSetMock(state) as never,
      () => state as never,
    )("child", { parent_id: "group" });

    const frame = useCanonicalDocumentStore.getState().getDocument("project-1")
      ?.children[0] as FrameNode;
    const frameBody = frame.children?.[0];
    const canonicalGroup = frameBody?.children?.find(
      (node) => node.id === "group",
    );
    expect(frameBody?.children?.map((node) => node.id)).toEqual(["group"]);
    expect(canonicalGroup?.children?.map((node) => node.id)).toEqual(["child"]);
    expect(state.elementsMap.get("child")?.parent_id).toBe("group");
    expect(state._rebuildIndexes).toHaveBeenCalledTimes(1);
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
      createSetMock(state) as never,
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

  it("batchUpdateElementProps marks descendants dirty for inherited layout style changes", async () => {
    const parent = makeElement("parent", "Card", {
      page_id: "page-1",
      props: { style: { fontSize: "14px" } },
    });
    const child = makeElement("child", "Text", {
      parent_id: "parent",
      page_id: "page-1",
      props: { children: "Child" },
    });
    const grandchild = makeElement("grandchild", "Text", {
      parent_id: "child",
      page_id: "page-1",
      props: { children: "Grandchild" },
    });
    const state = makeState([parent, child, grandchild]);
    state.currentPageId = "page-1";
    state.pages = [makePage("page-1")];
    registerCanonicalActions(state, []);
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", {
      version: "composition-1.0",
      children: [
        {
          ...makeCanonicalElementNode(parent),
          children: [
            {
              ...makeCanonicalElementNode(child),
              children: [makeCanonicalElementNode(grandchild)],
            },
          ],
        } satisfies CanonicalNode,
      ],
    });

    await createBatchUpdateElementPropsAction(
      createSetMock(state) as never,
      () => state as never,
    )([
      {
        elementId: "parent",
        props: { style: { fontSize: "16px" } },
      },
    ]);

    expect(state.dirtyElementIds).toEqual(
      new Set(["parent", "child", "grandchild"]),
    );
    expect(state.layoutVersion).toBe(1);
  });

  it("batchUpdateElementProps preserves duplicate-id compatibility by updating every occurrence", async () => {
    const first = makeElement("duplicate", "Button", {
      props: { label: "First" },
    });
    const second = makeElement("duplicate", "Button", {
      props: { label: "Second" },
    });
    const state = makeState([first, second]);
    registerCanonicalActions(state, []);
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", {
      version: "composition-1.0",
      children: [
        makeCanonicalElementNode(first),
        makeCanonicalElementNode(second),
      ],
    });

    await createBatchUpdateElementPropsAction(
      createSetMock(state) as never,
      () => state as never,
    )([{ elementId: "duplicate", props: { label: "Edited" } }]);

    const duplicates = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1")?.children;
    expect(duplicates).toHaveLength(2);
    expect(duplicates?.map((node) => node.props?.label)).toEqual([
      "Edited",
      "Edited",
    ]);
    expect(state.elements.map((element) => element.props.label)).toEqual([
      "Edited",
      "Edited",
    ]);
  });

  it("moveElementCanonicalPrimary persists structural order changes into canonical document", async () => {
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

    moveElementCanonicalPrimary("button-two", "body", 0);

    const doc = useCanonicalDocumentStore.getState().getDocument("project-1");
    const page = doc?.children.find((node) => node.id === "page-1") as
      FrameNode | undefined;
    const bodyNode = page?.children?.find((node) => node.id === "body") as
      FrameNode | undefined;

    expect(bodyNode?.children?.map((node) => node.id)).toEqual([
      "button-two",
      "button-one",
    ]);
  });

  it("updateSelectedProperties preserves sibling order when canonical metadata order is stale", () => {
    const body = makeElement("body", "body", {
      page_id: "page-1",
      order_num: 0,
    });
    const buttonOne = makeElement("button-one", "Button", {
      parent_id: "body",
      page_id: "page-1",
      order_num: 0,
      props: { label: "A" },
    });
    const buttonTwo = makeElement("button-two", "Button", {
      parent_id: "body",
      page_id: "page-1",
      order_num: 1,
      props: { label: "B" },
    });
    const buttonThree = makeElement("button-three", "Button", {
      parent_id: "body",
      page_id: "page-1",
      order_num: 2,
      props: { label: "C" },
    });
    const buttonFour = makeElement("button-four", "Button", {
      parent_id: "body",
      page_id: "page-1",
      order_num: 3,
      props: { label: "D" },
    });
    const state = makeState([
      body,
      buttonOne,
      buttonTwo,
      buttonThree,
      buttonFour,
    ]);
    state.currentPageId = "page-1";
    state.pages = [makePage("page-1")];
    state.selectedElementId = "button-two";
    state.selectedElementIds = ["button-two"];
    state.selectedElementIdsSet = new Set(["button-two"]);
    state.selectedElementProps = buttonTwo.props as Record<string, unknown>;
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
                makeCanonicalElementNode({
                  ...buttonTwo,
                  order_num: 0,
                } as Element),
                makeCanonicalElementNode(buttonThree),
                makeCanonicalElementNode(buttonFour),
              ],
            },
          ],
        } satisfies FrameNode,
      ],
    });

    const inspectorActions = createInspectorActionsSlice(
      createSetMock(state) as never,
      () => state as never,
      {} as never,
    );

    inspectorActions.updateSelectedProperties({ label: "B updated" });

    const doc = useCanonicalDocumentStore.getState().getDocument("project-1");
    const page = doc?.children.find((node) => node.id === "page-1") as
      FrameNode | undefined;
    const bodyNode = page?.children?.find((node) => node.id === "body") as
      FrameNode | undefined;

    expect(bodyNode?.children?.map((node) => node.id)).toEqual([
      "button-one",
      "button-two",
      "button-three",
      "button-four",
    ]);
    expect(bodyNode?.children?.[1]?.props).toMatchObject({
      label: "B updated",
    });
    expect(state.childrenMap.get("body")?.map((element) => element.id)).toEqual(
      ["button-one", "button-two", "button-three", "button-four"],
    );
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
        } as RefNode,
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
        } as RefNode,
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
        } as RefNode,
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
        } as RefNode,
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
        } as RefNode,
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
          type: "body" as CanonicalNode["type"],
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
            } as FrameNode,
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

  it("updateSelectedResponsiveVisibility writes tablet/mobile override, no-ops desktop, and clears on show (ADR-154)", () => {
    const body = makeElement("frame-body", "body", {
      layout_id: "frame-1",
      props: { style: { display: "flex" } },
    });
    const state = makeState([body]);
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
          type: "body" as CanonicalNode["type"],
          props: body.props as Record<string, unknown>,
          children: [],
        },
      ]),
    );

    const inspectorActions = createInspectorActionsSlice(
      createSetMock(state) as never,
      () => state as never,
      {} as never,
    );

    // 1) mobile 숨김 → responsive.visibility.mobile === false (canonical 1차 필드)
    inspectorActions.updateSelectedResponsiveVisibility("mobile", false);
    expect(state.elementsMap.get("frame-body")?.responsive).toMatchObject({
      visibility: { mobile: false },
    });
    const doc1 = useCanonicalDocumentStore.getState().getDocument("project-1")
      ?.children[0] as FrameNode;
    expect(
      doc1.children?.find((n) => n.id === "frame-body")?.responsive,
    ).toMatchObject({ visibility: { mobile: false } });

    // 2) desktop = base → no-op (responsive 불변, desktop 키 미생성)
    inspectorActions.updateSelectedResponsiveVisibility("desktop", false);
    const afterDesktop = state.elementsMap.get("frame-body")?.responsive;
    expect(afterDesktop).toMatchObject({ visibility: { mobile: false } });
    expect(afterDesktop?.visibility).not.toHaveProperty("desktop");

    // 3) mobile 다시 표시(true) → override 키 제거 → 빈 config → canonical 에서 생략
    inspectorActions.updateSelectedResponsiveVisibility("mobile", true);
    expect(
      state.elementsMap.get("frame-body")?.responsive?.visibility?.mobile,
    ).toBeUndefined();
    const doc3 = useCanonicalDocumentStore.getState().getDocument("project-1")
      ?.children[0] as FrameNode;
    expect(
      doc3.children?.find((n) => n.id === "frame-body")?.responsive,
    ).toBeUndefined();
  });

  it("updateSelectedStylePreview 는 non-desktop 토글 OFF 면 base(전역)로 preview + 단위 보존 (ADR-154 개정 1)", () => {
    const body = makeElement("frame-body", "body", {
      layout_id: "frame-1",
      props: { style: { display: "flex", width: "100%" } },
    });
    const state = makeState([body]);
    state.activeBreakpoint = "mobile"; // 비-desktop 편집 컨텍스트 (width override 없음 = 토글 OFF)
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
          type: "body" as CanonicalNode["type"],
          props: body.props as Record<string, unknown>,
          children: [],
        },
      ]),
    );

    const inspectorActions = createInspectorActionsSlice(
      createSetMock(state) as never,
      () => state as never,
      {} as never,
    );

    // 개정 1: 토글 OFF → base(전역) preview. width 는 dimensional 이라 "80%" 단위 보존.
    inspectorActions.updateSelectedStylePreview("width", "80%");

    const el = state.elementsMap.get("frame-body");
    // base 에 전역 preview 반영 + % 단위 보존 (숫자 coerce 안 함)
    expect(
      (el?.props?.style as Record<string, unknown> | undefined)?.width,
    ).toBe("80%");
    // responsive override 미생성 (전역 write)
    expect(el?.responsive?.styles?.width?.mobile).toBeUndefined();
    // preview 는 히스토리 엔트리를 만들지 않는다 (commit 경로만 기록)
    expect(historyManager.addEntry).not.toHaveBeenCalled();
    // 레이아웃 재계산 트리거 (layoutVersion bump)
    expect(state.layoutVersion).toBeGreaterThan(0);
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
      createSetMock(state) as never,
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
      createSetMock(state) as never,
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
      createSetMock(state) as never,
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
              type: "body" as CanonicalNode["type"],
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
                } as FrameNode,
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
        } as RefNode,
      ],
    });

    await createUpdateElementPropsAction(
      createSetMock(state) as never,
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
    expect(children?.[0]?.props).toMatchObject({ label: "A edited" });
  });

  it("batchUpdateElementProps updates page ref descendants in one pass without reordering siblings", async () => {
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
          children: [],
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
        } as RefNode,
      ],
    });

    await createBatchUpdateElementPropsAction(
      createSetMock(state) as never,
      () => state as never,
    )([
      { elementId: "page-card-a", props: { label: "A edited" } },
      { elementId: "page-card-b", props: { label: "B edited" } },
    ]);

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
    expect(children?.map((node) => node.props?.label)).toEqual([
      "A edited",
      "B edited",
    ]);
    expect(state.elementsMap.get("page-card-a")?.props).toMatchObject({
      label: "A edited",
    });
    expect(state.elementsMap.get("page-card-b")?.props).toMatchObject({
      label: "B edited",
    });
  });

  // border(색/스타일/너비)는 전역 속성 — 어느 breakpoint 에서 편집해도 base props.style 에
  //   저장되어 모든 breakpoint 에 적용된다 (2026-07-22 사용자 보고, 배경 fills 동형).
  function setupBorderGlobalCase(
    buttonPatch: Partial<Element> & Record<string, unknown> = {},
  ): { state: MockState; button: Element } {
    const body = makeElement("body", "body", { page_id: "page-1" });
    const button = makeElement("btn", "Button", {
      parent_id: "body",
      page_id: "page-1",
      props: { label: "A" },
      ...buttonPatch,
    });
    const state = makeState([body, button]);
    state.currentPageId = "page-1";
    state.pages = [makePage("page-1")];
    state.selectedElementId = "btn";
    state.selectedElementIds = ["btn"];
    state.selectedElementIdsSet = new Set(["btn"]);
    state.selectedElementProps = button.props as Record<string, unknown>;
    state.activeBreakpoint = "mobile";
    registerCanonicalActions(state, []);
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", {
      version: "composition-1.0",
      children: [
        {
          id: "page-1",
          type: "frame",
          name: "Page 1",
          metadata: { type: "legacy-page", pageId: "page-1", parent_id: null },
          children: [
            {
              ...makeCanonicalElementNode(body),
              children: [makeCanonicalElementNode(button)],
            },
          ],
        } satisfies FrameNode,
      ],
    });
    return { state, button };
  }

  function readButtonNode(): CanonicalNode | undefined {
    const page = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1")
      ?.children.find((node) => node.id === "page-1") as FrameNode | undefined;
    const body = page?.children?.find((node) => node.id === "body");
    return body?.children?.find((node) => node.id === "btn");
  }

  it("mobile 에서 border 편집은 base props.style 에 저장(전역), responsive override 아님", () => {
    const { state } = setupBorderGlobalCase();
    const inspectorActions = createInspectorActionsSlice(
      createSetMock(state) as never,
      () => state as never,
      {} as never,
    );

    inspectorActions.updateSelectedStyle("borderColor", "#ff0000");

    const btn = readButtonNode();
    expect((btn?.props?.style as Record<string, unknown>)?.borderColor).toBe(
      "#ff0000",
    );
    const responsive = (btn as { responsive?: { styles?: unknown } })
      ?.responsive;
    expect(
      (responsive?.styles as Record<string, unknown> | undefined)?.borderColor,
    ).toBeUndefined();
  });

  it("mobile 에서 border 편집 시 기존 responsive border override 를 정리(base 우선)", () => {
    const { state } = setupBorderGlobalCase({
      responsive: {
        styles: { borderColor: { mobile: "#00ff00", tablet: "#0000ff" } },
      },
    } as never);
    const inspectorActions = createInspectorActionsSlice(
      createSetMock(state) as never,
      () => state as never,
      {} as never,
    );

    inspectorActions.updateSelectedStyle("borderColor", "#ff0000");

    const btn = readButtonNode();
    expect((btn?.props?.style as Record<string, unknown>)?.borderColor).toBe(
      "#ff0000",
    );
    const responsive = (btn as { responsive?: { styles?: unknown } })
      ?.responsive;
    expect(
      (responsive?.styles as Record<string, unknown> | undefined)?.borderColor,
    ).toBeUndefined();
  });

  it("mobile 에서 eligible 속성(padding)은 토글 OFF 면 base(전역)에 저장 (ADR-154 개정 1)", () => {
    // 개정 1: 편집 기본은 base(전역). eligible 이라도 해당 tier override(토글 ON) 없으면 base.
    const { state } = setupBorderGlobalCase();
    const inspectorActions = createInspectorActionsSlice(
      createSetMock(state) as never,
      () => state as never,
      {} as never,
    );

    inspectorActions.updateSelectedStyle("paddingTop", "24");

    const btn = readButtonNode();
    // base props.style 에 저장(전역), responsive override 미생성
    expect((btn?.props?.style as Record<string, unknown>)?.paddingTop).toBe(24);
    const responsive = (btn as { responsive?: { styles?: unknown } })
      ?.responsive;
    expect(
      (responsive?.styles as Record<string, unknown> | undefined)?.paddingTop,
    ).toBeUndefined();
  });

  it("mobile 에서 eligible 속성(padding) 토글 ON(override 존재)이면 responsive tier 에 저장 (ADR-154 개정 1)", () => {
    // 개정 1: 해당 tier override 가 이미 있으면(토글 ON) 편집이 responsive 로 라우팅.
    const { state } = setupBorderGlobalCase({
      responsive: { styles: { paddingTop: { mobile: 10 } } },
    } as never);
    const inspectorActions = createInspectorActionsSlice(
      createSetMock(state) as never,
      () => state as never,
      {} as never,
    );

    inspectorActions.updateSelectedStyle("paddingTop", "24");

    const btn = readButtonNode();
    const responsive = (btn as { responsive?: { styles?: unknown } })
      ?.responsive;
    expect(
      (responsive?.styles as Record<string, Record<string, unknown>>)
        ?.paddingTop?.mobile,
    ).toBe(24);
  });

  it("updateElement 의 responsive-only 변경이 undo 가능한 replace event 를 남긴다 (ADR-168)", async () => {
    // update event 는 props 만 실어 나르므로(`replaceNodeProps`) props 밖 canonical
    // 필드(`responsive`/`fills`) 변경은 remove+insert 쌍으로 full node 를 기록해야
    // undo 로 되돌아간다. 프리셋이 body `responsive` 를 이 경로로 쓴다.
    const prevResponsive = { styles: { flexDirection: { mobile: "column" } } };
    const body = makeElement("frame-body", "body", {
      layout_id: "frame-1",
      props: { style: { display: "flex" } },
      responsive: prevResponsive,
    } as never);
    const state = makeState([body]) as ReturnType<typeof makeState> & {
      _rebuildIndexes: () => void;
    };
    state.currentPageId = "page-1"; // history 기록 조건
    state._rebuildIndexes = vi.fn(); // updateElement 가 set 이후 호출
    registerCanonicalActions(state);
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeFrameDocument([
        {
          id: "frame-body",
          type: "body" as CanonicalNode["type"],
          props: body.props as Record<string, unknown>,
          responsive: prevResponsive,
          children: [],
        } as unknown as CanonicalNode,
      ]),
    );

    const nextResponsive = { styles: { width: { tablet: "260px" } } };
    await createUpdateElementAction(
      createSetMock(state) as never,
      () => state as never,
    )("frame-body", { responsive: nextResponsive } as never);

    expect(historyManager.addEntry).toHaveBeenCalledTimes(1);
    const entry = vi.mocked(historyManager.addEntry).mock
      .calls[0][0] as unknown as {
      data: {
        canonicalEvents: {
          type: string;
          node: { responsive?: unknown };
        }[];
      };
    };
    const events = entry.data.canonicalEvents;

    // replace 쌍이어야 한다 — update event 면 responsive 가 undo 대상에서 빠진다
    expect(events.map((e) => e.type)).toEqual(["remove", "insert"]);
    // undo 대상(remove) = 변경 **전** responsive
    expect(events[0].node.responsive).toEqual(prevResponsive);
    // redo 대상(insert) = 변경 **후** responsive
    expect(events[1].node.responsive).toEqual(nextResponsive);

    // 같은 write 가 layoutVersion 도 올려야 한다 (preview @media 재발행 트리거)
    expect(state.layoutVersion).toBe(1);
    expect(state._rebuildIndexes).not.toHaveBeenCalled();
  });
});

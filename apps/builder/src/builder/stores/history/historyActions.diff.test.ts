// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument } from "@composition/shared";

import {
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "@/adapters/canonical/canonicalMutations";
import type { Element } from "../../../types/core/store.types";
import { useCanonicalDocumentStore } from "../canonical/canonicalDocumentStore";
import { historyManager } from "../history";
import { useStore } from "../index";

vi.mock("../../../lib/db", () => ({
  getDB: vi.fn(async () => ({
    documents: {
      put: vi.fn(),
    },
  })),
}));

vi.mock("../../../env/supabase.client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

function makeElement(
  id: string,
  props: Record<string, unknown>,
  overrides: Partial<Element> = {},
): Element {
  return {
    id,
    type: "Text",
    parent_id: null,
    page_id: null,
    order_num: 0,
    props,
    ...overrides,
  } as Element;
}

function makeDocument(elements: Element[]): CompositionDocument {
  return {
    version: "composition-1.0",
    children: elements.map((element) => ({
      id: element.id,
      type: element.type,
      props: element.props as Record<string, unknown>,
      children: [],
    })),
  };
}

function getCanonicalProps(elementId: string): Record<string, unknown> {
  const doc = useCanonicalDocumentStore
    .getState()
    .getDocument("history-project");
  const node = doc?.children.find((child) => child.id === elementId);
  return (node?.props ?? {}) as Record<string, unknown>;
}

function getCanonicalIds(): string[] {
  const doc = useCanonicalDocumentStore
    .getState()
    .getDocument("history-project");
  return doc?.children.map((child) => child.id) ?? [];
}

describe("historyActions canonical diff/event application", () => {
  beforeEach(() => {
    historyManager.clearAllHistory();
    historyManager.setCurrentPage("page-1");
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
    useStore.setState({
      elements: [],
      elementsMap: new Map(),
      selectedElementId: null,
      selectedElementProps: {},
      currentPageId: "page-1",
    } as never);
    registerCanonicalMutationStoreActions({
      getCurrentProjectId: () => "history-project",
      getCurrentLegacySnapshot: () => ({
        elements: useStore.getState().elements,
        pages: [],
        layouts: [],
      }),
    });
  });

  afterEach(() => {
    resetCanonicalMutationStoreActions();
    historyManager.clearAllHistory();
  });

  it("applies single serialized diff entries to the active canonical document on undo/redo", async () => {
    const before = makeElement("text-1", { children: "before" });
    const after = makeElement("text-1", { children: "after" });

    useCanonicalDocumentStore
      .getState()
      .setDocument("history-project", makeDocument([before]));
    useCanonicalDocumentStore.getState().setCurrentProject("history-project");

    historyManager.addDiffEntry("update", before, after);

    useCanonicalDocumentStore
      .getState()
      .setDocument("history-project", makeDocument([after]));
    useStore.setState({
      elements: [after],
      elementsMap: new Map([[after.id, after]]),
    } as never);

    await useStore.getState().undo();

    expect(getCanonicalProps("text-1")).toMatchObject({ children: "before" });
    const { elementsMap: undoStoreElementsMap } = useStore.getState();
    expect(undoStoreElementsMap.get("text-1")?.props).toMatchObject({
      children: "before",
    });

    await useStore.getState().redo();

    expect(getCanonicalProps("text-1")).toMatchObject({ children: "after" });
    const { elementsMap: redoStoreElementsMap } = useStore.getState();
    expect(redoStoreElementsMap.get("text-1")?.props).toMatchObject({
      children: "after",
    });
  });

  it("applies batch serialized diff entries without requiring legacy snapshot payloads", async () => {
    const beforeA = makeElement("text-a", { children: "A0" });
    const beforeB = makeElement("text-b", { children: "B0" });
    const afterA = makeElement("text-a", { children: "A1" });
    const afterB = makeElement("text-b", { children: "B1" });

    useCanonicalDocumentStore
      .getState()
      .setDocument("history-project", makeDocument([beforeA, beforeB]));
    useCanonicalDocumentStore.getState().setCurrentProject("history-project");

    historyManager.addBatchDiffEntry([beforeA, beforeB], [afterA, afterB]);

    useCanonicalDocumentStore
      .getState()
      .setDocument("history-project", makeDocument([afterA, afterB]));
    useStore.setState({
      elements: [afterA, afterB],
      elementsMap: new Map([
        [afterA.id, afterA],
        [afterB.id, afterB],
      ]),
    } as never);

    await useStore.getState().undo();

    expect(getCanonicalProps("text-a")).toMatchObject({ children: "A0" });
    expect(getCanonicalProps("text-b")).toMatchObject({ children: "B0" });

    await useStore.getState().redo();

    expect(getCanonicalProps("text-a")).toMatchObject({ children: "A1" });
    expect(getCanonicalProps("text-b")).toMatchObject({ children: "B1" });
  });

  it("replays add/remove entries from canonical node events without legacy element snapshots", async () => {
    const node = {
      id: "button-1",
      type: "Button",
      props: { children: "Save" },
      children: [],
    };

    useCanonicalDocumentStore.getState().setDocument("history-project", {
      version: "composition-1.0",
      children: [node],
    });
    useCanonicalDocumentStore.getState().setCurrentProject("history-project");

    historyManager.addEntry({
      type: "add",
      elementId: node.id,
      data: {
        canonicalEvents: [
          {
            type: "insert",
            node,
            parentId: null,
            index: 0,
          },
        ],
      } as never,
    });

    useStore.setState({
      elements: [
        makeElement(node.id, node.props, {
          type: node.type,
        }),
      ],
      elementsMap: new Map([
        [
          node.id,
          makeElement(node.id, node.props, {
            type: node.type,
          }),
        ],
      ]),
    } as never);

    await useStore.getState().undo();

    expect(getCanonicalIds()).toEqual([]);
    expect(useStore.getState().elementsMap.has(node.id)).toBe(false);

    await useStore.getState().redo();

    expect(getCanonicalIds()).toEqual([node.id]);
    expect(useStore.getState().elementsMap.get(node.id)?.props).toMatchObject({
      children: "Save",
    });

    historyManager.addEntry({
      type: "remove",
      elementId: node.id,
      data: {
        canonicalEvents: [
          {
            type: "remove",
            node,
            parentId: null,
            index: 0,
          },
        ],
      } as never,
    });

    useCanonicalDocumentStore.getState().setDocument("history-project", {
      version: "composition-1.0",
      children: [],
    });
    useStore.setState({
      elements: [],
      elementsMap: new Map(),
    } as never);

    await useStore.getState().undo();

    expect(getCanonicalIds()).toEqual([node.id]);
    expect(useStore.getState().elementsMap.get(node.id)?.props).toMatchObject({
      children: "Save",
    });
  });

  it("replays group entries from canonical insert/move events without legacy group snapshots", async () => {
    const childA = {
      id: "child-a",
      type: "Button",
      props: { children: "A" },
      children: [],
    };
    const childB = {
      id: "child-b",
      type: "Button",
      props: { children: "B" },
      children: [],
    };
    const group = {
      id: "group-1",
      type: "Group",
      props: { label: "Group" },
      children: [],
    };

    historyManager.addEntry({
      type: "group",
      elementId: group.id,
      elementIds: [childA.id, childB.id],
      data: {
        canonicalEvents: [
          {
            type: "insert",
            node: group,
            parentId: null,
            index: 0,
          },
          {
            type: "move",
            nodeId: childA.id,
            fromParentId: null,
            fromIndex: 0,
            toParentId: group.id,
            toIndex: 0,
          },
          {
            type: "move",
            nodeId: childB.id,
            fromParentId: null,
            fromIndex: 1,
            toParentId: group.id,
            toIndex: 1,
          },
        ],
      } as never,
    });

    useCanonicalDocumentStore.getState().setDocument("history-project", {
      version: "composition-1.0",
      children: [
        {
          ...group,
          children: [childA, childB],
        },
      ],
    });
    useCanonicalDocumentStore.getState().setCurrentProject("history-project");
    useStore.setState({
      elements: [
        makeElement(group.id, group.props, { type: group.type }),
        makeElement(childA.id, childA.props, {
          type: childA.type,
          parent_id: group.id,
        }),
        makeElement(childB.id, childB.props, {
          type: childB.type,
          parent_id: group.id,
        }),
      ],
      elementsMap: new Map(),
    } as never);

    await useStore.getState().undo();

    const undoDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("history-project");
    expect(undoDoc?.children.map((child) => child.id)).toEqual([
      childA.id,
      childB.id,
    ]);

    await useStore.getState().redo();

    const redoDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("history-project");
    expect(redoDoc?.children.map((child) => child.id)).toEqual([group.id]);
    expect(redoDoc?.children[0]?.children?.map((child) => child.id)).toEqual([
      childA.id,
      childB.id,
    ]);
  });
});

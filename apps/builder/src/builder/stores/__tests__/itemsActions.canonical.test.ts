import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "../../../adapters/canonical/canonicalMutations";
import { useCanonicalDocumentStore } from "../canonical/canonicalDocumentStore";
import { __resetTraversalCache_TEST_ONLY__ } from "../canonical/canonicalTraversalHelpers";
import { useStore } from "../elements";

vi.mock("../../../lib/db", () => ({
  getDB: async () => ({
    documents: { put: vi.fn() },
  }),
}));

function resetCanonicalStore(): void {
  useCanonicalDocumentStore.setState({
    documents: new Map(),
    currentProjectId: null,
    documentVersion: 0,
  });
  __resetTraversalCache_TEST_ONLY__();
}

describe("items actions canonical lookup", () => {
  beforeEach(() => {
    resetCanonicalStore();
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => {
        const state = useStore.getState();
        return {
          elements: state.elements,
          pages: state.pages,
          layouts: [],
        };
      },
      getCurrentProjectId: () =>
        useCanonicalDocumentStore.getState().currentProjectId,
    });
  });

  afterEach(() => {
    resetCanonicalMutationStoreActions();
    resetCanonicalStore();
  });

  it("cached canonical node source가 stale legacy items보다 우선한다", async () => {
    const elementId = "select-canonical";
    const canonicalElement = {
      id: elementId,
      type: "Select",
      props: { items: [{ id: "canonical", label: "Canonical" }] },
    };
    const staleLegacyElement = {
      id: elementId,
      type: "Select",
      parent_id: null,
      page_id: "page-1",
      order_num: 0,
      props: { items: [{ id: "legacy", label: "Legacy" }] },
    };
    useCanonicalDocumentStore.setState({
      documents: new Map([
        [
          "project-items",
          {
            version: "composition-1.0",
            children: [canonicalElement],
          } as never,
        ],
      ]),
      currentProjectId: "project-items",
      documentVersion: 1,
    });
    useStore.setState({
      currentPageId: null,
      elements: [staleLegacyElement as never],
      elementsMap: new Map([[elementId, staleLegacyElement as never]]),
      childrenMap: new Map(),
    } as never);

    await useStore
      .getState()
      .addItem(elementId, "items", { id: "new", label: "New" });

    const items = useStore.getState().elementsMap.get(elementId)?.props
      .items as Array<{ id: string }> | undefined;
    expect(items?.map((item) => item.id)).toEqual(["canonical", "new"]);
  });

  it("active canonical document에 없는 id를 stale legacy cache에서 되살리지 않는다", async () => {
    const staleElement = {
      id: "stale-select",
      type: "Select",
      parent_id: null,
      page_id: "page-1",
      order_num: 0,
      props: { items: [{ id: "legacy", label: "Legacy" }] },
    };
    useCanonicalDocumentStore.setState({
      documents: new Map([
        [
          "project-items",
          {
            version: "composition-1.0",
            children: [],
          } as never,
        ],
      ]),
      currentProjectId: "project-items",
      documentVersion: 1,
    });
    useStore.setState({
      currentPageId: null,
      elements: [staleElement as never],
      elementsMap: new Map([[staleElement.id, staleElement as never]]),
      childrenMap: new Map(),
    } as never);

    await useStore
      .getState()
      .addItem(staleElement.id, "items", { id: "new", label: "New" });

    const items = useStore.getState().elementsMap.get(staleElement.id)?.props
      .items as Array<{ id: string }>;
    expect(items.map((item) => item.id)).toEqual(["legacy"]);
  });

  it("duplicate id에서도 후속 mutation과 같은 첫 DFS node의 items를 읽는다", async () => {
    const elementId = "duplicate-select";
    useCanonicalDocumentStore.setState({
      documents: new Map([
        [
          "project-items",
          {
            version: "composition-1.0",
            children: [
              {
                id: elementId,
                type: "Select",
                props: { items: [{ id: "first", label: "First" }] },
              },
              {
                id: elementId,
                type: "Select",
                props: { items: [{ id: "last", label: "Last" }] },
              },
            ],
          } as never,
        ],
      ]),
      currentProjectId: "project-items",
      documentVersion: 1,
    });
    useStore.setState({
      currentPageId: null,
      elements: [],
      elementsMap: new Map(),
      childrenMap: new Map(),
    } as never);

    await useStore
      .getState()
      .addItem(elementId, "items", { id: "new", label: "New" });

    const items = useStore.getState().elementsMap.get(elementId)?.props
      .items as Array<{ id: string }>;
    expect(items.map((item) => item.id)).toEqual(["first", "new"]);
  });

  it("structural duplicate를 건너뛰고 첫 projectable node의 items를 보존한다", async () => {
    const elementId = "structural-duplicate-select";
    useCanonicalDocumentStore.setState({
      documents: new Map([
        [
          "project-items",
          {
            version: "composition-1.0",
            children: [
              { id: elementId, type: "group" },
              {
                id: elementId,
                type: "Select",
                props: { items: [{ id: "existing", label: "Existing" }] },
              },
            ],
          } as never,
        ],
      ]),
      currentProjectId: "project-items",
      documentVersion: 1,
    });
    useStore.setState({
      currentPageId: null,
      elements: [],
      elementsMap: new Map(),
      childrenMap: new Map(),
    } as never);

    await useStore
      .getState()
      .addItem(elementId, "items", { id: "new", label: "New" });

    const items = useStore.getState().elementsMap.get(elementId)?.props
      .items as Array<{ id: string }>;
    expect(items.map((item) => item.id)).toEqual(["existing", "new"]);

    const document = useCanonicalDocumentStore
      .getState()
      .documents.get("project-items");
    expect(
      document?.children.map((node) =>
        ((node.props?.items ?? []) as Array<{ id: string }>).map(
          (item) => item.id,
        ),
      ),
    ).toEqual([["existing", "new"]]);
  });
});

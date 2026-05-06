import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import type { Element } from "../../../../../types/core/store.types";
import { useStore } from "../../../../stores";
import { useCanonicalDocumentStore } from "../../../../stores/canonical/canonicalDocumentStore";
import { getEditingSemanticsRole } from "../../../../utils/editingSemantics";
import { toPageFrameElementId } from "../../../../workspace/canvas/scene/resolvePageWithFrame";
import { useLayerTreeData } from "./useLayerTreeData";

function makeElement(id: string, overrides: Partial<Element> = {}): Element {
  return {
    id,
    type: "Box",
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    props: {},
    ...overrides,
  } as Element;
}

describe("useLayerTreeData", () => {
  beforeEach(() => {
    useStore.setState({
      elements: [],
      elementsMap: new Map(),
      childrenMap: new Map(),
      currentPageId: null,
    } as never);
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
  });

  it("projects canonical ref instances as origin type with synthetic children", () => {
    const body = makeElement("body", {
      type: "body",
      parent_id: null,
      order_num: 0,
    });
    const origin = makeElement("origin", {
      type: "NumberField",
      reusable: true,
      parent_id: "body",
      order_num: 0,
      props: { label: "Amount" },
    } as never);
    const label = makeElement("label", {
      type: "Label",
      customId: "label",
      parent_id: "origin",
      order_num: 0,
      props: { text: "Amount" },
    });
    const input = makeElement("input", {
      type: "Input",
      customId: "input",
      parent_id: "origin",
      order_num: 1,
      props: { value: "0" },
    });
    const ref = makeElement("instance", {
      type: "ref",
      ref: "origin",
      parent_id: "body",
      order_num: 1,
      descendants: {
        label: { text: "Price" },
      },
    } as never);
    const elements = [body, origin, label, input, ref];

    useStore.setState({
      elements,
      elementsMap: new Map(elements.map((element) => [element.id, element])),
    } as never);

    const { result } = renderHook(() => useLayerTreeData(elements));
    const instanceNode = result.current.nodeMap.get("instance");

    expect(instanceNode).toMatchObject({
      id: "instance",
      name: "NumberField",
      type: "NumberField",
      hasChildren: true,
    });
    expect(instanceNode?.element).toBe(ref);
    expect(getEditingSemanticsRole(instanceNode?.element)).toBe("instance");
    expect(instanceNode?.children).toEqual([
      expect.objectContaining({
        id: "instance/label",
        name: "Label",
        isSyntheticRefChild: true,
      }),
      expect.objectContaining({
        id: "instance/input",
        name: "Input",
        isSyntheticRefChild: true,
      }),
    ]);
    expect(result.current.disabledKeys.has("instance/label")).toBe(false);
    expect(result.current.disabledKeys.has("instance/input")).toBe(false);
  });

  it("projects canonical-store ref instances with origin children", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "origin",
          type: "NumberField",
          name: "NumberField",
          reusable: true,
          props: { label: "Amount" },
          children: [
            {
              id: "label",
              type: "Label",
              name: "label",
              props: { text: "Amount" },
            },
            {
              id: "input",
              type: "Input",
              name: "input",
              props: { value: "0" },
            },
          ],
        },
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            {
              id: "body",
              type: "Body",
              props: {},
              children: [
                {
                  id: "instance",
                  type: "ref",
                  ref: "origin",
                  props: {},
                  descendants: {
                    label: { props: { text: "Price" } },
                  },
                },
              ],
            },
          ],
        },
      ],
    } as never;

    useStore.setState({
      currentPageId: "page-1",
      elements: [],
      elementsMap: new Map(),
      pageElementsSnapshot: {},
    } as never);
    act(() => {
      const canonical = useCanonicalDocumentStore.getState();
      canonical.setDocument("project-1", doc);
      canonical.setCurrentProject("project-1");
    });

    const { result } = renderHook(() => useLayerTreeData([]));
    const instanceNode = result.current.nodeMap.get("instance");

    expect(instanceNode).toMatchObject({
      id: "instance",
      name: "NumberField",
      type: "NumberField",
      hasChildren: true,
    });
    expect(getEditingSemanticsRole(instanceNode?.element)).toBe("instance");
    expect(instanceNode?.children).toEqual([
      expect.objectContaining({
        id: "instance/label",
        name: "Label",
        isSyntheticRefChild: true,
      }),
      expect.objectContaining({
        id: "instance/input",
        name: "Input",
        isSyntheticRefChild: true,
      }),
    ]);
    expect(
      result.current.nodeMap.get("instance/label")?.element.props,
    ).toMatchObject({
      text: "Price",
    });
  });

  it("includes frame body when current page binds a reusable frame", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "page-1",
          type: "ref",
          ref: "layout-frame-1",
          metadata: {
            type: "legacy-page",
            pageId: "page-1",
            layoutId: "frame-1",
          },
        },
        {
          id: "layout-frame-1",
          type: "frame",
          reusable: true,
          metadata: { type: "legacy-layout", layoutId: "frame-1" },
          children: [
            {
              id: "frame-body",
              type: "Body",
              props: { style: { display: "flex" } },
              children: [],
            },
          ],
        },
      ],
    } as never;

    useStore.setState({
      currentPageId: "page-1",
      pages: [
        {
          id: "page-1",
          title: "Page 1",
          project_id: "project-1",
          layout_id: "frame-1",
        },
      ],
      elements: [],
      elementsMap: new Map(),
      pageElementsSnapshot: {},
    } as never);
    act(() => {
      const canonical = useCanonicalDocumentStore.getState();
      canonical.setDocument("project-1", doc);
      canonical.setCurrentProject("project-1");
    });

    const { result } = renderHook(() => useLayerTreeData([]));

    expect(result.current.treeNodes.map((node) => node.id)).toContain(
      "frame-body",
    );
  });

  it("excludes page-scoped frame projection elements when current page has no frame", () => {
    const pageBody = makeElement("page-body", {
      type: "body",
      page_id: "page-1",
      order_num: 0,
    });
    const projectedFrameBody = makeElement("frame-body", {
      type: "body",
      page_id: "page-1",
      layout_id: "frame-1",
      order_num: 0,
    } as never);
    const projectedSlot = makeElement("slot-content", {
      type: "Slot",
      parent_id: "frame-body",
      page_id: "page-1",
      layout_id: "frame-1",
      order_num: 1,
    } as never);
    const elements = [projectedFrameBody, pageBody, projectedSlot];

    useStore.setState({
      currentPageId: "page-1",
      pages: [
        {
          id: "page-1",
          title: "Page 1",
          project_id: "project-1",
          slug: "/page-1",
          layout_id: null,
        },
      ],
      elements,
      elementsMap: new Map(elements.map((element) => [element.id, element])),
    } as never);

    const { result } = renderHook(() => useLayerTreeData(elements));

    expect(result.current.treeNodes.map((node) => node.id)).toEqual([
      "page-body",
    ]);
  });

  it("projects frame-bound page children under the resolved content slot", () => {
    const pageBody = makeElement("page-body", {
      type: "body",
      page_id: "page-1",
      order_num: 0,
    });
    const pageCard = makeElement("page-card", {
      type: "Card",
      parent_id: "page-body",
      page_id: "page-1",
      order_num: 1,
    });
    const frameBody = makeElement("frame-body", {
      type: "body",
      page_id: null,
      layout_id: "frame-1",
      order_num: 0,
    } as never);
    const frameSlot = makeElement("slot-content", {
      type: "Slot",
      parent_id: "frame-body",
      page_id: null,
      layout_id: "frame-1",
      order_num: 0,
      props: { name: "content" },
    } as never);
    const elements = [pageBody, pageCard, frameBody, frameSlot];
    const slotId = toPageFrameElementId("page-1", "slot-content");

    useStore.setState({
      currentPageId: "page-1",
      pages: [
        {
          id: "page-1",
          title: "Page 1",
          project_id: "project-1",
          slug: "/page-1",
          layout_id: "frame-1",
        },
      ],
      elements,
      elementsMap: new Map(elements.map((element) => [element.id, element])),
    } as never);

    const { result } = renderHook(() => useLayerTreeData(elements));

    expect(result.current.treeNodes.map((node) => node.id)).toEqual([
      "page-body",
    ]);
    expect(result.current.nodeMap.get("page-body")?.children?.[0]?.id).toBe(
      slotId,
    );
    expect(
      result.current.nodeMap.get(slotId)?.children?.map((node) => node.id),
    ).toEqual(["page-card"]);
    expect(result.current.nodeMap.get("page-card")?.parentId).toBe(slotId);
  });

  it("keeps live page snapshot children when canonical frame binding is active", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "page-1",
          type: "ref",
          ref: "layout-frame-1",
          metadata: {
            type: "legacy-page",
            pageId: "page-1",
            layoutId: "frame-1",
          },
        },
        {
          id: "layout-frame-1",
          type: "frame",
          reusable: true,
          metadata: { type: "legacy-layout", layoutId: "frame-1" },
          children: [
            {
              id: "frame-body",
              type: "body",
              props: { style: { display: "flex" } },
              children: [
                {
                  id: "slot-content",
                  type: "frame",
                  metadata: {
                    type: "legacy-slot-hoisted",
                    slotName: "content",
                  },
                  props: { name: "content" },
                },
              ],
            },
          ],
        },
      ],
    } as never;
    const pageBody = makeElement("page-body", {
      type: "body",
      page_id: "page-1",
      order_num: 0,
    });
    const pageCard = makeElement("page-card", {
      type: "Card",
      parent_id: "page-body",
      page_id: "page-1",
      order_num: 1,
    });
    const slotId = toPageFrameElementId("page-1", "slot-content");
    const layerElements = [pageBody, pageCard];

    useStore.setState({
      currentPageId: "page-1",
      pages: [
        {
          id: "page-1",
          title: "Page 1",
          project_id: "project-1",
          slug: "/page-1",
          layout_id: "frame-1",
        },
      ],
      elements: layerElements,
      elementsMap: new Map(
        layerElements.map((element) => [element.id, element]),
      ),
      pageElementsSnapshot: { "page-1": layerElements },
    } as never);
    act(() => {
      const canonical = useCanonicalDocumentStore.getState();
      canonical.setDocument("project-1", doc);
      canonical.setCurrentProject("project-1");
    });

    const { result } = renderHook(() => useLayerTreeData(layerElements));

    expect(
      result.current.nodeMap.get(slotId)?.children?.map((node) => node.id),
    ).toEqual(["page-card"]);
  });

  it("filters canonical layer source to the selected page", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [{ id: "body-1", type: "body", props: {} }],
        },
        {
          id: "page-2",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-2" },
          children: [{ id: "body-2", type: "body", props: {} }],
        },
        {
          id: "page-3",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-3" },
          children: [{ id: "body-3", type: "body", props: {} }],
        },
      ],
    };
    const pageTwoBody = makeElement("body-2", {
      type: "body",
      page_id: "page-2",
    });

    useStore.setState({
      currentPageId: "page-2",
      elements: [pageTwoBody],
      elementsMap: new Map([["body-2", pageTwoBody]]),
      pageElementsSnapshot: { "page-2": [pageTwoBody] },
    } as never);
    act(() => {
      const canonical = useCanonicalDocumentStore.getState();
      canonical.setDocument("project-1", doc);
      canonical.setCurrentProject("project-1");
    });

    const { result } = renderHook(() => useLayerTreeData([pageTwoBody]));

    expect(result.current.treeNodes.map((node) => node.id)).toEqual(["body-2"]);
  });
});

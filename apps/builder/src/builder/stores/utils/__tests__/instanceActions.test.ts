import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CanonicalNode,
  CompositionDocument,
  RefNode,
} from "@composition/shared";
import {
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "@/adapters/canonical/canonicalMutations";
import {
  COMPONENT_DESCENDANTS_MIRROR_FIELD,
  COMPONENT_MASTER_ID_MIRROR_FIELD,
  COMPONENT_OVERRIDES_MIRROR_FIELD,
  COMPONENT_ROLE_MIRROR_FIELD,
  withComponentInstanceMirror,
  withComponentOriginMirror,
} from "@/adapters/canonical/componentSemanticsMirror";
import type { Element, Page } from "../../../../types/core/store.types";
import { useCanonicalDocumentStore } from "../../canonical/canonicalDocumentStore";
import {
  resolveEditingSemanticsImpactConfirmation,
  subscribeEditingSemanticsImpactConfirmation,
  type EditingSemanticsImpactConfirmationRequest,
} from "../../../utils/editingSemanticsImpactConfirmation";
import { useStore } from "../../elements";
import { historyManager } from "../../history";

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

function findCanonicalNodeById(
  nodes: CanonicalNode[],
  id: string,
): CanonicalNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findCanonicalNodeById(node.children ?? [], id);
    if (found) return found;
  }
  return undefined;
}

describe("instance store actions", () => {
  const addEntrySpy = vi.spyOn(historyManager, "addEntry");

  beforeEach(() => {
    resetCanonicalMutationStoreActions();
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
    addEntrySpy.mockClear();
    historyManager.setCurrentPage("page-1");
    useStore.setState({
      currentPageId: "page-1",
      pages: [],
      elements: [],
      elementsMap: new Map(),
      childrenMap: new Map(),
      selectedElementId: null,
      selectedElementProps: {},
      selectedElementIds: [],
      selectedElementIdsSet: new Set<string>(),
      multiSelectMode: false,
    } as never);
  });

  it("creates a legacy instance with a fresh customId instead of reusing origin customId", () => {
    const body = makeElement("body", {
      type: "body",
      customId: "body_1",
      parent_id: null,
      order_num: 0,
    });
    const origin = withComponentOriginMirror(
      makeElement("origin", {
        customId: "button_1",
        parent_id: body.id,
        order_num: 1,
      }),
    );

    useStore.setState({
      elements: [body, origin],
      elementsMap: new Map([
        [body.id, body],
        [origin.id, origin],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();

    const instance = useStore
      .getState()
      .createInstance(origin.id, body.id, "page-1");

    expect(instance).toEqual(
      expect.objectContaining({
        customId: "button_2",
        [COMPONENT_ROLE_MIRROR_FIELD]: "instance",
        [COMPONENT_MASTER_ID_MIRROR_FIELD]: origin.id,
      }),
    );
    expect(instance?.customId).not.toBe(origin.customId);
    expect(
      useStore.getState().elementsMap.get(instance?.id ?? "")?.customId,
    ).toBe("button_2");
  });

  it("creates an instance customId after existing ref instance IDs with the same base", () => {
    const body = makeElement("body", {
      type: "body",
      customId: "body_1",
      parent_id: null,
      order_num: 0,
    });
    const origin = withComponentOriginMirror(
      makeElement("origin", {
        customId: "button_1",
        parent_id: body.id,
        order_num: 1,
      }),
    );
    const existingInstance = makeElement("existing-instance", {
      type: "ref",
      customId: "button_2",
      parent_id: body.id,
      order_num: 2,
    });

    useStore.setState({
      elements: [body, origin, existingInstance],
      elementsMap: new Map([
        [body.id, body],
        [origin.id, origin],
        [existingInstance.id, existingInstance],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();

    const instance = useStore
      .getState()
      .createInstance(origin.id, body.id, "page-1");

    expect(instance?.customId).toBe("button_3");
  });

  it("syncs a created instance customId into the active canonical document for refresh", () => {
    const page = {
      id: "page-1",
      title: "Home",
      project_id: "project-1",
      slug: "/",
      order_num: 0,
    } as Page;
    const body = makeElement("body", {
      type: "body",
      customId: "body_1",
      parent_id: null,
      order_num: 0,
    });
    const origin = withComponentOriginMirror(
      makeElement("origin", {
        customId: "button_1",
        parent_id: body.id,
        order_num: 1,
      }),
    );
    const doc = {
      version: "composition-1.0",
      children: [
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            {
              id: "body",
              type: "body",
              props: {},
              metadata: {
                type: "legacy-element-props",
                customId: "body_1",
              },
              children: [
                {
                  id: "origin",
                  type: "Button",
                  reusable: true,
                  props: {},
                  metadata: {
                    type: "legacy-element-props",
                    customId: "button_1",
                  },
                },
              ],
            },
          ],
        },
      ],
    } satisfies CompositionDocument;

    useStore.setState({
      currentPageId: "page-1",
      pages: [page],
      elements: [body, origin],
      elementsMap: new Map([
        [body.id, body],
        [origin.id, origin],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", doc);
    registerCanonicalMutationStoreActions({
      mergeElements: useStore.getState().mergeElements,
      setElements: useStore.getState().setElements,
      getCurrentLegacySnapshot: () => ({
        elements: useStore.getState().elements,
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    const instance = useStore
      .getState()
      .createInstance(origin.id, body.id, "page-1");

    expect(instance?.customId).toBe("button_2");
    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const instanceNode = findCanonicalNodeById(
      nextDoc?.children ?? [],
      instance?.id ?? "",
    );
    expect(instanceNode).toMatchObject({
      id: instance?.id,
      type: "ref",
      ref: origin.id,
      metadata: expect.objectContaining({
        customId: "button_2",
        legacyProps: expect.objectContaining({
          customId: "button_2",
          componentRole: "instance",
          masterId: origin.id,
        }),
      }),
    });
  });

  it("detaches a legacy instance into a standalone element", () => {
    const master = withComponentOriginMirror(
      makeElement("master", {
        props: { label: "Master", style: { color: "red", padding: "8px" } },
      }),
    );
    const instance = withComponentInstanceMirror(
      makeElement("instance", {
        props: { ignored: true },
      }),
      "master",
      { overrideProps: { label: "Instance", style: { color: "blue" } } },
    );

    useStore.setState({
      elements: [master, instance],
      selectedElementId: "instance",
      elementsMap: new Map([
        ["master", master],
        ["instance", instance],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();

    const result = useStore.getState().detachInstance("instance");
    const detached = useStore.getState().elementsMap.get("instance");

    expect(result?.previousState).toMatchObject({
      [COMPONENT_ROLE_MIRROR_FIELD]: "instance",
      [COMPONENT_MASTER_ID_MIRROR_FIELD]: "master",
    });
    expect(detached).toMatchObject({
      id: "instance",
      [COMPONENT_ROLE_MIRROR_FIELD]: undefined,
      [COMPONENT_MASTER_ID_MIRROR_FIELD]: undefined,
      [COMPONENT_OVERRIDES_MIRROR_FIELD]: undefined,
      [COMPONENT_DESCENDANTS_MIRROR_FIELD]: undefined,
      props: { label: "Instance", style: { color: "blue", padding: "8px" } },
    });
    expect(
      useStore.getState().componentIndex.masterToInstances.get("master"),
    ).toBeUndefined();
    expect(useStore.getState().selectedElementProps.label).toBe("Instance");
    expect(addEntrySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "batch",
        elementId: "instance",
        data: expect.objectContaining({
          prevElements: [instance],
          elements: [expect.objectContaining({ id: "instance" })],
        }),
      }),
    );
  });

  it("resets a legacy instance root override field with history", async () => {
    const master = withComponentOriginMirror(
      makeElement("master", {
        props: { label: "Master", style: { color: "red" } },
      }),
    );
    const instance = withComponentInstanceMirror(
      makeElement("instance"),
      "master",
      { overrideProps: { label: "Instance", style: { color: "blue" } } },
    );

    useStore.setState({
      elements: [master, instance],
      selectedElementId: "instance",
      elementsMap: new Map([
        ["master", master],
        ["instance", instance],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();

    const result = useStore
      .getState()
      .resetInstanceOverrideField("instance", "label");

    expect(result?.previousState).toEqual(instance);
    expect(useStore.getState().elementsMap.get("instance")).toMatchObject({
      [COMPONENT_OVERRIDES_MIRROR_FIELD]: { style: { color: "blue" } },
    });
    expect(addEntrySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "update",
        elementId: "instance",
        data: expect.objectContaining({
          prevElement: instance,
          element: expect.objectContaining({
            [COMPONENT_OVERRIDES_MIRROR_FIELD]: {
              style: { color: "blue" },
            },
          }),
        }),
      }),
    );

    await useStore.getState().undo();
    expect(useStore.getState().elementsMap.get("instance")).toMatchObject({
      [COMPONENT_OVERRIDES_MIRROR_FIELD]: {
        label: "Instance",
        style: { color: "blue" },
      },
    });

    await useStore.getState().redo();
    expect(useStore.getState().elementsMap.get("instance")).toMatchObject({
      [COMPONENT_OVERRIDES_MIRROR_FIELD]: { style: { color: "blue" } },
    });
  });

  it("resets a canonical ref props override field", () => {
    const ref = makeElement("ref", {
      type: "ref",
      ref: "master",
      props: { label: "Instance", style: { color: "blue" } },
    } as never);

    useStore.setState({
      elements: [ref],
      elementsMap: new Map([["ref", ref]]),
    } as never);
    useStore.getState()._rebuildIndexes();

    useStore.getState().resetInstanceOverrideField("ref", "label");

    expect(useStore.getState().elementsMap.get("ref")).toMatchObject({
      props: { style: { color: "blue" } },
    });
  });

  it("resets a canonical ref descendant override field with history", async () => {
    const ref = makeElement("ref", {
      type: "ref",
      ref: "master",
      descendants: {
        "slot/label": { text: "Custom label", tone: "accent" },
        icon: {
          props: { name: "check", size: "sm" },
        },
      },
    } as never);

    useStore.setState({
      elements: [ref],
      elementsMap: new Map([["ref", ref]]),
    } as never);
    useStore.getState()._rebuildIndexes();

    const result = useStore
      .getState()
      .resetInstanceOverrideField("ref", "text", "slot/label");

    expect(result?.previousState).toEqual(ref);
    expect(useStore.getState().elementsMap.get("ref")).toMatchObject({
      descendants: {
        "slot/label": { tone: "accent" },
        icon: {
          props: { name: "check", size: "sm" },
        },
      },
    });
    expect(addEntrySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "update",
        elementId: "ref",
        data: expect.objectContaining({
          prevElement: ref,
          element: expect.objectContaining({
            descendants: expect.objectContaining({
              "slot/label": { tone: "accent" },
            }),
          }),
        }),
      }),
    );

    await useStore.getState().undo();
    expect(useStore.getState().elementsMap.get("ref")).toMatchObject({
      descendants: {
        "slot/label": { text: "Custom label", tone: "accent" },
      },
    });
  });

  it("syncs reset canonical ref descendants into the active canonical document", () => {
    const page = {
      id: "page-1",
      title: "Home",
      project_id: "project-1",
      slug: "/",
      order_num: 0,
    } as Page;
    const body = makeElement("body", {
      type: "body",
      parent_id: null,
      order_num: 0,
    });
    const master = makeElement("master", {
      type: "Card",
      parent_id: body.id,
      reusable: true,
      props: { title: "Origin title" },
      order_num: 0,
    });
    const heading = makeElement("heading", {
      type: "Heading",
      parent_id: master.id,
      customId: "heading",
      props: { children: "Origin title" },
      order_num: 0,
    });
    const ref = makeElement("ref", {
      type: "ref",
      ref: master.id,
      parent_id: body.id,
      props: { title: "Instance title" },
      descendants: {
        heading: { children: "Instance title", tone: "accent" },
      },
      order_num: 1,
    } as never);
    const doc = {
      version: "composition-1.0",
      children: [
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            {
              id: "body",
              type: "body",
              props: {},
              metadata: { type: "legacy-element-props" },
              children: [
                {
                  id: "master",
                  type: "Card",
                  reusable: true,
                  props: { title: "Origin title" },
                  metadata: { type: "legacy-element-props" },
                  children: [
                    {
                      id: "heading",
                      type: "Heading",
                      props: { children: "Origin title" },
                      metadata: {
                        type: "legacy-element-props",
                        customId: "heading",
                      },
                    },
                  ],
                },
                {
                  id: "ref",
                  type: "ref",
                  ref: "master",
                  props: { title: "Instance title" },
                  descendants: {
                    heading: { children: "Instance title", tone: "accent" },
                  },
                  metadata: { type: "legacy-element-props" },
                },
              ],
            },
          ],
        },
      ],
    } satisfies CompositionDocument;

    useStore.setState({
      currentPageId: "page-1",
      pages: [page],
      elements: [body, master, heading, ref],
      elementsMap: new Map([
        [body.id, body],
        [master.id, master],
        [heading.id, heading],
        [ref.id, ref],
      ]),
      selectedElementId: ref.id,
      selectedElementProps: ref.props,
    } as never);
    useStore.getState()._rebuildIndexes();
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", doc);
    registerCanonicalMutationStoreActions({
      mergeElements: useStore.getState().mergeElements,
      setElements: useStore.getState().setElements,
      getCurrentLegacySnapshot: () => ({
        elements: useStore.getState().elements,
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    useStore
      .getState()
      .resetInstanceOverrideField(ref.id, "children", "heading");

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const refNode = findCanonicalNodeById(nextDoc?.children ?? [], ref.id) as
      | RefNode
      | undefined;

    expect(refNode?.descendants).toEqual({
      heading: { tone: "accent" },
    });
  });

  it("resets a canonical ref descendant props field", () => {
    const ref = makeElement("ref", {
      type: "ref",
      ref: "master",
      descendants: {
        icon: {
          props: { name: "check", size: "sm" },
        },
      },
    } as never);

    useStore.setState({
      elements: [ref],
      elementsMap: new Map([["ref", ref]]),
    } as never);
    useStore.getState()._rebuildIndexes();

    useStore.getState().resetInstanceOverrideField("ref", "name", "icon");

    expect(useStore.getState().elementsMap.get("ref")).toMatchObject({
      descendants: {
        icon: {
          props: { size: "sm" },
        },
      },
    });
  });

  it("materializes a canonical ref into a standalone subtree", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const master = makeElement("master", {
      reusable: true,
      props: { label: "Master", style: { color: "red", padding: "8px" } },
    });
    const child = makeElement("label", {
      type: "Text",
      parent_id: "master",
      customId: "label",
      props: { text: "OK" },
    });
    const ref = makeElement("ref", {
      type: "ref",
      ref: "master",
      props: { label: "Instance", style: { color: "blue" } },
      descendants: { label: { text: "Cancel" } },
    } as never);

    useStore.setState({
      elements: [master, child, ref],
      selectedElementId: "ref",
      elementsMap: new Map([
        ["master", master],
        ["label", child],
        ["ref", ref],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();

    const result = useStore.getState().detachInstance("ref");
    const detachedRoot = useStore.getState().elementsMap.get("ref") as
      | (Element & { ref?: string })
      | undefined;
    const materializedChildren = useStore
      .getState()
      .elements.filter((element) => element.parent_id === "ref");

    expect(result?.previousState).toMatchObject({ type: "ref" });
    expect(detachedRoot).toMatchObject({
      id: "ref",
      type: "Button",
      reusable: undefined,
      props: { label: "Instance", style: { color: "blue", padding: "8px" } },
    });
    expect(detachedRoot?.ref).toBeUndefined();
    expect(materializedChildren).toHaveLength(1);
    expect(materializedChildren[0]).toMatchObject({
      type: "Text",
      props: { text: "Cancel" },
    });
    expect(useStore.getState().selectedElementProps.label).toBe("Instance");
    expect(addEntrySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "batch",
        elementId: "ref",
        data: expect.objectContaining({
          prevElements: [ref],
          elements: expect.arrayContaining([
            expect.objectContaining({ id: "ref", type: "Button" }),
          ]),
        }),
      }),
    );

    await useStore.getState().undo();
    expect(useStore.getState().elementsMap.get("ref")).toMatchObject({
      type: "ref",
    });
    expect(
      useStore
        .getState()
        .elements.filter((element) => element.parent_id === "ref"),
    ).toHaveLength(0);

    await useStore.getState().redo();
    expect(useStore.getState().elementsMap.get("ref")).toMatchObject({
      type: "Button",
    });
    expect(
      useStore
        .getState()
        .elements.filter((element) => element.parent_id === "ref"),
    ).toHaveLength(1);
    logSpy.mockRestore();
  });

  it("materializes canonical descendants mode C children recursively", () => {
    const master = makeElement("layout", {
      type: "frame",
      reusable: true,
      props: { role: "layout" },
    });
    const slot = makeElement("main-slot", {
      type: "frame",
      parent_id: "layout",
      customId: "main-slot",
      props: { slot: true },
    });
    const ref = makeElement("page-ref", {
      type: "ref",
      ref: "layout",
      descendants: {
        "main-slot": {
          children: [
            {
              id: "card",
              type: "Card",
              props: { title: "Card title" },
              children: [
                {
                  id: "card-label",
                  type: "Text",
                  props: { text: "Nested label" },
                },
              ],
            },
          ],
        },
      },
    } as never);

    useStore.setState({
      elements: [master, slot, ref],
      elementsMap: new Map([
        ["layout", master],
        ["main-slot", slot],
        ["page-ref", ref],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();

    useStore.getState().detachInstance("page-ref");
    const detachedSlot = useStore
      .getState()
      .elements.find((element) => element.parent_id === "page-ref");
    const materializedCard = useStore
      .getState()
      .elements.find((element) => element.parent_id === detachedSlot?.id);
    const materializedLabel = useStore
      .getState()
      .elements.find((element) => element.parent_id === materializedCard?.id);

    expect(detachedSlot).toMatchObject({ type: "frame" });
    expect(materializedCard).toMatchObject({
      id: "card",
      type: "Card",
      props: { title: "Card title" },
    });
    expect(materializedLabel).toMatchObject({
      id: "card-label",
      type: "Text",
      props: { text: "Nested label" },
    });
  });

  it("materializes canonical descendants mode B as subtree replacement", () => {
    const master = makeElement("master", { reusable: true });
    const child = makeElement("label", {
      type: "Text",
      parent_id: "master",
      customId: "label",
      props: { text: "Original" },
    });
    const grandchild = makeElement("icon", {
      type: "Icon",
      parent_id: "label",
      props: { name: "check" },
    });
    const ref = makeElement("ref", {
      type: "ref",
      ref: "master",
      descendants: {
        label: {
          id: "replacement",
          type: "Heading",
          props: { text: "Replacement" },
        },
      },
    } as never);

    useStore.setState({
      elements: [master, child, grandchild, ref],
      elementsMap: new Map([
        ["master", master],
        ["label", child],
        ["icon", grandchild],
        ["ref", ref],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();

    useStore.getState().detachInstance("ref");
    const materializedChildren = useStore
      .getState()
      .elements.filter((element) => element.parent_id === "ref");

    expect(materializedChildren).toHaveLength(1);
    expect(materializedChildren[0]).toMatchObject({
      id: "replacement",
      type: "Heading",
      props: { text: "Replacement" },
    });
    expect(
      useStore
        .getState()
        .elements.filter((element) => element.parent_id === "replacement"),
    ).toHaveLength(0);
  });

  it("materializes nested canonical refs recursively", () => {
    const iconMaster = makeElement("icon-master", {
      type: "Icon",
      reusable: true,
      props: { name: "default-icon" },
    });
    const iconLabel = makeElement("icon-label", {
      type: "Text",
      parent_id: "icon-master",
      customId: "label",
      props: { text: "Default label" },
    });
    const buttonMaster = makeElement("button-master", {
      type: "Button",
      reusable: true,
      props: { label: "Button" },
    });
    const nestedIconRef = makeElement("nested-icon-ref", {
      type: "ref",
      ref: "icon-master",
      parent_id: "button-master",
      props: { name: "override-icon" },
      descendants: { label: { text: "Nested label" } },
    } as never);
    const buttonRef = makeElement("button-ref", {
      type: "ref",
      ref: "button-master",
    } as never);

    useStore.setState({
      elements: [iconMaster, iconLabel, buttonMaster, nestedIconRef, buttonRef],
      elementsMap: new Map([
        ["icon-master", iconMaster],
        ["icon-label", iconLabel],
        ["button-master", buttonMaster],
        ["nested-icon-ref", nestedIconRef],
        ["button-ref", buttonRef],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();

    useStore.getState().detachInstance("button-ref");
    const materializedIcon = useStore
      .getState()
      .elements.find((element) => element.parent_id === "button-ref");
    const materializedLabel = useStore
      .getState()
      .elements.find((element) => element.parent_id === materializedIcon?.id);

    expect(materializedIcon).toMatchObject({
      type: "Icon",
      props: { name: "override-icon" },
    });
    expect(
      (materializedIcon as Element & { ref?: string })?.ref,
    ).toBeUndefined();
    expect(materializedLabel).toMatchObject({
      type: "Text",
      props: { text: "Nested label" },
    });
  });

  it("creates a component origin from a standard element with undo", async () => {
    const button = makeElement("button", {
      customId: "primary-action",
      page_id: "page-1",
    });

    useStore.setState({
      currentPageId: "page-1",
      elements: [button],
      elementsMap: new Map([["button", button]]),
    } as never);
    useStore.getState()._rebuildIndexes();

    const result = await useStore.getState().toggleComponentOrigin("button");

    expect(result?.previousElements).toEqual([button]);
    expect(useStore.getState().elementsMap.get("button")).toMatchObject({
      componentName: "primary-action",
      reusable: true,
    });
    expect(addEntrySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "batch",
        elementId: "button",
      }),
    );

    await useStore.getState().undo();
    expect(
      useStore.getState().elementsMap.get("button")?.reusable,
    ).toBeUndefined();
  });

  it("syncs a created component origin into the active canonical document for refresh", async () => {
    const button = makeElement("button", {
      customId: "primary-action",
      page_id: "page-1",
      props: { children: "Click" },
    });
    const page = {
      id: "page-1",
      title: "Home",
      project_id: "project-1",
      slug: "/",
      order_num: 0,
    } as Page;
    const doc = {
      version: "composition-1.0",
      children: [
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            {
              id: "button",
              type: "Button",
              props: { children: "Click" },
              metadata: {
                type: "legacy-element-props",
                legacyProps: {
                  id: "button",
                  page_id: "page-1",
                  type: "Button",
                  order_num: 0,
                },
              },
            },
          ],
        },
      ],
    } satisfies CompositionDocument;

    useStore.setState({
      currentPageId: "page-1",
      elements: [button],
      elementsMap: new Map([["button", button]]),
      pages: [page],
    } as never);
    useStore.getState()._rebuildIndexes();
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", doc);
    registerCanonicalMutationStoreActions({
      mergeElements: useStore.getState().mergeElements,
      setElements: useStore.getState().setElements,
      getCurrentLegacySnapshot: () => ({
        elements: useStore.getState().elements,
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    await useStore.getState().toggleComponentOrigin("button");

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    expect(pageNode?.children).toEqual([
      expect.objectContaining({
        id: "button",
        reusable: true,
        metadata: expect.objectContaining({
          legacyProps: expect.objectContaining({
            page_id: "page-1",
          }),
        }),
      }),
    ]);
    expect(useStore.getState().elementsMap.get("button")).toMatchObject(
      withComponentOriginMirror({
        componentName: "primary-action",
        reusable: true,
      }),
    );
  });

  it("removes component origin silently when no instances exist", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const origin = makeElement("origin", {
      componentName: "CTA",
      reusable: true,
    });

    useStore.setState({
      elements: [origin],
      elementsMap: new Map([["origin", origin]]),
    } as never);
    useStore.getState()._rebuildIndexes();

    await useStore.getState().toggleComponentOrigin("origin");

    expect(useStore.getState().elementsMap.get("origin")).toMatchObject({
      componentName: "CTA",
      reusable: false,
      [COMPONENT_ROLE_MIRROR_FIELD]: undefined,
    });
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("removes component origin and materializes impacted instances with single undo", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const origin = makeElement("origin", {
      reusable: true,
      props: { label: "Origin", style: { padding: "8px" } },
    });
    const child = makeElement("label", {
      type: "Text",
      parent_id: "origin",
      customId: "label",
      props: { text: "Default" },
    });
    const instance = makeElement("instance", {
      type: "ref",
      ref: "origin",
      props: { label: "Instance" },
      descendants: { label: { text: "Custom" } },
    } as never);

    useStore.setState({
      currentPageId: "page-1",
      elements: [origin, child, instance],
      elementsMap: new Map([
        ["origin", origin],
        ["label", child],
        ["instance", instance],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();

    await useStore.getState().toggleComponentOrigin("origin");
    const detachedInstance = useStore.getState().elementsMap.get("instance") as
      | (Element & { ref?: string })
      | undefined;
    const materializedChild = useStore
      .getState()
      .elements.find((element) => element.parent_id === "instance");

    expect(confirmSpy).toHaveBeenCalled();
    expect(useStore.getState().elementsMap.get("origin")).toMatchObject({
      reusable: false,
    });
    expect(detachedInstance).toMatchObject({
      id: "instance",
      type: "Button",
      props: { label: "Instance", style: { padding: "8px" } },
    });
    expect(detachedInstance?.ref).toBeUndefined();
    expect(materializedChild).toMatchObject({
      type: "Text",
      props: { text: "Custom" },
    });

    await useStore.getState().undo();
    expect(useStore.getState().elementsMap.get("origin")).toMatchObject({
      reusable: true,
    });
    expect(useStore.getState().elementsMap.get("instance")).toMatchObject({
      type: "ref",
      ref: "origin",
    });
    expect(
      useStore
        .getState()
        .elements.filter((element) => element.parent_id === "instance"),
    ).toHaveLength(0);
  });

  it("auto-detaches canonical instances when deleting their origin", async () => {
    const origin = makeElement("origin", {
      reusable: true,
      props: { label: "Origin", style: { padding: "8px" } },
    });
    const child = makeElement("label", {
      type: "Text",
      parent_id: "origin",
      customId: "label",
      props: { text: "Default" },
    });
    const instance = makeElement("instance", {
      type: "ref",
      ref: "origin",
      props: { label: "Instance" },
      descendants: { label: { text: "Custom" } },
    } as never);

    useStore.setState({
      currentPageId: "page-1",
      elements: [origin, child, instance],
      elementsMap: new Map([
        ["origin", origin],
        ["label", child],
        ["instance", instance],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();

    await useStore.getState().removeElement("origin");

    const detachedInstance = useStore.getState().elementsMap.get("instance") as
      | (Element & { ref?: string })
      | undefined;
    const materializedChild = useStore
      .getState()
      .elements.find((element) => element.parent_id === "instance");

    expect(useStore.getState().elementsMap.has("origin")).toBe(false);
    expect(useStore.getState().elementsMap.has("label")).toBe(false);
    expect(detachedInstance).toMatchObject({
      id: "instance",
      type: "Button",
      props: { label: "Instance", style: { padding: "8px" } },
    });
    expect(detachedInstance?.ref).toBeUndefined();
    expect(materializedChild).toMatchObject({
      type: "Text",
      props: { text: "Custom" },
    });

    await useStore.getState().undo();
    expect(useStore.getState().elementsMap.get("origin")).toMatchObject({
      reusable: true,
    });
    expect(useStore.getState().elementsMap.get("instance")).toMatchObject({
      type: "ref",
      ref: "origin",
    });
  });

  it("removes component origin across 1000 canonical instances", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    confirmSpy.mockClear();
    const origin = makeElement("origin", {
      reusable: true,
      props: { label: "Origin" },
    });
    const instances = Array.from({ length: 1000 }, (_, index) =>
      makeElement(`instance-${index}`, {
        type: "ref",
        ref: "origin",
        props: { label: `Instance ${index}` },
      } as never),
    );

    useStore.setState({
      currentPageId: "page-1",
      elements: [origin, ...instances],
      elementsMap: new Map(
        [origin, ...instances].map((element) => [element.id, element]),
      ),
    } as never);
    useStore.getState()._rebuildIndexes();

    const result = await useStore.getState().toggleComponentOrigin("origin");

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(result?.previousElements).toHaveLength(1001);
    expect(result?.elements).toHaveLength(1001);
    expect(useStore.getState().elementsMap.get("origin")).toMatchObject({
      reusable: false,
    });
    expect(useStore.getState().elementsMap.get("instance-999")).toMatchObject({
      type: "Button",
      props: { label: "Instance 999" },
    });
    expect(
      (
        useStore.getState().elementsMap.get("instance-999") as Element & {
          ref?: string;
        }
      )?.ref,
    ).toBeUndefined();
  });

  it("falls back to the impact dialog path when T1 finds a new instance", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    confirmSpy.mockClear();
    const origin = makeElement("origin", {
      reusable: true,
      props: { label: "Origin" },
    });

    useStore.setState({
      elements: [origin],
      elementsMap: new Map([["origin", origin]]),
    } as never);
    useStore.getState()._rebuildIndexes();

    await useStore.getState().toggleComponentOrigin("origin", {
      beforeMutation: () => {
        const raceInstance = makeElement("race-instance", {
          type: "ref",
          ref: "origin",
        } as never);
        useStore.setState({
          elements: [...useStore.getState().elements, raceInstance],
          elementsMap: new Map(useStore.getState().elementsMap).set(
            "race-instance",
            raceInstance,
          ),
        } as never);
        useStore.getState()._rebuildIndexes();
      },
    });

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    const raceInstance = useStore
      .getState()
      .elementsMap.get("race-instance") as
      | (Element & { ref?: string })
      | undefined;
    expect(raceInstance).toMatchObject({ type: "Button" });
    expect(raceInstance?.ref).toBeUndefined();
  });

  it("waits for the impact dialog confirmation when TOCTOU changes instance count", async () => {
    const origin = makeElement("origin", {
      reusable: true,
      props: { label: "Origin" },
    });

    useStore.setState({
      elements: [origin],
      elementsMap: new Map([["origin", origin]]),
    } as never);
    useStore.getState()._rebuildIndexes();

    const requests: EditingSemanticsImpactConfirmationRequest[] = [];
    const unsubscribe = subscribeEditingSemanticsImpactConfirmation(
      (request) => {
        if (request) {
          requests.push(request);
        }
      },
    );

    try {
      const togglePromise = useStore
        .getState()
        .toggleComponentOrigin("origin", {
          beforeMutation: () => {
            const raceInstance = makeElement("race-instance", {
              type: "ref",
              ref: "origin",
            } as never);
            useStore.setState({
              elements: [...useStore.getState().elements, raceInstance],
              elementsMap: new Map(useStore.getState().elementsMap).set(
                "race-instance",
                raceInstance,
              ),
            } as never);
            useStore.getState()._rebuildIndexes();
          },
        });

      await vi.waitFor(() => {
        expect(requests).toHaveLength(1);
      });

      expect(requests[0]).toMatchObject({
        impactedInstanceIds: ["race-instance"],
        instanceCount: 1,
        originId: "origin",
        originLabel: "Button component",
      });
      expect(useStore.getState().elementsMap.get("origin")).toMatchObject({
        reusable: true,
      });

      resolveEditingSemanticsImpactConfirmation(true);
      await togglePromise;

      const raceInstance = useStore
        .getState()
        .elementsMap.get("race-instance") as
        | (Element & { ref?: string })
        | undefined;
      expect(useStore.getState().elementsMap.get("origin")).toMatchObject({
        reusable: false,
      });
      expect(raceInstance).toMatchObject({ type: "Button" });
      expect(raceInstance?.ref).toBeUndefined();
    } finally {
      unsubscribe();
      resolveEditingSemanticsImpactConfirmation(false);
    }
  });
});

import { beforeEach, describe, expect, it } from "vitest";

import type { CompositionDocument } from "@composition/shared";
import {
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
  setElementsCanonicalPrimary,
} from "../../../adapters/canonical/canonicalMutations";
import { getEditingSemanticsRole } from "../../../adapters/canonical/editingSemantics";
import type { Element, Page } from "../../../types/builder/unified.types";
import { useCanonicalDocumentStore } from "../canonical/canonicalDocumentStore";
import { visitCanonicalDocumentElements } from "../canonical/canonicalElementsView";
import { useStore } from "../elements";

function makePage(id: string): Page {
  return {
    id,
    title: id,
    project_id: "project-1",
    slug: `/${id}`,
    order_num: 0,
  } as Page;
}

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

function makePageDocument(
  pageOne: Page,
  pageTwo: Page,
  bodyOne: Element,
  instance: Element,
  bodyTwo: Element,
  origin: Element,
  originLabel: Element,
): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: pageOne.id,
        type: "frame",
        metadata: { type: "legacy-page", pageId: pageOne.id },
        children: [
          {
            id: bodyOne.id,
            type: bodyOne.type,
            props: bodyOne.props as Record<string, unknown>,
            children: [
              {
                id: instance.id,
                type: "ref",
                ref: origin.id,
                props: instance.props as Record<string, unknown>,
              },
            ],
          },
        ],
      },
      {
        id: pageTwo.id,
        type: "frame",
        metadata: { type: "legacy-page", pageId: pageTwo.id },
        children: [
          {
            id: bodyTwo.id,
            type: bodyTwo.type,
            props: bodyTwo.props as Record<string, unknown>,
            children: [
              {
                id: origin.id,
                type: origin.type,
                name: origin.componentName,
                reusable: true,
                props: origin.props as Record<string, unknown>,
                children: [
                  {
                    id: originLabel.id,
                    type: originLabel.type,
                    props: originLabel.props as Record<string, unknown>,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

function findCanonicalElement(
  doc: CompositionDocument | undefined,
  elementId: string,
): Element | undefined {
  if (!doc) return undefined;
  let match: Element | undefined;
  visitCanonicalDocumentElements(doc, (element) => {
    if (element.id === elementId) {
      match = element;
    }
  });
  return match;
}

describe("removePageLocal component semantics", () => {
  beforeEach(() => {
    useStore.getState().setElements([]);
    useStore.setState({
      pages: [],
      currentPageId: null,
      selectedElementId: null,
      selectedElementIds: [],
      selectedElementIdsSet: new Set<string>(),
      selectedElementProps: {},
      editingContextId: null,
      selectedTab: null,
      multiSelectMode: false,
      pagePositions: {},
      pageElementsSnapshot: {},
      layoutVersion: 0,
    });
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
    resetCanonicalMutationStoreActions();
  });

  it("detaches instances on other pages when deleting the page that owns their origin", () => {
    const pageOne = makePage("page-1");
    const pageTwo = makePage("page-2");
    const bodyOne = makeElement("body-1", "body", {
      page_id: pageOne.id,
      order_num: 0,
    });
    const bodyTwo = makeElement("body-2", "body", {
      page_id: pageTwo.id,
      order_num: 0,
    });
    const origin = makeElement("origin-button", "Button", {
      page_id: pageTwo.id,
      parent_id: bodyTwo.id,
      order_num: 1,
      props: { label: "Origin", size: "md" },
      reusable: true,
      componentName: "PrimaryAction",
    });
    const originLabel = makeElement("origin-label", "Label", {
      page_id: pageTwo.id,
      parent_id: origin.id,
      order_num: 0,
      props: { children: "Origin label" },
    });
    const instance = makeElement("instance-button", "ref", {
      ref: origin.id,
      page_id: pageOne.id,
      parent_id: bodyOne.id,
      order_num: 1,
      props: { label: "Instance" },
      componentName: "PrimaryAction",
    });

    useStore.setState({
      pages: [pageOne, pageTwo],
      currentPageId: pageOne.id,
    });
    useStore
      .getState()
      .setElements([bodyOne, instance, bodyTwo, origin, originLabel]);

    useStore.getState().removePageLocal(pageTwo.id);

    const state = useStore.getState();
    const detachedInstance = state.elementsMap.get(instance.id);
    expect(state.pages.map((page) => page.id)).toEqual([pageOne.id]);
    expect(state.elementsMap.has(origin.id)).toBe(false);
    expect(state.elementsMap.has(originLabel.id)).toBe(false);
    expect(detachedInstance).toMatchObject({
      id: instance.id,
      type: "Button",
      page_id: pageOne.id,
      parent_id: bodyOne.id,
      props: { label: "Instance", size: "md" },
    });
    expect(detachedInstance).not.toHaveProperty("ref");
    expect(getEditingSemanticsRole(detachedInstance)).toBeNull();

    const materializedChildren = state.elements.filter(
      (element) => element.parent_id === instance.id,
    );
    expect(materializedChildren).toHaveLength(1);
    expect(materializedChildren[0]).toMatchObject({
      type: "Label",
      page_id: pageOne.id,
      props: { children: "Origin label" },
    });
    expect(
      state.pageElementsSnapshot[pageOne.id]?.map((element) => element.id),
    ).toContain(instance.id);
  });

  it("detaches instances when the deleted origin page exists only in the canonical document", () => {
    const pageOne = makePage("page-1");
    const pageTwo = makePage("page-2");
    const bodyOne = makeElement("body-1", "body", {
      page_id: pageOne.id,
      order_num: 0,
    });
    const bodyTwo = makeElement("body-2", "body", {
      page_id: pageTwo.id,
      order_num: 0,
    });
    const origin = makeElement("origin-button", "Button", {
      page_id: pageTwo.id,
      parent_id: bodyTwo.id,
      order_num: 1,
      props: { label: "Origin", size: "md" },
      reusable: true,
      componentName: "PrimaryAction",
    });
    const originLabel = makeElement("origin-label", "Label", {
      page_id: pageTwo.id,
      parent_id: origin.id,
      order_num: 0,
      props: { children: "Origin label" },
    });
    const instance = makeElement("instance-button", "ref", {
      ref: origin.id,
      page_id: pageOne.id,
      parent_id: bodyOne.id,
      order_num: 1,
      props: { label: "Instance" },
      componentName: "PrimaryAction",
    });

    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore
      .getState()
      .setDocument(
        "project-1",
        makePageDocument(
          pageOne,
          pageTwo,
          bodyOne,
          instance,
          bodyTwo,
          origin,
          originLabel,
        ),
      );
    useStore.setState({
      pages: [pageOne, pageTwo],
      currentPageId: pageOne.id,
    });
    useStore.getState().setElements([bodyOne, instance]);
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: Array.from(useStore.getState().elementsMap.values()),
        pages: useStore.getState().pages,
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    useStore.getState().removePageLocal(pageTwo.id);
    setElementsCanonicalPrimary(
      Array.from(useStore.getState().elementsMap.values()),
    );

    const state = useStore.getState();
    const detachedInstance = state.elementsMap.get(instance.id);
    const canonicalInstance = findCanonicalElement(
      useCanonicalDocumentStore.getState().getDocument("project-1"),
      instance.id,
    );
    expect(detachedInstance).toMatchObject({
      id: instance.id,
      type: "Button",
      page_id: pageOne.id,
      parent_id: bodyOne.id,
      props: { label: "Instance", size: "md" },
    });
    expect(detachedInstance).not.toHaveProperty("ref");
    expect(getEditingSemanticsRole(detachedInstance)).toBeNull();
    expect(canonicalInstance).toMatchObject({
      id: instance.id,
      type: "Button",
      page_id: pageOne.id,
      parent_id: bodyOne.id,
    });
    expect(canonicalInstance).not.toHaveProperty("ref");
    expect(
      state.elements.some((element) => element.parent_id === instance.id),
    ).toBe(true);
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import type { Element } from "@/types/builder/unified.types";
import {
  mergeElementsCanonicalPrimary,
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "@/adapters/canonical/canonicalMutations";
import { useCanonicalDocumentStore } from "@/builder/stores/canonical/canonicalDocumentStore";
import { createTabsCompositeElements } from "../definitions/LayoutComponents";
import type { ComponentCreationContext } from "../types";

function makeContext(): ComponentCreationContext {
  return {
    parentElement: null,
    pageId: "page-1",
    elements: [],
    layoutId: null,
    doc: {
      version: "composition-1.0",
      children: [],
    } satisfies CompositionDocument,
  };
}

function makeIdFactory(ids: string[]): () => string {
  return () => {
    const id = ids.shift();
    if (!id) throw new Error("test id factory exhausted");
    return id;
  };
}

function byId(elements: Element[], id: string): Element {
  const element = elements.find((candidate) => candidate.id === id);
  if (!element) throw new Error(`missing element ${id}`);
  return element;
}

function findNode(nodes: readonly CanonicalNode[], id: string): CanonicalNode {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      try {
        return findNode(node.children, id);
      } catch {
        // Continue scanning siblings.
      }
    }
  }
  throw new Error(`missing canonical node ${id}`);
}

describe("ADR-144 Phase 2 Tabs composite factory", () => {
  beforeEach(() => {
    resetCanonicalMutationStoreActions();
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
  });

  afterEach(() => {
    resetCanonicalMutationStoreActions();
  });

  it("creates Tabs as reusable origins plus a ref instance instead of props.items authoring", () => {
    const ids = [
      "tab-origin",
      "tab-label",
      "tab-indicator",
      "tablist-origin",
      "tab-ref-overview",
      "tab-ref-settings",
      "tabs-origin",
      "tabs-tablist-ref",
      "panel-overview",
      "panel-overview-body",
      "panel-settings",
      "panel-settings-body",
      "tabs-instance",
    ];

    const { masters, instance } = createTabsCompositeElements(makeContext(), {
      parentId: "page-body",
      idFactory: makeIdFactory(ids),
      now: () => "2026-05-22T00:00:00.000Z",
    });
    const allElements = [instance, ...masters];

    expect(instance).toMatchObject({
      id: "tabs-instance",
      type: "Tabs",
      parent_id: "page-body",
      page_id: "page-1",
      ref: "tabs-origin",
      componentRole: "instance",
      masterId: "tabs-origin",
    });
    expect(instance.props).not.toHaveProperty("items");
    expect(instance.props).toMatchObject({
      "aria-label": "Tabs",
      defaultSelectedKey: "tab-ref-overview",
      orientation: "horizontal",
    });

    expect(
      allElements
        .filter((element) => element.reusable === true)
        .map((element) => [element.id, element.type, element.name]),
    ).toEqual([
      ["tab-origin", "Tab", "Tab"],
      ["tablist-origin", "TabList", "TabList"],
      ["tabs-origin", "Tabs", "Tabs"],
    ]);

    expect(byId(allElements, "tab-origin")).toMatchObject({
      componentRole: "master",
      reusable: true,
    });
    expect(byId(allElements, "tab-label")).toMatchObject({
      parent_id: "tab-origin",
      type: "Text",
      props: { text: "Tab" },
    });
    expect(byId(allElements, "tab-indicator")).toMatchObject({
      parent_id: "tab-origin",
      type: "frame",
      props: { enabled: false },
    });

    expect(byId(allElements, "tab-ref-overview")).toMatchObject({
      parent_id: "tablist-origin",
      type: "Tab",
      ref: "tab-origin",
      componentRole: "instance",
      masterId: "tab-origin",
      descendants: {
        "tab-label": { text: "Overview" },
        "tab-indicator": { enabled: true },
      },
    });
    expect(byId(allElements, "tab-ref-settings")).toMatchObject({
      parent_id: "tablist-origin",
      type: "Tab",
      ref: "tab-origin",
      descendants: {
        "tab-label": { text: "Settings" },
      },
    });

    expect(byId(allElements, "tabs-origin")).toMatchObject({
      type: "Tabs",
      reusable: true,
      componentRole: "master",
      slot: ["tablist-origin"],
    });
    expect(byId(allElements, "tabs-tablist-ref")).toMatchObject({
      parent_id: "tabs-origin",
      type: "TabList",
      ref: "tablist-origin",
    });
    expect(byId(allElements, "panel-overview")).toMatchObject({
      parent_id: "tabs-origin",
      type: "TabPanel",
      props: { id: "tab-ref-overview" },
    });
    expect(byId(allElements, "panel-overview-body")).toMatchObject({
      parent_id: "panel-overview",
      type: "Text",
      props: { children: "Overview panel content" },
    });
    expect(byId(allElements, "panel-settings")).toMatchObject({
      parent_id: "tabs-origin",
      type: "TabPanel",
      props: { id: "tab-ref-settings" },
    });
    expect(byId(allElements, "panel-settings-body")).toMatchObject({
      parent_id: "panel-settings",
      type: "Text",
      props: { children: "Settings panel content" },
    });
  });

  it("merges the Tabs composite payload into canonical reusable roots and a page ref", () => {
    const ids = [
      "tab-origin",
      "tab-label",
      "tab-indicator",
      "tablist-origin",
      "tab-ref-overview",
      "tab-ref-settings",
      "tabs-origin",
      "tabs-tablist-ref",
      "panel-overview",
      "panel-overview-body",
      "panel-settings",
      "panel-settings-body",
      "tabs-instance",
    ];
    const { masters, instance } = createTabsCompositeElements(makeContext(), {
      parentId: "page-body",
      idFactory: makeIdFactory(ids),
      now: () => "2026-05-22T00:00:00.000Z",
    });

    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", {
      version: "composition-1.0",
      children: [
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [{ id: "page-body", type: "Body", props: {} }],
        },
      ],
    } satisfies CompositionDocument);
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [
          {
            id: "page-1",
            title: "Page 1",
            project_id: "project-1",
            slug: "/page-1",
          },
        ],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    mergeElementsCanonicalPrimary([instance, ...masters]);

    const doc = useCanonicalDocumentStore.getState().getDocument("project-1");
    // ADR-144 Wave D — masters 는 doc.reusableComponents 로 라우팅,
    // instance 는 doc.children (page tree) 에 유지.
    const reusableRoots = doc?.reusableComponents ?? [];
    const pageRoots = doc?.children ?? [];

    expect(findNode(reusableRoots, "tabs-origin")).toMatchObject({
      id: "tabs-origin",
      type: "Tabs",
      reusable: true,
      children: [
        expect.objectContaining({
          id: "tabs-tablist-ref",
          type: "ref",
          ref: "tablist-origin",
        }),
        expect.objectContaining({
          id: "panel-overview",
          type: "TabPanel",
        }),
        expect.objectContaining({
          id: "panel-settings",
          type: "TabPanel",
        }),
      ],
    });
    expect(findNode(reusableRoots, "tab-ref-overview")).toMatchObject({
      type: "ref",
      ref: "tab-origin",
      descendants: {
        "tab-label": { text: "Overview" },
        "tab-indicator": { enabled: true },
      },
    });
    expect(findNode(pageRoots, "tabs-instance")).toMatchObject({
      id: "tabs-instance",
      type: "ref",
      ref: "tabs-origin",
      props: {
        defaultSelectedKey: "tab-ref-overview",
      },
    });
    expect(findNode(pageRoots, "tabs-instance").props).not.toHaveProperty(
      "items",
    );
  });
});

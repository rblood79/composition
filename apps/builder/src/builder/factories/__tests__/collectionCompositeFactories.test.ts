import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { CompositionDocument } from "@composition/shared";
import type { Element } from "@/types/builder/unified.types";
import {
  mergeElementsCanonicalPrimary,
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "@/adapters/canonical/canonicalMutations";
import { useCanonicalDocumentStore } from "@/builder/stores/canonical/canonicalDocumentStore";
import {
  createComboBoxCompositeElements,
  createListBoxCompositeElements,
  createMenuCompositeElements,
  createSelectCompositeElements,
} from "../definitions/SelectionComponents";
import type { ComponentCreationContext } from "../types";

/**
 * ADR-144 Phase 7 G6 — collection composite factory contract.
 *
 * Tabs slice (`tabsCompositeFactory.test.ts`) 와 대등한 reusable origin + ref
 * children + slot + descendants 패턴이 Select / ComboBox / ListBox / Menu 의 새
 * creation path 에 적용됐는지를 family 별로 검증한다.
 *
 * legacy `createSelectDefinition` 등 `props.items[]` payload 는 adapter
 * fallback 이며 본 file 의 검증 대상이 아니다.
 */

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

const COMPOSITE_IDS = [
  "item-origin",
  "item-label",
  "container-origin",
  "ref-one",
  "ref-two",
  "ref-three",
  "instance",
];

describe("ADR-144 Phase 7 collection composite factories", () => {
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

  it.each([
    {
      label: "Select",
      factory: createSelectCompositeElements,
      itemType: "SelectItem",
      containerType: "Select",
      ariaLabel: "Select",
      refLabels: ["Aardvark", "Cat", "Kangaroo"],
    },
    {
      label: "ComboBox",
      factory: createComboBoxCompositeElements,
      itemType: "ComboBoxItem",
      containerType: "ComboBox",
      ariaLabel: "Combo Box",
      refLabels: ["Aardvark", "Cat", "Kangaroo"],
    },
    {
      label: "ListBox",
      factory: createListBoxCompositeElements,
      itemType: "ListBoxItem",
      containerType: "ListBox",
      ariaLabel: "ListBox",
      refLabels: ["Aardvark", "Cat", "Kangaroo"],
    },
    {
      label: "Menu",
      factory: createMenuCompositeElements,
      itemType: "MenuItem",
      containerType: "Menu",
      ariaLabel: "Menu",
      refLabels: ["Profile", "Billing", "Settings"],
    },
  ])(
    "%s creation uses reusable origin + ref/descendants/slot instead of props.items[]",
    ({ factory, itemType, containerType, ariaLabel, refLabels }) => {
      const { parent, children } = factory(makeContext(), {
        parentId: "page-body",
        idFactory: makeIdFactory([...COMPOSITE_IDS]),
        now: () => "2026-05-22T00:00:00.000Z",
      });
      const allElements = [parent, ...children];

      // 1) parent = page-owned ref instance to the container origin.
      expect(parent).toMatchObject({
        id: "instance",
        type: containerType,
        parent_id: "page-body",
        page_id: "page-1",
        ref: "container-origin",
        componentRole: "instance",
        masterId: "container-origin",
      });
      expect(parent.props).not.toHaveProperty("items");
      expect(parent.props).toMatchObject({ "aria-label": ariaLabel });

      // 2) reusable origins = exactly { item-origin, container-origin }
      expect(
        allElements
          .filter((element) => element.reusable === true)
          .map((element) => [element.id, element.type]),
      ).toEqual([
        ["item-origin", itemType],
        ["container-origin", containerType],
      ]);

      // 3) item origin has a single Text label master.
      expect(byId(allElements, "item-origin")).toMatchObject({
        componentRole: "master",
        reusable: true,
      });
      expect(byId(allElements, "item-label")).toMatchObject({
        parent_id: "item-origin",
        type: "Text",
        name: "label",
      });

      // 4) container origin declares slot allow-list of the item origin.
      expect(byId(allElements, "container-origin")).toMatchObject({
        type: containerType,
        reusable: true,
        componentRole: "master",
        slot: ["item-origin"],
      });

      // 5) ref instances live under container origin with descendants overrides.
      for (let i = 0; i < 3; i += 1) {
        const refId = ["ref-one", "ref-two", "ref-three"][i] as string;
        expect(byId(allElements, refId)).toMatchObject({
          parent_id: "container-origin",
          type: itemType,
          ref: "item-origin",
          componentRole: "instance",
          masterId: "item-origin",
          descendants: {
            "item-label": { text: refLabels[i] },
          },
        });
      }
    },
  );

  it("merges the ListBox composite payload into canonical reusable roots and a page ref", () => {
    const { parent, children } = createListBoxCompositeElements(makeContext(), {
      parentId: "page-body",
      idFactory: makeIdFactory([...COMPOSITE_IDS]),
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

    mergeElementsCanonicalPrimary([parent, ...children]);

    const doc = useCanonicalDocumentStore.getState().getDocument("project-1");
    const reusableRoots =
      doc?.children?.filter((child) => child.reusable === true) ?? [];
    const reusableIds = reusableRoots.map((child) => child.id);
    expect(reusableIds).toEqual(
      expect.arrayContaining(["item-origin", "container-origin"]),
    );

    const containerOrigin = reusableRoots.find(
      (child) => child.id === "container-origin",
    );
    expect(containerOrigin?.children?.map((child) => child.id)).toEqual([
      "ref-one",
      "ref-two",
      "ref-three",
    ]);
    expect(
      containerOrigin?.children?.every((child) => child.type === "ref"),
    ).toBe(true);

    const findById = (
      nodes: readonly { id: string; children?: readonly unknown[] }[],
      id: string,
    ): { id: string; [key: string]: unknown } | undefined => {
      for (const node of nodes) {
        if (node.id === id)
          return node as { id: string; [key: string]: unknown };
        if (node.children) {
          const inner = findById(
            node.children as { id: string; children?: readonly unknown[] }[],
            id,
          );
          if (inner) return inner;
        }
      }
      return undefined;
    };

    const instanceNode = findById(doc?.children ?? [], "instance");
    expect(instanceNode).toMatchObject({
      type: "ref",
      ref: "container-origin",
    });
    expect(instanceNode?.props).not.toHaveProperty("items");
  });
});

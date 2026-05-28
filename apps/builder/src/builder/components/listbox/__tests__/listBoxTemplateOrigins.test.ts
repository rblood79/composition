import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import {
  detectListBoxAuthoringMode,
  ensureListBoxTemplateOrigins,
  LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
  LISTBOX_ITEM_SELECTED_ORIGIN_ID,
  LISTBOX_ORIGIN_ID,
} from "../listBoxTemplateOrigins";

function makeDocument(): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-home",
        type: "frame",
        name: "Home",
        metadata: { type: "legacy-page", pageId: "page-home", slug: "/" },
        children: [{ id: "body-home", type: "body" as CanonicalNode["type"] }],
      },
    ],
  };
}

function findById(
  nodes: readonly CanonicalNode[],
  id: string,
): CanonicalNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findById(node.children ?? [], id);
    if (child) return child;
  }
  return undefined;
}

describe("ADR-146 ListBox template origins", () => {
  it("bootstraps ListBoxItem variants and ListBox origin under the Components page", () => {
    const doc = ensureListBoxTemplateOrigins(makeDocument());

    const componentsPage = findById(doc.children, "page-components");
    expect(componentsPage).toMatchObject({
      name: "Components",
      metadata: expect.objectContaining({
        pageRole: "components",
        previewExcluded: true,
        publishExcluded: true,
      }),
    });

    const defaultOrigin = findById(
      doc.children,
      LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
    );
    const selectedOrigin = findById(
      doc.children,
      LISTBOX_ITEM_SELECTED_ORIGIN_ID,
    );
    const listBoxOrigin = findById(doc.children, LISTBOX_ORIGIN_ID);

    expect(defaultOrigin).toMatchObject({
      id: LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
      type: "ListBoxItem",
      name: "ListBoxItem/Default",
      reusable: true,
      props: expect.objectContaining({
        children: "{label}",
        textValue: "{label}",
      }),
      metadata: expect.objectContaining({
        systemOwned: true,
        componentFamily: "ListBox",
        variant: "default",
      }),
    });
    expect(selectedOrigin).toMatchObject({
      id: LISTBOX_ITEM_SELECTED_ORIGIN_ID,
      type: "ListBoxItem",
      name: "ListBoxItem/Selected",
      reusable: true,
      metadata: expect.objectContaining({
        systemOwned: true,
        componentFamily: "ListBox",
        variant: "selected",
      }),
    });
    expect(listBoxOrigin).toMatchObject({
      id: LISTBOX_ORIGIN_ID,
      type: "ListBox",
      name: "ListBox",
      reusable: true,
      slot: [LISTBOX_ITEM_DEFAULT_ORIGIN_ID, LISTBOX_ITEM_SELECTED_ORIGIN_ID],
      metadata: expect.objectContaining({
        systemOwned: true,
        componentFamily: "ListBox",
      }),
    });
  });

  it("is idempotent and does not duplicate system origins", () => {
    const doc = ensureListBoxTemplateOrigins(
      ensureListBoxTemplateOrigins(makeDocument()),
    );
    const ids = [
      LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
      LISTBOX_ITEM_SELECTED_ORIGIN_ID,
      LISTBOX_ORIGIN_ID,
    ];

    for (const id of ids) {
      const matches: CanonicalNode[] = [];
      const visit = (nodes: readonly CanonicalNode[]) => {
        for (const node of nodes) {
          if (node.id === id) matches.push(node);
          visit(node.children ?? []);
        }
      };
      visit(doc.children);
      expect(matches).toHaveLength(1);
    }
  });

  it("classifies data-bound and static ListBox authoring modes explicitly", () => {
    expect(
      detectListBoxAuthoringMode({
        dataBinding: { source: "collections.runtimeData" },
        props: { items: [{ id: "seed", label: "Seed" }] },
        children: [],
      }),
    ).toEqual({ mode: "data-bound", rowDataSource: "dataBinding" });

    expect(
      detectListBoxAuthoringMode({
        props: { items: [{ id: "item-1", label: "Item 1" }] },
        children: [],
      }),
    ).toEqual({ mode: "data-bound", rowDataSource: "items" });

    expect(
      detectListBoxAuthoringMode({
        props: {},
        children: [
          { id: "row-1", type: "ref", ref: LISTBOX_ITEM_DEFAULT_ORIGIN_ID },
        ],
      }),
    ).toEqual({ mode: "static", rowDataSource: "static-children" });
  });
});

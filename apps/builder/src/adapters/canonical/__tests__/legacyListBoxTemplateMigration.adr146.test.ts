import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import type { Element, Page } from "@/types/builder/unified.types";

import { legacyToCanonical } from "..";
import { convertComponentRole } from "../componentRoleAdapter";
import { convertPageLayout } from "../slotAndLayoutAdapter";
import {
  LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
  LISTBOX_TEMPLATE_ANCHOR_ROLE,
} from "../../../builder/components/listbox/listBoxTemplateOrigins";
import { migrateLegacyListBoxTemplatesToOrigins } from "../legacyListBoxTemplateMigration";

const deps = { convertComponentRole, convertPageLayout };

function el(partial: Partial<Element> & Pick<Element, "id" | "type">): Element {
  return {
    props: {},
    parent_id: null,
    order_num: 0,
    ...partial,
  } as Element;
}

function page(partial: Partial<Page> & Pick<Page, "id" | "title">): Page {
  return {
    project_id: "proj-1",
    slug: "/",
    ...partial,
  } as Page;
}

function findNode(
  nodes: readonly CanonicalNode[],
  predicate: (node: CanonicalNode) => boolean,
): CanonicalNode | undefined {
  for (const node of nodes) {
    if (predicate(node)) return node;
    const found = findNode(node.children ?? [], predicate);
    if (found) return found;
  }
  return undefined;
}

function countNodes(
  nodes: readonly CanonicalNode[],
  predicate: (node: CanonicalNode) => boolean,
): number {
  let count = 0;
  for (const node of nodes) {
    if (predicate(node)) count += 1;
    count += countNodes(node.children ?? [], predicate);
  }
  return count;
}

describe("ADR-146 legacy ListBox template migration", () => {
  it("legacyToCanonical bootstraps Components page before converting missing template to ref anchor", () => {
    const doc = legacyToCanonical(
      {
        elements: [
          el({
            id: "legacy-lb",
            type: "ListBox",
            page_id: "P1",
            props: {
              items: [{ id: "aardvark", label: "Aardvark" }],
            },
          }),
        ],
        pages: [page({ id: "P1", title: "Home", slug: "/" })],
        layouts: [],
      },
      deps,
    );

    const origin = findNode(
      doc.children,
      (node) => node.id === LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
    );
    const listBox = findNode(
      doc.children,
      (node) =>
        node.type === "ListBox" &&
        Array.isArray(node.props?.items) &&
        node.props.items.length === 1,
    );
    const anchor = listBox?.children?.[0];

    expect(origin).toMatchObject({
      type: "ListBoxItem",
      reusable: true,
    });
    expect(anchor).toMatchObject({
      type: "ref",
      ref: LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
      metadata: {
        templateRole: LISTBOX_TEMPLATE_ANCHOR_ROLE,
        locked: true,
        deleteDisabled: true,
      },
    });
    expect(
      countNodes(
        doc.children,
        (node) => node.id === LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
      ),
    ).toBe(1);
  });

  it("promotes the first local template to the shared origin and preserves later local differences on anchors", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            {
              id: "listbox-a",
              type: "ListBox",
              props: { items: [{ id: "a", label: "A" }] },
              children: [
                {
                  id: "template-a",
                  type: "ListBoxItem",
                  props: {
                    children: "First",
                    style: { color: "red", display: "none" },
                  },
                  children: [
                    {
                      id: "template-a-label",
                      type: "Text",
                      props: { children: "First child" },
                    },
                  ],
                },
              ],
            },
            {
              id: "listbox-b",
              type: "ListBox",
              props: { items: [{ id: "b", label: "B" }] },
              children: [
                {
                  id: "template-b",
                  type: "ListBoxItem",
                  props: {
                    children: "Second",
                    style: { color: "blue", display: "none" },
                  },
                  children: [
                    {
                      id: "template-b-label",
                      type: "Text",
                      props: { children: "Second child" },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const migrated = migrateLegacyListBoxTemplatesToOrigins(doc);
    const origin = findNode(
      migrated.children,
      (node) => node.id === LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
    );
    const listBoxA = findNode(
      migrated.children,
      (node) => node.id === "listbox-a",
    );
    const listBoxB = findNode(
      migrated.children,
      (node) => node.id === "listbox-b",
    );
    const anchorA = listBoxA?.children?.[0] as CanonicalNode | undefined;
    const anchorB = listBoxB?.children?.[0] as CanonicalNode | undefined;

    expect(origin?.props).toEqual({
      children: "First",
      style: { color: "red" },
    });
    expect(anchorA).toMatchObject({
      type: "ref",
      ref: LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
      props: {},
    });
    expect(anchorB).toMatchObject({
      type: "ref",
      ref: LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
      props: {
        children: "Second",
        style: { color: "blue" },
      },
      descendants: expect.any(Object),
    });
    expect(
      countNodes(
        migrated.children,
        (node) => node.id === LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
      ),
    ).toBe(1);

    const remigrated = migrateLegacyListBoxTemplatesToOrigins(migrated);
    expect(
      countNodes(
        remigrated.children,
        (node) => node.id === LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
      ),
    ).toBe(1);
    expect(
      countNodes(
        remigrated.children,
        (node) =>
          node.type === "ref" &&
          "ref" in node &&
          node.ref === LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
      ),
    ).toBe(2);
  });
});

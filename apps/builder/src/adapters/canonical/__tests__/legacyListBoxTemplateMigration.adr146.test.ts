import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import type { Element, Page } from "@/types/builder/unified.types";

import { legacyToCanonical } from "..";
import { convertComponentRole } from "../componentRoleAdapter";
import { convertPageLayout } from "../slotAndLayoutAdapter";
import {
  isListBoxTemplateAnchor,
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

describe("Option B — ListBox anchor-less migration", () => {
  it("legacyToCanonical bootstraps the Components origins and leaves the ListBox anchor-less", () => {
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

    // origin 은 Components 페이지에 bootstrap 된다 (행 template SSOT).
    expect(origin).toMatchObject({
      type: "ListBoxItem",
      reusable: true,
    });
    // Option B: instance 는 in-tree template anchor 를 갖지 않는다 (bare).
    expect(countNodes(doc.children, isListBoxTemplateAnchor)).toBe(0);
    expect((listBox?.children ?? []).length).toBe(0);
    expect(
      countNodes(
        doc.children,
        (node) => node.id === LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
      ),
    ).toBe(1);
  });

  it("strips in-instance template anchors from ListBox instances while preserving origins and static children", () => {
    const doc = {
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
                // ADR-146 template anchor — strip 대상.
                {
                  id: "anchor-a",
                  type: "ref",
                  ref: LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
                  props: {},
                  metadata: {
                    type: "legacy-element-props",
                    templateRole: LISTBOX_TEMPLATE_ANCHOR_ROLE,
                  },
                },
              ],
            },
            {
              id: "listbox-b",
              type: "ListBox",
              props: { items: [{ id: "b", label: "B" }] },
              children: [
                // anchor — strip 대상.
                {
                  id: "anchor-b",
                  type: "ref",
                  ref: LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
                  props: {},
                  metadata: { templateRole: LISTBOX_TEMPLATE_ANCHOR_ROLE },
                },
                // templateRole 없는 정적 자식 — 보존 대상 (오인 strip 금지).
                {
                  id: "keep-me",
                  type: "ListBoxItem",
                  props: { children: "Static" },
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const migrated = migrateLegacyListBoxTemplatesToOrigins(doc);
    const listBoxA = findNode(
      migrated.children,
      (node) => node.id === "listbox-a",
    );
    const listBoxB = findNode(
      migrated.children,
      (node) => node.id === "listbox-b",
    );

    // 모든 template anchor 제거.
    expect(countNodes(migrated.children, isListBoxTemplateAnchor)).toBe(0);
    expect(listBoxA?.children ?? []).toEqual([]);
    // templateRole 없는 정적 자식은 보존.
    expect((listBoxB?.children ?? []).map((child) => child.id)).toEqual([
      "keep-me",
    ]);
    // origin 은 보존 (bootstrap).
    expect(
      countNodes(
        migrated.children,
        (node) => node.id === LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
      ),
    ).toBe(1);

    // 멱등: 재실행해도 anchor 0, origin 1, 정적 자식 유지.
    const remigrated = migrateLegacyListBoxTemplatesToOrigins(migrated);
    expect(countNodes(remigrated.children, isListBoxTemplateAnchor)).toBe(0);
    expect(
      countNodes(
        remigrated.children,
        (node) => node.id === LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
      ),
    ).toBe(1);
  });

  // canonical runtime 의 실제 instance 는 type:"ListBox" 가 아니라 ref(component-listbox) 다.
  //   (factory parent = { type:"ref", ref:"component-listbox" }). migration 은 ref instance 의
  //   anchor 도 strip 해야 기존 프로젝트가 hydration 시 anchor-less 로 정리된다.
  it("strips the template anchor from a canonical ref(component-listbox) instance", () => {
    const doc = {
      version: "composition-1.0",
      children: [
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            {
              // 실제 runtime 구조 — ListBox instance 는 ref 노드.
              id: "listbox-ref",
              type: "ref",
              ref: "component-listbox",
              props: { items: [] },
              children: [
                {
                  id: "anchor-ref",
                  type: "ref",
                  ref: LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
                  props: {},
                  metadata: {
                    type: "legacy-element-props",
                    templateRole: LISTBOX_TEMPLATE_ANCHOR_ROLE,
                  },
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const migrated = migrateLegacyListBoxTemplatesToOrigins(doc);
    const findNodeById = (id: string) =>
      findNode(migrated.children, (node) => node.id === id);

    expect(countNodes(migrated.children, isListBoxTemplateAnchor)).toBe(0);
    expect(findNodeById("listbox-ref")?.children ?? []).toEqual([]);
  });

  // migration 의 over-reach 방지 가드 — bootstrap/strip 이 ListBox 계열에만 닿아야 한다.
  // (구 `listBoxTemplate.adr145.test.ts` TC5 에서 이관. anchor 주입 설계는 Option B 로 대체되어
  //  나머지 TC1~TC4 는 폐기됐지만, 이 범위 가드는 설계와 무관하게 유효.)
  it("leaves other collection containers (GridList) untouched", () => {
    const doc = legacyToCanonical(
      {
        elements: [
          el({
            id: "gl-1",
            type: "GridList",
            page_id: "P1",
            props: { items: [] },
          }),
        ],
        pages: [page({ id: "P1", title: "Home", slug: "/" })],
        layouts: [],
      },
      deps,
    );

    const gridList = findNode(doc.children, (node) => node.type === "GridList");
    expect(gridList).toBeDefined();
    expect(gridList!.children ?? []).toHaveLength(0);
  });
});

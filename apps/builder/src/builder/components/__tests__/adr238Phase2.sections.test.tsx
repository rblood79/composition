import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getCatalogCutoverTypes,
  type CanonicalNode,
  type CompositionDocument,
  type ResolvedNode,
} from "@composition/shared";

import { buildCanonicalSceneModel } from "../../workspace/canvas/scene/canonicalSceneModel";
import { resolveCanonicalDocument } from "../../../resolvers/canonical";
import { CanonicalNodeRenderer } from "../../../preview/components/CanonicalNodeRenderer";
import type { RenderContext } from "../../../preview/types/index";
import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";
import { ensureMenuTemplateOrigins } from "../menu/menuTemplateOrigins";
import { indexNodes } from "../staticCollectionMigration";
import { planTabItemInsert } from "../collectionItemInsert";
import { resolveSlotInsertAction } from "../slotHostPolicy";

/**
 * ADR-238 Phase 2 — Section 층 (breakdown §4 Phase 2 · G2).
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function seededDoc(user: CanonicalNode[] = []): CompositionDocument {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return ensureReusableCompositeOrigins(
    ensureMenuTemplateOrigins({
      version: "composition-1.0",
      children: [
        {
          id: "page-home",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-home", slug: "/" },
          children: [
            {
              id: "body-home",
              type: "body" as CanonicalNode["type"],
              children: user,
            },
          ],
        },
      ],
    } as CompositionDocument),
  );
}

function findResolved(
  nodes: readonly ResolvedNode[],
  id: string,
): ResolvedNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = findResolved((node.children ?? []) as ResolvedNode[], id);
    if (hit) return hit;
  }
  return undefined;
}

function renderResolved(node: ResolvedNode) {
  return render(
    <CanonicalNodeRenderer
      node={node}
      cutoverPrimitives={getCatalogCutoverTypes()}
      renderContext={
        {
          childrenByParent: new Map(),
          renderElement: () => null,
          updateElementProps: () => {},
        } as unknown as RenderContext
      }
    />,
  );
}

function renderById(doc: CompositionDocument, id: string) {
  const resolved = findResolved(
    resolveCanonicalDocument(doc) as ResolvedNode[],
    id,
  )!;
  return renderResolved(resolved);
}

const SECTION_ROWS = [
  {
    id: "s1",
    type: "section",
    header: "Fruit",
    items: [
      { id: "apple", label: "Apple" },
      { id: "pear", label: "Pear" },
    ],
  },
  {
    id: "s2",
    type: "section",
    header: "Veg",
    items: [{ id: "kale", label: "Kale" }],
  },
];

describe("ADR-238 Phase 2 — 이관 (section 이 섞인 정적 items)", () => {
  it("ListBox: section 노드 2 (Header + 항목 instance, props.id = 행 id) · items 0 · 노드 수 = 2s + m · 멱등", () => {
    const doc = seededDoc([
      {
        id: "sec-lb",
        type: "ListBox",
        props: { items: SECTION_ROWS },
      } as CanonicalNode,
    ]);
    const lb = indexNodes(doc).get("sec-lb")!;
    expect(lb.props?.items).toBeUndefined();
    expect(
      lb.children!.map((c) => [
        c.type,
        (c.props as Record<string, unknown>).id,
      ]),
    ).toEqual([
      ["ListBoxSection", "s1"],
      ["ListBoxSection", "s2"],
    ]);
    expect(lb.children![0]!.children!.map((c) => c.type)).toEqual([
      "Header",
      "ref",
      "ref",
    ]);
    expect(lb.children![0]!.children![0]!.props).toEqual({
      children: "Fruit",
    });
    expect(lb.children![0]!.children![1]).toMatchObject({
      ref: "component-listbox-item-default",
      props: { id: "apple" },
      descendants: { Label: { children: "Apple" } },
    });
    // BC 수식 (ii): 2s + m = 2·2 + 3 = 7.
    const count = (nodes: readonly CanonicalNode[]): number =>
      nodes.reduce((n, c) => n + 1 + count(c.children ?? []), 0);
    expect(count(lb.children!)).toBe(7);
    expect(JSON.stringify(ensureReusableCompositeOrigins(doc))).toBe(
      JSON.stringify(doc),
    );
  });

  it("Menu: per-section 선택 필드 → section props · separator → Separator · 하위 메뉴 행도 이관 (ADR-239)", () => {
    const doc = seededDoc([
      {
        id: "sec-menu",
        type: "Menu",
        props: {
          items: [
            {
              id: "ms",
              type: "section",
              header: "Edit",
              selectionMode: "single",
              selectedKeys: ["cut"],
              items: [
                { id: "cut", label: "Cut" },
                { id: "copy", label: "Copy" },
              ],
            },
            { id: "sep", type: "separator" },
            { id: "quit", label: "Quit" },
          ],
        },
      } as CanonicalNode,
      {
        id: "sub-menu",
        type: "Menu",
        props: {
          items: [
            {
              id: "s",
              type: "section",
              header: "S",
              items: [{ id: "a", label: "A", children: [{ id: "b" }] }],
            },
          ],
        },
      } as CanonicalNode,
    ]);
    const byId = indexNodes(doc);
    const menu = byId.get("sec-menu")!;
    expect(menu.children!.map((c) => c.type)).toEqual([
      "MenuSection",
      "Separator",
      "ref",
    ]);
    expect(menu.children![0]!.props).toEqual({
      id: "ms",
      selectionMode: "single",
      selectedKeys: ["cut"],
    });
    // ADR-239 Phase 3 — section 안 하위 메뉴 행도 이관 (section > 항목 > 자식 항목).
    const subMenu = byId.get("sub-menu")!;
    expect(subMenu.props?.items).toBeUndefined();
    expect(subMenu.children![0]!.type).toBe("MenuSection");
    const subItem = subMenu.children![0]!.children!.find((c) => c.type === "ref")!;
    expect((subItem.props as Record<string, unknown>).id).toBe("a");
    expect(
      (subItem.children ?? []).map((c) => (c.props as Record<string, unknown>).id),
    ).toEqual(["b"]);
  });

  it("GridList: section 노드 (GridListSection) · 바인딩 목록은 그대로", () => {
    const doc = seededDoc([
      {
        id: "sec-gl",
        type: "GridList",
        props: { items: SECTION_ROWS, layout: "stack" },
      } as CanonicalNode,
      {
        id: "bound-lb",
        type: "ListBox",
        props: {
          items: SECTION_ROWS,
          dataBinding: { source: "dataTable", name: "dt" },
        },
      } as CanonicalNode,
    ]);
    const byId = indexNodes(doc);
    expect(byId.get("sec-gl")!.children!.map((c) => c.type)).toEqual([
      "GridListSection",
      "GridListSection",
    ]);
    expect(byId.get("bound-lb")!.props?.items).toHaveLength(2);
  });
});

describe("ADR-238 Phase 2 — section origin (Components 페이지) · owner slot", () => {
  it("section origin 3 = Header + 항목 instance 2 · slot = 항목 후보 · owner slot 끝에 section origin · 멱등", () => {
    const doc = seededDoc();
    const byId = indexNodes(doc);
    for (const [id, type, owner, itemRef] of [
      [
        "component-listbox-section",
        "ListBoxSection",
        "component-listbox",
        "component-listbox-item-default",
      ],
      [
        "component-menu-section",
        "MenuSection",
        "component-menu",
        "component-menu-item-default",
      ],
      [
        "component-gridlist-section",
        "GridListSection",
        "component-gridlist",
        "component-gridlist-item-default",
      ],
    ] as const) {
      const origin = byId.get(id)!;
      expect(origin, id).toMatchObject({ type, reusable: true });
      expect(
        origin.children!.map((c) => c.type),
        id,
      ).toEqual(["Header", "ref", "ref"]);
      expect(
        origin
          .children!.slice(1)
          .map((c) => [
            (c as { ref?: string }).ref,
            (c.props as Record<string, unknown>).id,
          ]),
        id,
      ).toEqual([
        [itemRef, "item-1"],
        [itemRef, "item-2"],
      ]);
      expect((origin as { slot?: string[] }).slot, id).toContain(itemRef);
      expect((byId.get(owner) as { slot?: string[] }).slot, id).toContain(id);
    }
    expect(JSON.stringify(ensureReusableCompositeOrigins(doc))).toBe(
      JSON.stringify(doc),
    );
  });

  it("사용자가 바꾼 owner slot (시스템 후보 밖 항목) 은 그대로", () => {
    const doc = seededDoc();
    const custom = {
      ...doc,
      children: doc.children.map(function visit(node): CanonicalNode {
        if (node.id === "component-listbox") {
          return { ...node, slot: ["my-item"] } as CanonicalNode;
        }
        return node.children
          ? { ...node, children: node.children.map(visit) }
          : node;
      }),
    } as CompositionDocument;
    const again = ensureReusableCompositeOrigins(custom);
    expect(
      (indexNodes(again).get("component-listbox") as { slot?: unknown }).slot,
    ).toEqual(["my-item"]);
  });
});

describe("ADR-238 Phase 2 — Preview (RAC section 컴포넌트)", () => {
  it("ListBox: RAC ListBoxSection 2 · Header 글자 · option key = 행 id · 순서", () => {
    const doc = seededDoc([
      {
        id: "sec-lb",
        type: "ListBox",
        props: {
          items: SECTION_ROWS,
          selectionMode: "single",
          selectedKeys: ["pear"],
        },
      } as CanonicalNode,
    ]);
    const { container } = renderById(doc, "sec-lb");
    const sections = container.querySelectorAll(".react-aria-ListBoxSection");
    expect(sections).toHaveLength(2);
    expect(
      Array.from(container.querySelectorAll(".react-aria-Header")).map(
        (h) => h.textContent,
      ),
    ).toEqual(["Fruit", "Veg"]);
    const options = Array.from(container.querySelectorAll('[role="option"]'));
    expect(options.map((o) => o.getAttribute("data-key"))).toEqual([
      "apple",
      "pear",
      "kale",
    ]);
    expect(options.map((o) => o.getAttribute("aria-selected"))).toEqual([
      "false",
      "true",
      "false",
    ]);
  });

  it("GridList: RAC GridListSection · GridListHeader (Header 노드) · row key", () => {
    const doc = seededDoc([
      {
        id: "sec-gl",
        type: "GridList",
        props: { items: SECTION_ROWS, layout: "stack" },
      } as CanonicalNode,
    ]);
    const { container } = renderById(doc, "sec-gl");
    expect(
      container.querySelectorAll(".react-aria-GridListSection"),
    ).toHaveLength(2);
    expect(
      Array.from(container.querySelectorAll(".react-aria-GridListHeader")).map(
        (h) => h.textContent,
      ),
    ).toEqual(["Fruit", "Veg"]);
    expect(
      Array.from(container.querySelectorAll(".react-aria-GridListItem")).map(
        (r) => r.getAttribute("data-key"),
      ),
    ).toEqual(["apple", "pear", "kale"]);
  });

  it("Menu: popover 를 열면 MenuSection · Header · Separator · per-section 선택", async () => {
    const doc = seededDoc([
      {
        id: "sec-menu",
        type: "Menu",
        props: {
          label: "Open",
          items: [
            {
              id: "ms",
              type: "section",
              header: "Edit",
              selectionMode: "single",
              selectedKeys: ["copy"],
              items: [
                { id: "cut", label: "Cut" },
                { id: "copy", label: "Copy" },
              ],
            },
            { id: "sep", type: "separator" },
            { id: "quit", label: "Quit" },
          ],
        },
      } as CanonicalNode,
    ]);
    const { container, baseElement } = renderById(doc, "sec-menu");
    const trigger = container.querySelector("button")!;
    await act(async () => {
      fireEvent.click(trigger);
    });
    const menu = baseElement.querySelector('[role="menu"]')!;
    expect(menu).not.toBeNull();
    expect(menu.querySelector("section")).not.toBeNull();
    expect(menu.querySelector('[role="separator"]')).not.toBeNull();
    const items = Array.from(
      menu.querySelectorAll('[role="menuitem"],[role="menuitemradio"]'),
    );
    expect(items.map((i) => i.getAttribute("data-key"))).toEqual([
      "cut",
      "copy",
      "quit",
    ]);
    expect(
      menu.querySelector('[data-key="copy"]')!.getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("Components 페이지의 단독 section origin 은 크래시 없이 그린다 (collection 호스트)", () => {
    const doc = seededDoc();
    for (const id of [
      "component-listbox-section",
      "component-gridlist-section",
    ]) {
      expect(() => renderById(doc, id), id).not.toThrow();
      cleanup();
    }
  });
});

describe("ADR-238 Phase 2 — 같은 section origin instance 둘 (R4 · 진단 (c))", () => {
  function twoSectionInstances(): CompositionDocument {
    return seededDoc([
      {
        id: "lb-2",
        type: "ListBox",
        props: {},
        children: [
          {
            id: "sec-x",
            type: "ref",
            ref: "component-listbox-section",
            props: { id: "x" },
          },
          {
            id: "sec-y",
            type: "ref",
            ref: "component-listbox-section",
            props: { id: "y" },
          },
        ],
      } as unknown as CanonicalNode,
    ]);
  }

  it("Preview: 상속 항목 key = `<section key>/<항목 key>` — 4 개 유일", () => {
    const { container } = renderById(twoSectionInstances(), "lb-2");
    const keys = Array.from(container.querySelectorAll('[role="option"]')).map(
      (o) => o.getAttribute("data-key"),
    );
    expect(keys).toEqual(["x/item-1", "x/item-2", "y/item-1", "y/item-2"]);
  });

  it("Canvas: owner selectedKeys 의 접두 key 는 그 section 의 항목만 선택", () => {
    const doc = twoSectionInstances();
    const withSelection = {
      ...doc,
      children: doc.children.map(function visit(node): CanonicalNode {
        if (node.id === "lb-2") {
          return {
            ...node,
            props: { selectedKeys: ["y/item-1"] },
          } as CanonicalNode;
        }
        return node.children
          ? { ...node, children: node.children.map(visit) }
          : node;
      }),
    } as CompositionDocument;
    const model = buildCanonicalSceneModel(withSelection);
    const selected: string[] = [];
    for (const section of ["sec-x", "sec-y"]) {
      for (const item of model.sceneChildrenByParent.get(section) ?? []) {
        if ((item.props as Record<string, unknown>).isSelected === true) {
          selected.push(item.id);
        }
      }
    }
    expect(selected).toEqual(["sec-y/component-listbox-section__item-1"]);
  });
});

describe('ADR-238 Phase 2 — Slot "+"', () => {
  it("ListBox host + section origin 후보 → section instance (`props.id` = 새 key)", () => {
    const doc = seededDoc();
    const byId = indexNodes(doc);
    expect(
      resolveSlotInsertAction(
        byId.get("component-listbox") as never,
        byId.get("component-listbox-section") as never,
      ),
    ).toEqual({ kind: "list-item" });
    const plan = planTabItemInsert({
      document: doc,
      hostId: "component-listbox",
      candidateId: "component-listbox-section",
      newKey: "k1",
    });
    expect(plan).toMatchObject({
      kind: "plain",
      tabListId: "component-listbox",
      tab: {
        type: "ref",
        ref: "component-listbox-section",
        props: { id: "k1" },
      },
      selection: null,
    });
  });

  it("section host (origin) + 항목 후보 → 항목 instance 자식", () => {
    const doc = seededDoc();
    const byId = indexNodes(doc);
    const section = byId.get("component-listbox-section")!;
    expect(
      resolveSlotInsertAction(
        section as never,
        byId.get("component-listbox-item-default") as never,
      ),
    ).toEqual({ kind: "list-item" });
    const plan = planTabItemInsert({
      document: doc,
      hostId: section.id,
      candidateId: "component-listbox-item-default",
      newKey: "k2",
    });
    expect(plan).toMatchObject({
      kind: "plain",
      tabListId: section.id,
      tab: {
        type: "ref",
        ref: "component-listbox-item-default",
        props: { id: "k2" },
      },
    });
  });
});

describe("ADR-238 Phase 2 — Canvas scene", () => {
  it("section · Header 가 scene 노드 · Header 글자 = header · 항목은 section 자식", () => {
    const doc = seededDoc([
      {
        id: "sec-lb",
        type: "ListBox",
        props: { items: SECTION_ROWS },
      } as CanonicalNode,
    ]);
    const model = buildCanonicalSceneModel(doc);
    const sections = model.sceneChildrenByParent.get("sec-lb") ?? [];
    expect(sections.map((s) => s.type)).toEqual([
      "ListBoxSection",
      "ListBoxSection",
    ]);
    const kids = model.sceneChildrenByParent.get(sections[0]!.id) ?? [];
    expect(kids.map((k) => k.type)).toEqual([
      "Header",
      "ListBoxItem",
      "ListBoxItem",
    ]);
    expect((kids[0]!.props as Record<string, unknown>).children).toBe("Fruit");
  });
});

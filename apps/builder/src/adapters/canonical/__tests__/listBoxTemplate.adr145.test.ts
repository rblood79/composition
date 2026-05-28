/**
 * ADR-145 Phase A — ListBox `ListBoxItem` template element + canonical round-trip.
 *
 * Gate G1 통과 조건 검증:
 *  - factory 자동 template 생성 → canonical document round-trip PASS
 *  - legacy ListBox (template 없음) hydration migration → synthetic template 주입 round-trip PASS
 *  - reusable master 등록 → component-agnostic 메커니즘 자동 흡수 round-trip PASS
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalNode } from "@composition/shared";
import type { Element, Page } from "@/types/builder/unified.types";
import { legacyToCanonical } from "..";
import { convertComponentRole } from "../componentRoleAdapter";
import { withComponentOriginMirror } from "../componentSemanticsMirror";
import { convertPageLayout } from "../slotAndLayoutAdapter";
import {
  LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
  LISTBOX_TEMPLATE_ANCHOR_ROLE,
} from "../../../builder/components/listbox/listBoxTemplateOrigins";

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

function findFirstByType(
  nodes: readonly CanonicalNode[],
  type: string,
): CanonicalNode | undefined {
  for (const node of nodes) {
    if (node.type === type) return node;
    const found = findFirstByType(node.children ?? [], type);
    if (found) return found;
  }
  return undefined;
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

function findContentListBox(
  nodes: readonly CanonicalNode[],
): CanonicalNode | undefined {
  return findNode(
    nodes,
    (node) => node.type === "ListBox" && node.reusable !== true,
  );
}

function expectTemplateAnchor(node: CanonicalNode | undefined): void {
  expect(node).toMatchObject({
    type: "ref",
    ref: LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
    metadata: {
      templateRole: LISTBOX_TEMPLATE_ANCHOR_ROLE,
      locked: true,
      deleteDisabled: true,
    },
  });
}

describe("ADR-145 Phase A — ListBox template element round-trip", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  // ────────────────────────────────────────────
  // TC1: factory 자동 template 생성 (신규 프로젝트)
  // ────────────────────────────────────────────

  it("TC1: factory 가 생성한 ListBox + ListBoxItem template → canonical document round-trip 보존", () => {
    const elements: Element[] = [
      el({
        id: "lb-1",
        type: "ListBox",
        page_id: "P1",
        props: { orientation: "vertical", items: [] },
      }),
      el({
        id: "lb-1-template",
        type: "ListBoxItem",
        page_id: "P1",
        parent_id: "lb-1",
        props: { style: {} },
      }),
    ];
    const pages: Page[] = [page({ id: "P1", title: "Home", slug: "/" })];

    const doc = legacyToCanonical({ elements, pages, layouts: [] }, deps);

    const lbNode = findContentListBox(doc.children ?? []);
    expect(lbNode).toBeDefined();
    expect(lbNode!.children).toHaveLength(1);
    expectTemplateAnchor(lbNode!.children![0]);

    // hydration migration 이 local template child 를 중복 보존하지 않음
    const allTemplateAnchors = (lbNode!.children ?? []).filter(
      (c) =>
        c.type === "ref" &&
        "ref" in c &&
        c.ref === LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
    );
    expect(allTemplateAnchors).toHaveLength(1);
  });

  // ────────────────────────────────────────────
  // TC2: legacy ListBox hydration migration (자식 없음 → synthetic 주입)
  // ────────────────────────────────────────────

  it("TC2: legacy ListBox (template 없음) → hydration migration 으로 ListBoxItem template 자동 주입", () => {
    const elements: Element[] = [
      el({
        id: "legacy-lb",
        type: "ListBox",
        page_id: "P1",
        props: { orientation: "vertical", items: [] },
      }),
    ];
    const pages: Page[] = [page({ id: "P1", title: "Home", slug: "/" })];

    const doc = legacyToCanonical({ elements, pages, layouts: [] }, deps);

    const lbNode = findContentListBox(doc.children ?? []);
    expect(lbNode).toBeDefined();
    expect(lbNode!.children).toHaveLength(1);
    expectTemplateAnchor(lbNode!.children![0]);

    // synthetic template anchor id 검증 — `<lb id seg>::template::listboxitem`
    expect(lbNode!.children![0].id).toContain("::template::listboxitem");
  });

  // ────────────────────────────────────────────
  // TC3: ListBox + non-ListBoxItem 자식만 있는 경우에도 hydration migration 발동
  // ────────────────────────────────────────────

  it("TC3: legacy ListBox (Text 자식만) → hydration migration 으로 ListBoxItem template 추가 주입", () => {
    const elements: Element[] = [
      el({
        id: "legacy-lb-2",
        type: "ListBox",
        page_id: "P1",
        props: { items: [] },
      }),
      el({
        id: "legacy-lb-2-text",
        type: "Text",
        page_id: "P1",
        parent_id: "legacy-lb-2",
      }),
    ];
    const pages: Page[] = [page({ id: "P1", title: "Home", slug: "/" })];

    const doc = legacyToCanonical({ elements, pages, layouts: [] }, deps);

    const lbNode = findContentListBox(doc.children ?? []);
    expect(lbNode).toBeDefined();
    expect(lbNode!.children).toHaveLength(2);

    const itemTypes = (lbNode!.children ?? []).map((c) => c.type);
    expect(itemTypes).toContain("Text");
    expect(itemTypes).toContain("ref");
    expectTemplateAnchor(
      (lbNode!.children ?? []).find((c) => c.type === "ref"),
    );
  });

  // ────────────────────────────────────────────
  // TC4: reusable master ListBox — component-agnostic 자동 흡수
  // ────────────────────────────────────────────

  it("TC4: reusable master ListBox + ListBoxItem template → canonical reusable:true + template 보존", () => {
    const elements: Element[] = [
      withComponentOriginMirror(
        el({
          id: "master-lb",
          type: "ListBox",
          page_id: "P1",
          componentName: "Country List",
          customId: "country-list",
          props: { items: [] },
        }),
      ),
      el({
        id: "master-lb-template",
        type: "ListBoxItem",
        page_id: "P1",
        parent_id: "master-lb",
        props: { style: {} },
      }),
    ];
    const pages: Page[] = [page({ id: "P1", title: "Home", slug: "/" })];

    const doc = legacyToCanonical({ elements, pages, layouts: [] }, deps);

    const masterNode = findNode(
      doc.children ?? [],
      (node) => node.type === "ListBox" && node.name === "Country List",
    );
    expect(masterNode).toBeDefined();
    expect(masterNode!.reusable).toBe(true);
    expect(masterNode!.children).toHaveLength(1);
    expectTemplateAnchor(masterNode!.children![0]);
  });

  // ────────────────────────────────────────────
  // TC5: 다른 SYNTHETIC composite (GridList) 는 영향 받지 않음 — guard 가 ListBox 만 처리
  // ────────────────────────────────────────────

  it("TC5: GridList 는 hydration migration 영향 없음 — ListBox 단일 시범 ADR scope 보존", () => {
    const elements: Element[] = [
      el({
        id: "gl-1",
        type: "GridList",
        page_id: "P1",
        props: { items: [] },
      }),
    ];
    const pages: Page[] = [page({ id: "P1", title: "Home", slug: "/" })];

    const doc = legacyToCanonical({ elements, pages, layouts: [] }, deps);

    const glNode = findFirstByType(doc.children ?? [], "GridList");
    expect(glNode).toBeDefined();
    expect(glNode!.children ?? []).toHaveLength(0);
  });
});

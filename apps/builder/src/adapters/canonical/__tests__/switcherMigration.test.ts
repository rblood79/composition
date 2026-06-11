/**
 * ADR-912 Switcher cleanup — legacyToCanonical end-to-end: Switcher/TabBar 노드가
 * ToggleButtonGroup 으로 변환되고 자식 ToggleButton[] selection 이 보존되는지 검증.
 *
 * Switcher(@pixi/ui 세그먼트 컨트롤) = RAC ToggleButtonGroup(selectionMode="single") 중복.
 * 과거 직렬화된 Switcher/TabBar 노드는 hydration 시 ToggleButtonGroup 으로 흡수 —
 * type 변환(tagToType) + props 변환(items/activeIndex strip, selectionMode 주입).
 *
 * kill criteria: 변환 후 type≠ToggleButtonGroup 또는 자식 isSelected 손실 시 Switcher spec
 * 제거(Commit 2) 시 Skia 미표시/selection 회귀 → 제거 보류.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { CanonicalNode } from "@composition/shared";
import type { Element, Page } from "@/types/builder/unified.types";
import { legacyToCanonical } from "../index";
import { convertComponentRole } from "../componentRoleAdapter";
import { convertPageLayout } from "../slotAndLayoutAdapter";

const deps = { convertComponentRole, convertPageLayout };

function el(partial: Partial<Element> & Pick<Element, "id" | "type">): Element {
  return { props: {}, parent_id: null, order_num: 0, ...partial } as Element;
}

function page(partial: Pick<Page, "id" | "title">): Page {
  return { project_id: "proj-1", slug: "/", ...partial } as Page;
}

function findByType(
  nodes: CanonicalNode[] | undefined,
  type: string,
): CanonicalNode | null {
  for (const n of nodes ?? []) {
    if (n.type === type) return n;
    const found = findByType(
      (n as { children?: CanonicalNode[] }).children,
      type,
    );
    if (found) return found;
  }
  return null;
}

describe("ADR-912 Switcher cleanup — legacy Switcher → ToggleButtonGroup hydration", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warnSpy.mockRestore());

  function buildSwitcherDoc(parentType: "Switcher" | "TabBar") {
    const elements: Element[] = [
      el({ id: "p-body", type: "body", page_id: "pg1" }),
      el({
        id: "sw",
        type: parentType,
        page_id: "pg1",
        parent_id: "p-body",
        props: {
          items: ["Tab 1", "Tab 2"],
          activeIndex: 0,
          isDisabled: false,
          style: { display: "flex", width: 240 },
        },
      }),
      el({
        id: "tb1",
        type: "ToggleButton",
        page_id: "pg1",
        parent_id: "sw",
        order_num: 0,
        props: { children: "Tab 1", isSelected: true, style: { flex: 1 } },
      }),
      el({
        id: "tb2",
        type: "ToggleButton",
        page_id: "pg1",
        parent_id: "sw",
        order_num: 1,
        props: { children: "Tab 2", isSelected: false, style: { flex: 1 } },
      }),
    ];
    return legacyToCanonical(
      { elements, pages: [page({ id: "pg1", title: "Page 1" })], layouts: [] },
      deps,
    );
  }

  it("Switcher 노드 type 이 ToggleButtonGroup 으로 변환된다", () => {
    const doc = buildSwitcherDoc("Switcher");
    const node = findByType(doc.children, "ToggleButtonGroup");
    expect(node, "ToggleButtonGroup 노드 존재").not.toBeNull();
    // 변환 전 type(Switcher)는 트리에 없어야 함
    expect(findByType(doc.children, "Switcher")).toBeNull();
  });

  it("TabBar 노드도 ToggleButtonGroup 으로 변환된다 (4단계 BC alias)", () => {
    const doc = buildSwitcherDoc("TabBar");
    expect(findByType(doc.children, "ToggleButtonGroup")).not.toBeNull();
    expect(findByType(doc.children, "TabBar")).toBeNull();
  });

  it("props: items/activeIndex strip + selectionMode/orientation 주입", () => {
    const doc = buildSwitcherDoc("Switcher");
    const node = findByType(doc.children, "ToggleButtonGroup")!;
    const props = node.props as Record<string, unknown>;
    expect("items" in props).toBe(false);
    expect("activeIndex" in props).toBe(false);
    expect(props.selectionMode).toBe("single");
    expect(props.orientation).toBe("horizontal");
    // 비-selection prop 보존
    expect(props.isDisabled).toBe(false);
    expect(props.style).toEqual({ display: "flex", width: 240 });
  });

  it("자식 ToggleButton[] selection 보존 (isSelected SSOT)", () => {
    const doc = buildSwitcherDoc("Switcher");
    const node = findByType(doc.children, "ToggleButtonGroup")!;
    const children = (node as { children?: CanonicalNode[] }).children ?? [];
    const toggles = children.filter((c) => c.type === "ToggleButton");
    expect(toggles.length).toBe(2);
    const first = toggles[0].props as Record<string, unknown>;
    const second = toggles[1].props as Record<string, unknown>;
    // 첫 자식 isSelected:true 보존 = 초기 선택 표현 유지
    expect(first.isSelected).toBe(true);
    expect(second.isSelected).toBe(false);
    expect(first.children).toBe("Tab 1");
  });
});

// @vitest-environment jsdom
/**
 * ADR-911 Phase 2 PR-D2 — FrameElementTree 컴포넌트 단위 테스트.
 *
 * 본 테스트는 FrameElementTree 가 프레젠테이션 전용임을 검증한다 — element
 * 선택 / 삭제 핸들러 구현은 외부 책임이고, FrameElementTree 는 props 만으로
 * 결정적 UI 를 렌더한다.
 *
 * 시나리오:
 *  1. frameId=null → "Select a frame to view elements" placeholder
 *  2. frameId=string + tree=[] → "No elements in this frame" placeholder
 *  3. tree 1-level 렌더 → element type 표시
 *  4. tree nested + expandedKeys → 자식 노드 렌더
 *  5. tree nested + 미펼침 → 자식 노드 미렌더
 *  6. element click → onElementClick(element) 호출 + frameId 매핑
 *  7. element 'body' type → Settings 버튼 (Delete 없음)
 *  8. element non-body delete → onElementDelete(element)
 *  9. ChevronRight button click → toggleKey(id)
 * 10. Collapse All → onCollapseAll
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";

import { FrameElementTree } from "../FrameElementTree";
import type { ElementTreeItem } from "@/types/builder/stately.types";

if (typeof globalThis.CSS === "undefined") {
  Object.defineProperty(globalThis, "CSS", {
    value: {},
    configurable: true,
  });
}

if (typeof globalThis.CSS.escape !== "function") {
  Object.defineProperty(globalThis.CSS, "escape", {
    value: (value: string) => String(value),
    configurable: true,
  });
}

function makeItem(
  id: string,
  type: string,
  override: Partial<ElementTreeItem> = {},
): ElementTreeItem {
  return {
    id,
    type,
    parent_id: null,
    order_num: 0,
    props: {},
    deleted: false,
    children: [],
    ...override,
  } as ElementTreeItem;
}

function makeProps(
  override: Partial<React.ComponentProps<typeof FrameElementTree>> = {},
): React.ComponentProps<typeof FrameElementTree> {
  return {
    tree: [],
    frameId: "frame-1",
    selectedElementId: null,
    expandedKeys: new Set<string>(),
    toggleKey: vi.fn(),
    onCollapseAll: vi.fn(),
    onElementClick: vi.fn(),
    onElementDelete: vi.fn(),
    ...override,
  };
}

describe("FrameElementTree (ADR-911 P2 PR-D2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("placeholder rendering", () => {
    it("frameId=null → 'Select a frame to view elements' 표시", () => {
      render(<FrameElementTree {...makeProps({ frameId: null })} />);
      expect(screen.getByText("Select a frame to view elements")).toBeTruthy();
    });

    it("frameId 있고 tree=[] → 'No elements in this frame' 표시", () => {
      render(<FrameElementTree {...makeProps({ frameId: "f-1", tree: [] })} />);
      expect(screen.getByText("No elements in this frame")).toBeTruthy();
    });
  });

  describe("tree rendering", () => {
    it("tree 1-level → element type 표시", () => {
      render(
        <FrameElementTree
          {...makeProps({
            tree: [makeItem("el-1", "Button"), makeItem("el-2", "Text")],
          })}
        />,
      );
      expect(screen.getByText("Button")).toBeTruthy();
      expect(screen.getByText("Text")).toBeTruthy();
    });

    it("Slot type → 'Slot: <name>' 형태로 표시", () => {
      render(
        <FrameElementTree
          {...makeProps({
            tree: [
              makeItem("slot-1", "Slot", { props: { name: "header" } }),
              makeItem("slot-2", "Slot", { props: {} }),
            ],
          })}
        />,
      );
      expect(screen.getByText("Slot: header")).toBeTruthy();
      expect(screen.getByText("Slot: unnamed")).toBeTruthy();
    });

    it("nested tree + expandedKeys 매칭 시 자식 표시", () => {
      const parent = makeItem("parent", "Container", {
        children: [makeItem("child", "Button")],
      });
      render(
        <FrameElementTree
          {...makeProps({
            tree: [parent],
            expandedKeys: new Set(["parent"]),
          })}
        />,
      );
      expect(screen.getByText("Container")).toBeTruthy();
      expect(screen.getByText("Button")).toBeTruthy();
    });

    it("nested tree + expandedKeys 미매칭 시 자식 미표시", () => {
      const parent = makeItem("parent", "Container", {
        children: [makeItem("child", "Button")],
      });
      render(
        <FrameElementTree
          {...makeProps({ tree: [parent], expandedKeys: new Set() })}
        />,
      );
      expect(screen.getByText("Container")).toBeTruthy();
      expect(screen.queryByText("Button")).toBeNull();
    });

    it("selectedElementId 매칭 시 active 클래스 적용", () => {
      const { container } = render(
        <FrameElementTree
          {...makeProps({
            tree: [makeItem("el-1", "Button"), makeItem("el-2", "Text")],
            selectedElementId: "el-1",
          })}
        />,
      );
      const items = container.querySelectorAll(".elementItem");
      expect(items[0].className).toContain("active");
      expect(items[1].className).not.toContain("active");

      const wrappers = screen.getAllByRole("row");
      expect(wrappers[0].className).toContain("react-aria-TreeItem");
      expect(wrappers[0].getAttribute("aria-selected")).toBe("true");
      expect(wrappers[1].getAttribute("aria-selected")).toBe("false");
    });

    it("Pages Layers와 같은 section 구조로 frame element tree를 렌더한다", () => {
      const { container } = render(
        <FrameElementTree
          {...makeProps({
            tree: [makeItem("el-1", "Button")],
          })}
        />,
      );

      expect(container.firstElementChild?.className).toBe("section");
      expect(container.querySelector(".section-content")).toBeTruthy();
      expect(container.querySelector(".frame-tree")).toBeTruthy();
      expect(container.querySelector(".sidebar_elements")).toBeNull();
      expect(container.querySelector(".frame-layer-tree")).toBeNull();
    });
  });

  describe("interactions", () => {
    it("element click → onElementClick(element) 호출 + frameId 가 element.layout_id 로 매핑", () => {
      const onElementClick = vi.fn();
      render(
        <FrameElementTree
          {...makeProps({
            tree: [makeItem("el-1", "Button")],
            frameId: "frame-abc",
            onElementClick,
          })}
        />,
      );

      fireEvent.click(screen.getByText("Button"));

      expect(onElementClick).toHaveBeenCalledTimes(1);
      const element = onElementClick.mock.calls[0][0];
      expect(element.id).toBe("el-1");
      expect(element.type).toBe("Button");
      expect(element.layout_id).toBe("frame-abc");
      expect(element.page_id).toBeNull();
    });

    it("non-body Delete 버튼 클릭 → onElementDelete(element) + stopPropagation", async () => {
      const onElementClick = vi.fn();
      const onElementDelete = vi.fn().mockResolvedValue(undefined);
      render(
        <FrameElementTree
          {...makeProps({
            tree: [makeItem("el-1", "Button")],
            onElementClick,
            onElementDelete,
          })}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Delete Button" }));
      await Promise.resolve();

      expect(onElementDelete).toHaveBeenCalledTimes(1);
      expect(onElementDelete.mock.calls[0][0].id).toBe("el-1");
      expect(onElementClick).not.toHaveBeenCalled();
    });

    it("body type → Settings 버튼 표시 (Delete 없음)", () => {
      render(
        <FrameElementTree
          {...makeProps({ tree: [makeItem("body-1", "body")] })}
        />,
      );
      expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /^Delete/ })).toBeNull();
    });

    it("ChevronRight 버튼 click (자식 있는 노드) → toggleKey(id) + stopPropagation", () => {
      const toggleKey = vi.fn();
      const onElementClick = vi.fn();
      const parent = makeItem("parent", "Container", {
        children: [makeItem("child", "Button")],
      });
      render(
        <FrameElementTree
          {...makeProps({ tree: [parent], toggleKey, onElementClick })}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: /Expand Container/ }));

      expect(toggleKey).toHaveBeenCalledWith("parent");
      expect(onElementClick).not.toHaveBeenCalled();
    });

    it("Collapse All 버튼 클릭 → onCollapseAll", () => {
      const onCollapseAll = vi.fn();
      render(<FrameElementTree {...makeProps({ onCollapseAll })} />);

      fireEvent.click(screen.getByRole("button", { name: "Collapse All" }));

      expect(onCollapseAll).toHaveBeenCalledTimes(1);
    });
  });
});

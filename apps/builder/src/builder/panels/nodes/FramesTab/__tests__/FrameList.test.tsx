// @vitest-environment jsdom
/**
 * ADR-111 Phase 2 PR-D — FrameList 컴포넌트 단위 테스트.
 *
 * 본 테스트는 FrameList 가 프레젠테이션 전용임을 검증한다 — 데이터 source 와
 * 핸들러 구현은 외부 책임이고, FrameList 는 props 만으로 결정적 UI 를 렌더한다.
 *
 * 시나리오 5개:
 *  1. 빈 frames → "No frames available"
 *  2. 2개 frames 렌더 → 이름 모두 표시
 *  3. Add 버튼 클릭 → onAdd 호출 (frame id 인자 없음)
 *  4. Frame 항목 클릭 → onSelect(frame.id) 호출
 *  5. Delete 버튼 클릭 → onDelete(frame.id) 호출 + onSelect 미호출 (stopPropagation)
 *
 * + selectedFrameId 매칭 시 active 클래스 표시 확인.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";

import { FrameList } from "../FrameList";

function makeProps(
  override: Partial<React.ComponentProps<typeof FrameList>> = {},
): React.ComponentProps<typeof FrameList> {
  return {
    frames: [],
    selectedFrameId: null,
    onSelect: vi.fn(),
    onDelete: vi.fn(),
    onAdd: vi.fn(),
    ...override,
  };
}

describe("FrameList (ADR-111 P2 PR-D)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("rendering", () => {
    it("frames 가 비어있으면 'No frames available' 표시", () => {
      render(<FrameList {...makeProps({ frames: [] })} />);
      expect(screen.getByText("No frames available")).toBeTruthy();
    });

    it("frames 2개를 받으면 각 name 을 모두 표시한다", () => {
      render(
        <FrameList
          {...makeProps({
            frames: [
              { id: "f-1", name: "Header Frame" },
              { id: "f-2", name: "Footer Frame" },
            ],
          })}
        />,
      );
      expect(screen.getByText("Header Frame")).toBeTruthy();
      expect(screen.getByText("Footer Frame")).toBeTruthy();
    });

    it("selectedFrameId 와 매칭되는 frame 만 active 클래스 표시", () => {
      const { container } = render(
        <FrameList
          {...makeProps({
            frames: [
              { id: "f-1", name: "Selected" },
              { id: "f-2", name: "Other" },
            ],
            selectedFrameId: "f-1",
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

    it("Pages와 같은 section 구조로 frame 목록을 렌더한다", () => {
      const { container } = render(
        <FrameList
          {...makeProps({
            frames: [{ id: "f-1", name: "Frame" }],
          })}
        />,
      );

      expect(container.firstElementChild?.className).toBe("section");
      expect(container.querySelector(".section-content")).toBeTruthy();
      expect(container.querySelector(".frame-tree")).toBeTruthy();
      expect(container.querySelector(".sidebar_layouts")).toBeNull();
      expect(container.querySelector(".frame-list-tree")).toBeNull();
    });
  });

  describe("interactions", () => {
    it("Add 버튼 클릭 시 onAdd 호출", () => {
      const onAdd = vi.fn();
      render(<FrameList {...makeProps({ onAdd })} />);

      fireEvent.click(screen.getByRole("button", { name: "Add Frame" }));

      // React onClick 은 SyntheticEvent 를 인자로 전달 — 호출 횟수만 검증
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    it("Frame 항목 클릭 시 onSelect(frameId) 호출", () => {
      const onSelect = vi.fn();
      render(
        <FrameList
          {...makeProps({
            frames: [{ id: "frame-abc", name: "Header" }],
            onSelect,
          })}
        />,
      );

      fireEvent.click(screen.getByText("Header"));

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith("frame-abc");
    });

    it("Delete 버튼 클릭 시 onDelete(frameId) + stopPropagation (onSelect 미호출)", () => {
      const onSelect = vi.fn();
      const onDelete = vi.fn();
      render(
        <FrameList
          {...makeProps({
            frames: [{ id: "frame-xyz", name: "Doomed" }],
            onSelect,
            onDelete,
          })}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Delete Doomed" }));

      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onDelete).toHaveBeenCalledWith("frame-xyz");
      // stopPropagation: 부모 onClick (onSelect) 미호출
      expect(onSelect).not.toHaveBeenCalled();
    });
  });
});

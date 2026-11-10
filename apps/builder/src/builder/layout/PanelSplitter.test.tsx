// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PanelSplitter } from "./PanelSplitter";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function dispatchPointer(
  target: Element | Document | Window,
  type: "pointerdown" | "pointermove" | "pointerup",
  clientX: number,
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX,
    clientY: 20,
  });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: "mouse" },
  });
  fireEvent(target, event);
}

describe("PanelSplitter accessibility and interaction contract", () => {
  it("exposes the controlled pane range and supports pointer plus Arrow keys", () => {
    vi.stubGlobal("PointerEvent", MouseEvent);
    const onResizeStart = vi.fn();
    const onResize = vi.fn();
    const onResizeEnd = vi.fn();
    const onParentKeyDown = vi.fn();

    render(
      <div onKeyDown={onParentKeyDown}>
        <PanelSplitter
          edge="right"
          label="History 패널 오른쪽 크기 조절"
          controls="panel-history-content"
          value={320}
          minValue={200}
          maxValue={800}
          onResizeStart={onResizeStart}
          onResize={onResize}
          onResizeEnd={onResizeEnd}
        />
      </div>,
    );

    const splitter = screen.getByRole("separator", {
      name: "History 패널 오른쪽 크기 조절",
    });
    expect(splitter.getAttribute("aria-controls")).toBe(
      "panel-history-content",
    );
    expect(splitter.getAttribute("aria-orientation")).toBe("vertical");
    expect(splitter.getAttribute("aria-valuenow")).toBe("320");
    expect(splitter.getAttribute("aria-valuemin")).toBe("200");
    expect(splitter.getAttribute("aria-valuemax")).toBe("800");

    splitter.focus();
    expect(document.activeElement).toBe(splitter);
    fireEvent.keyDown(splitter, { key: "ArrowRight" });
    expect(onResizeStart).toHaveBeenCalledTimes(1);
    expect(onResize).toHaveBeenLastCalledWith(1, 0);
    expect(onResizeEnd).toHaveBeenCalledTimes(1);
    expect(onParentKeyDown).not.toHaveBeenCalled();

    dispatchPointer(splitter, "pointerdown", 100);
    dispatchPointer(window, "pointermove", 112);
    dispatchPointer(window, "pointermove", 116);
    dispatchPointer(window, "pointerup", 112);
    expect(onResize).toHaveBeenNthCalledWith(2, 12, 0);
    expect(onResize).toHaveBeenLastCalledWith(16, 0);
  });

  it("keeps data-resizing and a body shield only while a pointer drag is in progress", () => {
    vi.stubGlobal("PointerEvent", MouseEvent);
    const onResize = vi.fn();

    render(
      <PanelSplitter
        edge="bottom"
        label="Navigator 패널 아래쪽 크기 조절"
        controls="panel-navigator-content"
        value={300}
        minValue={160}
        maxValue={800}
        onResizeStart={vi.fn()}
        onResize={onResize}
        onResizeEnd={vi.fn()}
      />,
    );

    const splitter = screen.getByRole("separator");
    const shield = () => document.body.querySelector(".panel-resize-shield");

    // 클릭만으로는 켜지지 않는다 (useMove 는 첫 이동에서 시작)
    dispatchPointer(splitter, "pointerdown", 100);
    expect(splitter.getAttribute("data-resizing")).toBeNull();
    expect(shield()).toBeNull();

    dispatchPointer(window, "pointermove", 108);
    expect(splitter.getAttribute("data-resizing")).toBe("true");
    expect(shield()?.getAttribute("data-edge")).toBe("bottom");
    expect(shield()?.getAttribute("aria-hidden")).toBe("true");

    dispatchPointer(window, "pointerup", 108);
    expect(splitter.getAttribute("data-resizing")).toBeNull();
    expect(shield()).toBeNull();

    // 키보드 조절은 막을 띄우지 않는다
    splitter.focus();
    fireEvent.keyDown(splitter, { key: "ArrowDown" });
    expect(onResize).toHaveBeenLastCalledWith(0, 1);
    expect(splitter.getAttribute("data-resizing")).toBeNull();
    expect(shield()).toBeNull();
  });

  it("moves to min/max with Home/End and preserves physical RTL direction", () => {
    const onResize = vi.fn();

    render(
      <div dir="rtl">
        <PanelSplitter
          edge="left"
          label="Properties 패널 왼쪽 크기 조절"
          controls="panel-properties-content"
          value={320}
          minValue={200}
          maxValue={800}
          onResizeStart={vi.fn()}
          onResize={onResize}
          onResizeEnd={vi.fn()}
        />
      </div>,
    );

    const splitter = screen.getByRole("separator");
    fireEvent.keyDown(splitter, { key: "Home" });
    expect(onResize).toHaveBeenLastCalledWith(120, 0);

    fireEvent.keyDown(splitter, { key: "End" });
    expect(onResize).toHaveBeenLastCalledWith(-480, 0);

    fireEvent.keyDown(splitter, { key: "ArrowLeft" });
    expect(onResize).toHaveBeenLastCalledWith(-1, 0);
  });

  it("maps horizontal Home/End targets to the resize edge", () => {
    const onResize = vi.fn();

    render(
      <PanelSplitter
        edge="top"
        label="Monitor 패널 상단 크기 조절"
        controls="panel-styles-content"
        value={300}
        minValue={160}
        maxValue={800}
        onResizeStart={vi.fn()}
        onResize={onResize}
        onResizeEnd={vi.fn()}
      />,
    );

    const splitter = screen.getByRole("separator");
    expect(splitter.getAttribute("aria-orientation")).toBe("horizontal");
    fireEvent.keyDown(splitter, { key: "Home" });
    expect(onResize).toHaveBeenLastCalledWith(0, 140);
    fireEvent.keyDown(splitter, { key: "End" });
    expect(onResize).toHaveBeenLastCalledWith(0, -500);
  });
  it("UI 배율 (chrome 층 zoom) 안에서는 viewport px 끌기를 레이아웃 px 로 나눠 커서와 가장자리가 같이 간다", () => {
    vi.stubGlobal("PointerEvent", MouseEvent);
    const onResize = vi.fn();

    render(
      <PanelSplitter
        edge="right"
        label="Settings 패널 오른쪽 크기 조절"
        controls="panel-settings-content"
        value={320}
        minValue={200}
        maxValue={800}
        onResizeStart={vi.fn()}
        onResize={onResize}
        onResizeEnd={vi.fn()}
      />,
    );

    const splitter = screen.getByRole("separator");
    // UI 배율 L — `.panel-workspace { zoom: 1.2 }` 안의 손잡이 (jsdom 에는 currentCSSZoom 이 없다).
    Object.defineProperty(splitter, "currentCSSZoom", { value: 1.2 });

    dispatchPointer(splitter, "pointerdown", 100);
    dispatchPointer(window, "pointermove", 160);
    dispatchPointer(window, "pointerup", 160);
    expect(onResize).toHaveBeenLastCalledWith(50, 0);

    // 키보드 한 칸은 배율과 무관하게 레이아웃 1px 이다.
    splitter.focus();
    fireEvent.keyDown(splitter, { key: "ArrowRight" });
    expect(onResize).toHaveBeenLastCalledWith(1, 0);
  });
});

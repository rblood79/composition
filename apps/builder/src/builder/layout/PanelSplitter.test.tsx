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
        controls="panel-monitor-content"
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
});

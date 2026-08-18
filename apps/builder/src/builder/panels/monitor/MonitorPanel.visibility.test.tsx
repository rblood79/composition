// @vitest-environment jsdom

import { Activity } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MonitorPanel } from "./MonitorPanel";

type IdleCallback = (deadline: IdleDeadline) => void;
type FrameCallback = (time: number) => void;

class TrackedResizeObserver {
  static activeCount = 0;
  private observing = false;

  observe(): void {
    if (this.observing) return;
    this.observing = true;
    TrackedResizeObserver.activeCount += 1;
  }

  disconnect(): void {
    if (!this.observing) return;
    this.observing = false;
    TrackedResizeObserver.activeCount -= 1;
  }
}

function Fixture({ visible }: { visible: boolean }) {
  return (
    <Activity mode={visible ? "visible" : "hidden"}>
      <MonitorPanel />
    </Activity>
  );
}

describe("MonitorPanel Activity visibility lifecycle", () => {
  const idleCallbacks = new Map<number, IdleCallback>();
  const frameCallbacks = new Map<number, FrameCallback>();
  let nextIdleId = 1;
  let nextFrameId = 1;

  beforeEach(() => {
    vi.useFakeTimers();
    idleCallbacks.clear();
    frameCallbacks.clear();
    nextIdleId = 1;
    nextFrameId = 1;
    TrackedResizeObserver.activeCount = 0;

    vi.stubGlobal("ResizeObserver", TrackedResizeObserver);
    vi.stubGlobal("requestIdleCallback", (callback: IdleCallback) => {
      const id = nextIdleId++;
      idleCallbacks.set(id, callback);
      return id;
    });
    vi.stubGlobal("cancelIdleCallback", (id: number) => {
      idleCallbacks.delete(id);
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameCallback) => {
      const id = nextFrameId++;
      frameCallbacks.set(id, callback);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      frameCallbacks.delete(id);
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("stops chart/observer/poll callbacks while hidden and preserves the selected tab", async () => {
    const { rerender, unmount } = render(<Fixture visible={true} />);

    expect(TrackedResizeObserver.activeCount).toBeGreaterThan(0);
    expect(idleCallbacks.size).toBeGreaterThan(0);

    await act(async () => {
      const callbacks = [...idleCallbacks.values()];
      idleCallbacks.clear();
      callbacks.forEach((callback) =>
        callback({ didTimeout: false, timeRemaining: () => 50 }),
      );
    });
    expect(frameCallbacks.size).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("tab", { name: /Realtime/ }));
    expect(
      screen
        .getByRole("tab", { name: /Realtime/ })
        .getAttribute("aria-selected"),
    ).toBe("true");

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(idleCallbacks.size).toBeGreaterThan(0);

    rerender(<Fixture visible={false} />);
    await act(async () => undefined);

    expect(TrackedResizeObserver.activeCount).toBe(0);
    expect(idleCallbacks.size).toBe(0);
    expect(frameCallbacks.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);

    rerender(<Fixture visible={true} />);
    await act(async () => undefined);

    expect(
      screen
        .getByRole("tab", { name: /Realtime/ })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(TrackedResizeObserver.activeCount).toBeGreaterThan(0);
    expect(idleCallbacks.size).toBeGreaterThan(0);
    expect(frameCallbacks.size).toBeGreaterThan(0);
    unmount();
  });
});

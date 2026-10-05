import { cleanup, fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../components/ParticleBackground", () => ({
  useParticleBackground: () => ({
    vortexRef: {
      current: { active: false, x: 0, y: 0, strength: 0, radius: 0, height: 0 },
    },
    effectType: "sand",
    setEffectType: () => {},
  }),
}));
vi.mock("../components/ParticleButton", () => ({
  ParticleButton: ({ children }: { children?: unknown }) => (
    <button type="button">{children as never}</button>
  ),
}));

import App from "../App";

/**
 * 2026-10-05 감사 LOW — 회오리 interval 은 하나만 돈다 (mouseup 없이 다시 눌러도) · 언마운트
 * 때 멈춘다.
 */
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("App 회오리 interval", () => {
  it("mouseup 없이 두 번 눌러도 놓으면 interval 이 남지 않는다", () => {
    const view = render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    const main = view.container.querySelector("main")!;
    const base = vi.getTimerCount();
    fireEvent.mouseDown(main, { clientX: 10, clientY: 10 });
    fireEvent.mouseDown(main, { clientX: 20, clientY: 20 });
    fireEvent.mouseUp(main);
    expect(vi.getTimerCount()).toBe(base);
  });

  it("누른 채 언마운트하면 interval 이 멈춘다", () => {
    const view = render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    const main = view.container.querySelector("main")!;
    const base = vi.getTimerCount();
    fireEvent.mouseDown(main, { clientX: 10, clientY: 10 });
    expect(vi.getTimerCount()).toBe(base + 1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(base);
  });
});

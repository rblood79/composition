import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useActionBarClearance } from "../useActionBarClearance";

/**
 * 2026-10-05 감사 LOW — 토스트가 뜬 뒤에 바가 나타나거나 (선택) 다시 생겨도 (선택 전환으로 재마운트)
 * 그 바의 위치 변화 (드래그 · page anchor) 를 다시 잰다.
 */
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const newBar = () => {
  const bar = document.createElement("div");
  bar.className = "contextual-action-bar";
  document.body.appendChild(bar);
  return bar;
};

describe("useActionBarClearance — 바 재관찰", () => {
  it("나중에 나타난 바의 style 변화를 잰다", async () => {
    const raf = vi.spyOn(window, "requestAnimationFrame");
    const container = { current: document.createElement("div") };
    renderHook(() => useActionBarClearance(container, true));
    const bar = newBar();
    await flush();
    raf.mockClear();
    bar.style.transform = "translate3d(10px, 0, 0)";
    await flush();
    expect(raf).toHaveBeenCalled();
  });

  it("다시 생긴 바의 style 변화를 잰다", async () => {
    const raf = vi.spyOn(window, "requestAnimationFrame");
    const first = newBar();
    const container = { current: document.createElement("div") };
    renderHook(() => useActionBarClearance(container, true));
    first.remove();
    const second = newBar();
    await flush();
    raf.mockClear();
    second.style.transform = "translate3d(10px, 0, 0)";
    await flush();
    expect(raf).toHaveBeenCalled();
  });
});

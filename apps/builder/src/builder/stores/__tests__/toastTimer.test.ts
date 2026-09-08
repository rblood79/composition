/**
 * 토스트 자동 해제 타이머 — hover·focus 중 정지, 벗어나면 남은 시간으로 재개.
 *
 * Why: 되돌리기 버튼이 달린 토스트는 문구를 읽고 버튼까지 가야 한다. 읽는 동안
 * 사라지면 회복 수단 자체가 없어진다 (2026-09-08 사용자 지적).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useToastStore } from "../toast";

describe("toast 자동 해제 타이머", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.setState({ toasts: [], lastShownMap: new Map() });
  });

  afterEach(() => {
    useToastStore.getState().dismissAll();
    vi.useRealTimers();
  });

  const show = (duration: number): string =>
    useToastStore.getState().showToast("warning", "m", {
      duration,
      bypassCooldown: true,
    })!;

  it("duration 이 지나면 사라진다", () => {
    show(5000);
    vi.advanceTimersByTime(4999);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("정지 중에는 시간이 흘러도 사라지지 않는다", () => {
    const id = show(5000);
    vi.advanceTimersByTime(1000);
    useToastStore.getState().pauseToast(id);
    vi.advanceTimersByTime(60_000);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it("재개는 처음이 아니라 남은 시간부터 센다", () => {
    const id = show(5000);
    vi.advanceTimersByTime(4000);
    useToastStore.getState().pauseToast(id);
    vi.advanceTimersByTime(10_000);
    useToastStore.getState().resumeToast(id);
    vi.advanceTimersByTime(999);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("정지 상태가 아니면 재개는 타이머를 다시 걸지 않는다 (수명 연장 금지)", () => {
    const id = show(5000);
    vi.advanceTimersByTime(4000);
    useToastStore.getState().resumeToast(id);
    vi.advanceTimersByTime(1000);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("직접 닫으면 타이머도 함께 없어진다", () => {
    const id = show(5000);
    useToastStore.getState().dismissToast(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
    // 남은 타이머가 다른 토스트를 지우지 않는다
    show(5000);
    vi.advanceTimersByTime(4999);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });
});

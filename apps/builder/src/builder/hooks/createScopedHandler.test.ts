/**
 * ADR-249 §4-5 — scope 분기 핸들러 (copy · paste · delete) 는 실행 인자의 scope 를
 * `activeScope` 보다 먼저 본다. 전체 메뉴는 `canvas-focused` 를 넘기고, 키보드는
 * 인자를 넘기지 않아 종전과 같다.
 */
import { describe, expect, it, vi } from "vitest";
import { createScopedHandler } from "./useGlobalKeyboardShortcuts";

describe("createScopedHandler", () => {
  it("panel:events 상태여도 인자 canvas-focused 면 캔버스 핸들러", () => {
    const canvas = vi.fn();
    const events = vi.fn();
    const handler = createScopedHandler(canvas, events, "panel:events");

    handler({ scope: "canvas-focused" });
    expect(canvas).toHaveBeenCalledTimes(1);
    expect(events).not.toHaveBeenCalled();
  });

  it("인자가 없으면 activeScope 로 분기한다 (키보드 경로)", () => {
    const canvas = vi.fn();
    const events = vi.fn();

    createScopedHandler(canvas, events, "panel:events")();
    expect(events).toHaveBeenCalledTimes(1);

    createScopedHandler(canvas, events, "canvas-focused")();
    expect(canvas).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it, vi } from "vitest";
import { releaseWebGL } from "../canvasUtils";

/**
 * 2026-10-05 감사 LOW — 이펙트 전환 (sand → curl → …) 마다 새 WebGL context 를 만든다. 정리 때
 * pass (bloom · afterimage 의 render target) 와 context 자체를 놓지 않으면 브라우저 context 상한에
 * 닿아 가장 오래된 context 를 잃는다.
 */
describe("releaseWebGL", () => {
  it("pass 를 각각 dispose 하고 composer · renderer 를 놓은 뒤 context 를 잃게 한다", () => {
    const order: string[] = [];
    const passes = [
      { dispose: vi.fn(() => order.push("pass1")) },
      {},
      { dispose: vi.fn(() => order.push("pass3")) },
    ];
    const composer = { passes, dispose: vi.fn(() => order.push("composer")) };
    const renderer = {
      dispose: vi.fn(() => order.push("renderer")),
      forceContextLoss: vi.fn(() => order.push("contextLoss")),
    };
    releaseWebGL(renderer, composer);
    expect(order).toEqual([
      "pass1",
      "pass3",
      "composer",
      "renderer",
      "contextLoss",
    ]);
  });

  it("composer 없이도 context 를 놓는다", () => {
    const renderer = { dispose: vi.fn(), forceContextLoss: vi.fn() };
    releaseWebGL(renderer);
    expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1);
  });
});

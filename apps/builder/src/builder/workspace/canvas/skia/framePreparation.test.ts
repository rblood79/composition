import { describe, expect, it, vi } from "vitest";
import type { CanvasKit } from "canvaskit-wasm";
import { SkiaRenderer } from "./SkiaRenderer";
import type { TransitionManager } from "./transitionManager";

vi.mock("./createSurface", () => ({
  createGPUSurface: () => ({ getCanvas: () => ({}) }),
}));
const camera = { zoom: 1, panX: 0, panY: 0 };

function fixture() {
  const renderer = new SkiaRenderer(
    {} as CanvasKit,
    { getContext: () => null } as unknown as HTMLCanvasElement,
  );
  Object.assign(renderer, {
    contentNode: { renderSkia: vi.fn() },
    contentSurface: {},
    contentSnapshot: {},
    contentDirty: false,
    lastRegistryVersion: 1,
    lastOverlayVersion: 1,
    lastScreenOverlayVersion: 0,
    lastCamera: { ...camera },
  });
  return renderer;
}

describe("idle 준비 재사용 판정", () => {
  it("이미 제출한 동일 입력만 재사용하며 camera와 각 version 변경을 거부한다", () => {
    const r = fixture();
    expect(r.canReuseFramePreparation(1, camera, 1)).toBe(true);
    expect(r.canReuseFramePreparation(2, camera, 1)).toBe(false);
    expect(r.canReuseFramePreparation(1, camera, 2)).toBe(false);
    expect(r.canReuseFramePreparation(1, camera, 1, 1)).toBe(false);
    for (const next of [
      { ...camera, zoom: 2 },
      { ...camera, panX: 1 },
      { ...camera, panY: 1 },
    ])
      expect(r.canReuseFramePreparation(1, next, 1)).toBe(false);
  });
  it.each([
    "contentDirty",
    "needsCleanupRender",
    "disposed",
    "animationCleanupPending",
  ])("%s는 재사용을 막고 조회가 상태를 소비하지 않는다", (key) => {
    const r = fixture();
    Object.assign(r, { [key]: true });
    expect(r.canReuseFramePreparation(1, camera, 1)).toBe(false);
    expect(r.canReuseFramePreparation(1, camera, 1)).toBe(false);
  });
  it.each(["contentNode", "contentSurface", "contentSnapshot"])(
    "%s 부재와 single-surface fallback에서는 준비를 생략하지 않는다",
    (key) => {
      const r = fixture();
      Object.assign(r, { [key]: null });
      expect(r.canReuseFramePreparation(1, camera, 1)).toBe(false);
    },
  );
  it("조회는 animation을 tick하지 않고 render가 한 번 tick한 뒤 마지막 정리도 수행한다", () => {
    const r = fixture();
    let active = true;
    const tick = vi.fn(() => new Set<string>());
    r.transitionManager = {
      isActive: () => active,
      tick,
    } as unknown as TransitionManager;
    expect(r.canReuseFramePreparation(1, camera, 1)).toBe(false);
    expect(tick).not.toHaveBeenCalled();
    expect(r.render(new DOMRect(0, 0, 100, 100), 1, camera, 1)).toBe(false);
    expect(tick).toHaveBeenCalledTimes(1);
    active = false;
    expect(r.canReuseFramePreparation(1, camera, 1)).toBe(false);
    r.render(new DOMRect(0, 0, 100, 100), 1, camera, 1);
    expect(r.canReuseFramePreparation(1, camera, 1)).toBe(true);
    expect(tick).toHaveBeenCalledTimes(1);
  });
});

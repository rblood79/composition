import { describe, expect, it, vi } from "vitest";
import type { CanvasKit } from "canvaskit-wasm";

/**
 * ADR-273 Phase 2 (R5): renderer 의 소실 · 복원 순서. 소실 중의 resize (창 크기 변경) 는 surface 를 만들지
 * 않고, 복원 콜백 (`contextRestored`) 이 옛 surface 를 지운 뒤 소유자에게 새 surface 를 받는다.
 */
const owner = {
  awaiting: false,
  backend: "gpu" as "gpu" | "sw",
  getBackend: () => owner.backend,
  makeSurface: vi.fn(),
  contextLost: vi.fn(() => {
    owner.awaiting = true;
  }),
  contextRestored: vi.fn(() => {
    owner.awaiting = false;
  }),
  isAwaitingRestore: () => owner.awaiting,
  dispose: vi.fn(),
};
const surfaces: Array<{ deleted: boolean }> = [];
owner.makeSurface.mockImplementation(() => {
  const surface = {
    deleted: false,
    getCanvas: () => ({}),
    delete() {
      surface.deleted = true;
    },
    isDeleted: () => surface.deleted,
  };
  surfaces.push(surface);
  return surface;
});
vi.mock("../createSurface", () => ({
  CanvasSurfaceOwner: class {
    constructor() {
      return owner;
    }
  },
}));

const setImageBackend = vi.fn();
vi.mock("../imageCache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../imageCache")>()),
  setImageBackend: (backend: "gpu" | "sw" | null) => setImageBackend(backend),
}));

const { SkiaRenderer } = await import("../SkiaRenderer");

describe("ADR-273 Phase 2 — renderer 의 소실 · 복원", () => {
  it("소실 중 resize 는 surface 를 만들지 않고, 복원이 옛 surface 를 지운 뒤 새로 받는다", () => {
    const el = { getContext: () => null } as unknown as HTMLCanvasElement;
    const renderer = new SkiaRenderer({} as CanvasKit, el, 1);
    expect(owner.makeSurface).toHaveBeenCalledTimes(1);

    renderer.resize(el);
    expect(owner.makeSurface).toHaveBeenCalledTimes(2);
    expect(surfaces[0]!.deleted).toBe(true);

    renderer.contextLost();
    renderer.resize(el);
    renderer.resize(el);
    expect(owner.makeSurface).toHaveBeenCalledTimes(2);
    expect(surfaces[1]!.deleted).toBe(false);

    renderer.contextRestored(el);
    expect(owner.contextRestored).toHaveBeenCalledTimes(1);
    expect(owner.makeSurface).toHaveBeenCalledTimes(3);
    expect(surfaces[1]!.deleted).toBe(true);

    renderer.dispose();
    expect(owner.dispose).toHaveBeenCalledTimes(1);
    expect(surfaces[2]!.deleted).toBe(true);
  });

  it("ADR-270 Phase 3a — surface 를 만들 때마다 이미지 캐시에 surface 종류를 알린다 (복원이 SW 로 끝나면 sw)", () => {
    setImageBackend.mockClear();
    owner.backend = "gpu";
    const el = { getContext: () => null } as unknown as HTMLCanvasElement;
    const renderer = new SkiaRenderer({} as CanvasKit, el, 1);
    expect(setImageBackend).toHaveBeenLastCalledWith("gpu");
    renderer.contextLost();
    owner.backend = "sw";
    renderer.contextRestored(el);
    expect(setImageBackend).toHaveBeenLastCalledWith("sw");
    expect(setImageBackend).toHaveBeenCalledTimes(2);
    renderer.dispose();
  });
});

import { describe, expect, it, vi } from "vitest";
import type { CanvasKit } from "canvaskit-wasm";
import { CanvasSurfaceOwner } from "../createSurface";
import { GR_CACHE_LIMIT_BYTES } from "../canvasMemoryBudget";

/**
 * ADR-273 Phase 2 (G2 · R5): 화면 GL context 의 소유자. 가짜 CanvasKit 은 canvaskit 0.42.0 의 동작을 옮긴다 —
 * `GetWebGLContext` 는 호출마다 새 핸들, `MakeWebGLContext` 는 새 GrDirectContext, abandon 된 context 위의
 * `MakeOnScreenGLSurface` 는 null (Skia 가 GL 호출을 거부), JS 래퍼 `get…Bytes` 는 값을 돌려주지 않는다
 * (`return` 누락 — 원 메서드 `_get…Bytes` 만 값을 준다), Skia 기본 한도 256 MiB (실측).
 */
const SKIA_DEFAULT = 256 * 2 ** 20;

function fakeCanvasKit({ glAvailable = true } = {}) {
  const log: string[] = [];
  let nextHandle = 1;
  const live = new Set<number>();
  const contexts: Array<{
    handle: number;
    abandoned: boolean;
    deleted: boolean;
  }> = [];
  const ck = {
    GetWebGLContext: vi.fn(() => {
      if (!glAvailable) return 0;
      const handle = nextHandle++;
      live.add(handle);
      log.push(`gl+${handle}`);
      return handle;
    }),
    MakeWebGLContext: vi.fn((handle: number) => {
      const state = {
        handle,
        abandoned: false,
        deleted: false,
        limit: SKIA_DEFAULT,
      };
      contexts.push(state);
      return {
        getResourceCacheLimitBytes: () => undefined,
        getResourceCacheUsageBytes: () => undefined,
        _getResourceCacheLimitBytes: () => state.limit,
        _getResourceCacheUsageBytes: () => 1000,
        setResourceCacheLimitBytes: (bytes: number) => {
          state.limit = bytes;
        },
        releaseResourcesAndAbandonContext: () => {
          state.abandoned = true;
          log.push(`abandon${handle}`);
        },
        isDeleted: () => state.deleted,
        delete: () => {
          state.deleted = true;
          log.push(`gr-${handle}`);
        },
        state,
      };
    }),
    MakeOnScreenGLSurface: vi.fn(
      (
        gr: { state: { abandoned: boolean; deleted: boolean; handle: number } },
        w: number,
        h: number,
      ) => {
        if (
          gr.state.abandoned ||
          gr.state.deleted ||
          !live.has(gr.state.handle)
        )
          return null;
        log.push(`surface${gr.state.handle}:${w}x${h}`);
        return { kind: "gpu", handle: gr.state.handle };
      },
    ),
    MakeSWCanvasSurface: vi.fn(() => {
      log.push("sw");
      return { kind: "sw" };
    }),
    MakeWebGLCanvasSurface: vi.fn(() => ({ kind: "legacy" })),
    deleteContext: vi.fn((handle: number) => {
      live.delete(handle);
      log.push(`gl-${handle}`);
    }),
  };
  return { ck: ck as unknown as CanvasKit, raw: ck, log, contexts, live };
}

const canvas = (width = 800, height = 600) =>
  ({ width, height }) as HTMLCanvasElement;

describe("ADR-273 Phase 2 — GL context 소유 · 수명 · 한도", () => {
  it("한도 = GR_CACHE_LIMIT_BYTES (사용자 결정 2 · 384 MiB) · Skia 기본은 setter 전에 읽는다 · 래퍼가 undefined 여도 값을 읽는다", () => {
    expect(GR_CACHE_LIMIT_BYTES).toBe(384 * 2 ** 20);
    const { ck } = fakeCanvasKit();
    const owner = new CanvasSurfaceOwner(ck, canvas(), GR_CACHE_LIMIT_BYTES);
    owner.makeSurface();
    const stats = owner.stats();
    expect(stats.limitBytes).toBe(GR_CACHE_LIMIT_BYTES);
    expect(stats.defaultLimitBytes).toBe(SKIA_DEFAULT);
    expect(stats.usageBytes).toBe(1000);
    expect(stats).toMatchObject({
      backend: "gpu",
      liveContexts: 1,
      contextsCreated: 1,
      contextsDeleted: 0,
    });
  });

  it("resize 3 회 — 같은 GrDirectContext 위에 새 크기 surface, GL context 1 개", () => {
    const { ck, raw, live } = fakeCanvasKit();
    const el = canvas(800, 600);
    const owner = new CanvasSurfaceOwner(ck, el, GR_CACHE_LIMIT_BYTES);
    owner.makeSurface();
    for (const [w, h] of [
      [900, 600],
      [1000, 700],
      [1600, 1000],
    ]) {
      el.width = w;
      el.height = h;
      expect(owner.makeSurface(el)).toMatchObject({ kind: "gpu", handle: 1 });
    }
    expect(raw.GetWebGLContext).toHaveBeenCalledTimes(1);
    expect(raw.MakeWebGLContext).toHaveBeenCalledTimes(1);
    expect(raw.MakeOnScreenGLSurface).toHaveBeenLastCalledWith(
      expect.anything(),
      1600,
      1000,
      null,
    );
    expect(live.size).toBe(1);
    expect(owner.stats().contextsCreated).toBe(1);
  });

  it("소실 → (복원 전 resize 는 기다림) → 복원: 옛 GrDirectContext · 핸들을 먼저 지우고 새 context · 한도 재설정 · backend GPU", () => {
    const { ck, raw, log, live } = fakeCanvasKit();
    const el = canvas();
    const owner = new CanvasSurfaceOwner(ck, el, GR_CACHE_LIMIT_BYTES);
    owner.makeSurface();
    owner.contextLost();
    expect(owner.isAwaitingRestore()).toBe(true);
    expect(owner.stats().liveContexts).toBe(0);
    owner.contextRestored();
    log.length = 0;
    const surface = owner.makeSurface(el);
    expect(surface).toMatchObject({ kind: "gpu", handle: 2 });
    // 옛 핸들 삭제가 새 핸들보다 먼저 (emscripten deleteContext 가 canvas 의 최신 context 기록을 지운다).
    expect(log).toEqual(["gr-1", "gl-1", "gl+2", "surface2:800x600"]);
    expect(raw.deleteContext).toHaveBeenCalledTimes(1);
    expect(raw.MakeSWCanvasSurface).not.toHaveBeenCalled();
    expect(live).toEqual(new Set([2]));
    expect(owner.stats()).toMatchObject({
      backend: "gpu",
      liveContexts: 1,
      contextsCreated: 2,
      contextsDeleted: 1,
      limitBytes: GR_CACHE_LIMIT_BYTES,
    });
  });

  it("WebGL 미지원 (GetWebGLContext 0) — SW 폴백 · GrDirectContext 없음", () => {
    const { ck, raw } = fakeCanvasKit({ glAvailable: false });
    const owner = new CanvasSurfaceOwner(ck, canvas(), GR_CACHE_LIMIT_BYTES);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(owner.makeSurface()).toEqual({ kind: "sw" });
    warn.mockRestore();
    expect(raw.MakeWebGLContext).not.toHaveBeenCalled();
    expect(owner.stats()).toMatchObject({
      backend: "sw",
      liveContexts: 0,
      limitBytes: null,
    });
  });

  it("dispose — GrDirectContext 를 지우고 GL 핸들 해제", () => {
    const { ck, raw, live } = fakeCanvasKit();
    const owner = new CanvasSurfaceOwner(ck, canvas(), GR_CACHE_LIMIT_BYTES);
    owner.makeSurface();
    owner.dispose();
    expect(raw.deleteContext).toHaveBeenCalledWith(1);
    expect(live.size).toBe(0);
    expect(owner.stats()).toMatchObject({
      liveContexts: 0,
      contextsDeleted: 1,
    });
  });
});

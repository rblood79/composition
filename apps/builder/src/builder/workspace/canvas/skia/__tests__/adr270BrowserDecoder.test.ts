import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ADR-270 Phase 3a (G1-b · G3): 디코딩 = 브라우저 코덱 (`createImageBitmap`, 메인 밖). 가짜 CanvasKit 은
 * 세 생성 API 의 호출만 센다 — GPU surface 는 texture-backed (`MakeLazyImageFromTextureSource`, bitmap 은
 * generator 가 쥐고 context 마다 다시 올린다 → 닫지 않는다), SW surface 는 readback
 * (`MakeImageFromCanvasImageSource`, bitmap 을 닫는다), surface 를 모르거나 `createImageBitmap` 이 없으면
 * 옛 `MakeImageFromEncoded`.
 */
const image = () => ({
  width: () => 4,
  height: () => 2,
  delete: vi.fn(),
  isDeleted: () => false,
});
const ck = {
  ColorType: { RGBA_8888: "rgba8888" },
  AlphaType: { Premul: "premul", Unpremul: "unpremul" },
  ColorSpace: { SRGB: "srgb" },
  MakeImageFromEncoded: vi.fn(() => image()),
  MakeLazyImageFromTextureSource: vi.fn(() => image()),
  MakeImageFromCanvasImageSource: vi.fn(() => image()),
};
vi.mock("../initCanvasKit", () => ({
  isCanvasKitInitialized: () => true,
  initCanvasKit: async () => {},
  getCanvasKit: () => ck,
}));
vi.mock("../disposable", () => ({ registerSkiaCacheDestroy: () => {} }));

const { clearImageCache, loadSkImage, setImageBackend } =
  await import("../imageCache");
const { renderDebug } = await import("../renderCounters");

const bitmaps: Array<{ width: number; height: number; close: () => void }> = [];
const createImageBitmapMock = vi.fn(async () => {
  const bitmap = { width: 4, height: 2, close: vi.fn() };
  bitmaps.push(bitmap);
  return bitmap;
});

let n = 0;
const nextUrl = () => `https://example.test/${n++}.png`;

describe("ADR-270 Phase 3a — 브라우저 코덱 디코딩", () => {
  beforeEach(() => {
    bitmaps.length = 0;
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        blob: async () => new Blob([new Uint8Array(8)]),
        arrayBuffer: async () => new ArrayBuffer(8),
      })),
    );
    vi.stubGlobal("createImageBitmap", createImageBitmapMock);
  });
  afterEach(() => {
    setImageBackend(null);
    renderDebug.imageDecoderLegacy = false;
    clearImageCache();
    vi.unstubAllGlobals();
  });

  it("GPU surface — createImageBitmap (unpremul) → texture-backed 1 · MakeImageFromEncoded 0 · close 0", async () => {
    setImageBackend("gpu");
    expect(await loadSkImage(nextUrl())).not.toBeNull();
    expect(createImageBitmapMock).toHaveBeenCalledWith(expect.any(Blob), {
      premultiplyAlpha: "none",
      colorSpaceConversion: "default",
    });
    expect(ck.MakeLazyImageFromTextureSource).toHaveBeenCalledTimes(1);
    expect(ck.MakeLazyImageFromTextureSource).toHaveBeenCalledWith(
      bitmaps[0],
      {
        width: 4,
        height: 2,
        colorType: "rgba8888",
        alphaType: "unpremul",
        colorSpace: "srgb",
      },
      false,
    );
    expect(ck.MakeImageFromEncoded).not.toHaveBeenCalled();
    expect(ck.MakeImageFromCanvasImageSource).not.toHaveBeenCalled();
    expect(bitmaps[0]!.close).not.toHaveBeenCalled();
  });

  it("SW surface — readback 1 · bitmap 을 닫는다 · texture 0", async () => {
    setImageBackend("sw");
    expect(await loadSkImage(nextUrl())).not.toBeNull();
    expect(ck.MakeImageFromCanvasImageSource).toHaveBeenCalledWith(bitmaps[0]);
    expect(bitmaps[0]!.close).toHaveBeenCalledTimes(1);
    expect(ck.MakeLazyImageFromTextureSource).not.toHaveBeenCalled();
    expect(ck.MakeImageFromEncoded).not.toHaveBeenCalled();
  });

  it("surface 를 아직 모르면 (renderer 전) · createImageBitmap 이 없으면 · 옛 디코더 플래그면 MakeImageFromEncoded", async () => {
    await loadSkImage(nextUrl());
    setImageBackend("gpu");
    vi.stubGlobal("createImageBitmap", undefined);
    await loadSkImage(nextUrl());
    vi.stubGlobal("createImageBitmap", createImageBitmapMock);
    // 옛 디코더 스위치는 dev 전용 (live 픽셀 대조의 arm).
    vi.stubEnv("NODE_ENV", "development");
    renderDebug.imageDecoderLegacy = true;
    await loadSkImage(nextUrl());
    vi.unstubAllEnvs();
    expect(ck.MakeImageFromEncoded).toHaveBeenCalledTimes(3);
    expect(createImageBitmapMock).not.toHaveBeenCalled();
    expect(ck.MakeLazyImageFromTextureSource).not.toHaveBeenCalled();
  });

  it("디코딩 실패 (createImageBitmap reject) — null · 캐시에 남지 않아 다음 조회가 다시 요청한다", async () => {
    setImageBackend("gpu");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    createImageBitmapMock.mockRejectedValueOnce(new Error("InvalidStateError"));
    const url = nextUrl();
    expect(await loadSkImage(url)).toBeNull();
    expect(await loadSkImage(url)).not.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});

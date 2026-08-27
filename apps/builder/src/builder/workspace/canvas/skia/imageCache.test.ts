import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * imageCache LRU 퇴거 계약.
 *
 * SkImage 는 `SkiaNodeData.image.skImage` 에 **핸들로 저장**돼 다음 프레임에도
 * 그려진다 (buildImageNodeData / specShapeConverter). 그래서 캐시 상한은
 * "미참조 풀" 에 대한 정책이어야 하고, 참조 중인 이미지를 강제 퇴거하면
 * 삭제된 핸들에 `.width()` 를 부르는 순간 WASM 이 크래시한다.
 *
 * 구 구현은 미참조 후보가 없을 때 가장 오래된 엔트리를 강제 퇴거했고,
 * `releaseSkImage` 가 refCount 0 에서 즉시 폐기했기 때문에 후보 풀이 항상
 * 비어 있었다 — 서로 다른 이미지 100개를 넘긴 문서에서는 새 이미지를 로드할
 * 때마다 살아 있는 이미지가 하나씩 파괴됐다.
 */

interface MockImage {
  width(): number;
  height(): number;
  delete: ReturnType<typeof vi.fn>;
  isDeleted(): boolean;
}

const createdImages: MockImage[] = [];
let canvasKitInitialized = true;
let initCanvasKitBehavior = async (): Promise<void> => {
  canvasKitInitialized = true;
};
const initCanvasKitMock = vi.fn(() => initCanvasKitBehavior());

function makeImage(): MockImage {
  const deleteFn = vi.fn();
  const image: MockImage = {
    width: () => 10,
    height: () => 10,
    delete: deleteFn,
    isDeleted: () => deleteFn.mock.calls.length > 0,
  };
  createdImages.push(image);
  return image;
}

vi.mock("./initCanvasKit", () => ({
  isCanvasKitInitialized: () => canvasKitInitialized,
  initCanvasKit: initCanvasKitMock,
  getCanvasKit: () => ({
    MakeImageFromEncoded: () => makeImage(),
  }),
}));

vi.mock("./disposable", () => ({
  registerSkiaCacheDestroy: () => {},
}));

const {
  clearImageCache,
  getImageCacheSize,
  getSkImage,
  loadSkImage,
  releaseSkImage,
} = await import("./imageCache");
const { drainPendingWasmDisposals, getPendingWasmDisposalCount } =
  await import("./deferredDisposal");

/** MAX_CACHE_SIZE (모듈 내부 상수) 와 같은 값 */
const MAX_CACHE_SIZE = 100;

async function loadUrls(count: number, offset = 0): Promise<void> {
  for (let i = offset; i < offset + count; i++) {
    await loadSkImage(`https://example.test/${i}.png`);
  }
}

describe("imageCache LRU 퇴거", () => {
  beforeEach(() => {
    createdImages.length = 0;
    canvasKitInitialized = true;
    initCanvasKitBehavior = async () => {
      canvasKitInitialized = true;
    };
    initCanvasKitMock.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      })),
    );
  });

  afterEach(() => {
    clearImageCache();
    vi.unstubAllGlobals();
  });

  it("참조 중인 이미지는 상한을 넘겨도 퇴거하지 않는다", async () => {
    await loadUrls(MAX_CACHE_SIZE + 1);
    drainPendingWasmDisposals();

    // loadSkImage 는 refCount 1 로 획득한다 — 아무도 release 하지 않았다
    expect(createdImages.some((img) => img.delete.mock.calls.length > 0)).toBe(
      false,
    );
    expect(getImageCacheSize()).toBe(MAX_CACHE_SIZE + 1);
    expect(getSkImage("https://example.test/0.png")).not.toBeNull();
  });

  it("CanvasKit 초기화 전 요청도 준비 완료 후 최초 decode를 이어간다", async () => {
    canvasKitInitialized = false;

    await loadSkImage("https://example.test/early.png");

    expect(initCanvasKitMock).toHaveBeenCalledTimes(1);
    expect(getSkImage("https://example.test/early.png")).not.toBeNull();
  });

  it("CanvasKit 초기화 실패는 rejection 대신 null 계약을 유지한다", async () => {
    canvasKitInitialized = false;
    initCanvasKitBehavior = async () => {
      throw new Error("init failed");
    };

    await expect(
      loadSkImage("https://example.test/init-failure.png"),
    ).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("초기화 대기 중 cache clear가 발생하면 stale 요청을 폐기한다", async () => {
    canvasKitInitialized = false;
    let resolveInit: () => void = () => {
      throw new Error("init resolver was not installed");
    };
    initCanvasKitBehavior = () =>
      new Promise<void>((resolve) => {
        resolveInit = () => {
          canvasKitInitialized = true;
          resolve();
        };
      });

    const loading = loadSkImage("https://example.test/stale-init.png");
    expect(initCanvasKitMock).toHaveBeenCalledTimes(1);

    clearImageCache();
    resolveInit();

    await expect(loading).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(getImageCacheSize()).toBe(0);
  });

  it("release 한 엔트리는 캐시에 남되 퇴거 후보가 된다", async () => {
    await loadUrls(MAX_CACHE_SIZE);
    releaseSkImage("https://example.test/0.png");

    // 즉시 폐기하지 않는다 — 후보 풀이 비면 강제 퇴거 경로로 떨어지기 때문
    expect(getSkImage("https://example.test/0.png")).not.toBeNull();
    expect(getImageCacheSize()).toBe(MAX_CACHE_SIZE);

    await loadUrls(1, MAX_CACHE_SIZE);

    expect(getSkImage("https://example.test/0.png")).toBeNull();
    expect(getSkImage("https://example.test/1.png")).not.toBeNull();
    expect(getImageCacheSize()).toBe(MAX_CACHE_SIZE);
  });

  it("퇴거 시 delete 는 프레임 flush 뒤로 미룬다", async () => {
    await loadUrls(MAX_CACHE_SIZE);
    releaseSkImage("https://example.test/0.png");
    drainPendingWasmDisposals();

    const evicted = createdImages[0];
    await loadUrls(1, MAX_CACHE_SIZE);

    // 이미 draw 로 제출된 SkImage 를 flush 전에 파괴하면 그 draw 가 소실된다
    expect(evicted.delete).not.toHaveBeenCalled();
    expect(getPendingWasmDisposalCount()).toBeGreaterThan(0);

    drainPendingWasmDisposals();
    expect(evicted.delete).toHaveBeenCalledTimes(1);
  });
});

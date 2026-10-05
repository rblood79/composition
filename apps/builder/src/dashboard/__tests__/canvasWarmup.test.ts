import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fontCache from "../../builder/workspace/canvas/skia/fontCache";
import { awaitWarmup, registerWarmup } from "../../canvasWarmup/warmupRegistry";
import { startCanvasWarmup, type CanvasWarmupDeps } from "../canvasWarmup";

/**
 * ADR-244 A — 미리 받기: wasm 먼저 · 폰트는 wasm 뒤 · IndexedDB 에 있는 폰트는 받지 않음 · 실패는 조용히.
 */
const CK = "/composition/assets/canvaskit-x.wasm";
const ENGINE = "/composition/assets/engine_bg-x.wasm";
const PRETENDARD = "/composition/fonts/PretendardVariable.ttf";
const INTER = "/composition/fonts/InterVariable.ttf";

let requested: string[];
let pending: Map<string, () => void>;

function deps(overrides: Partial<CanvasWarmupDeps> = {}): CanvasWarmupDeps {
  return {
    wasmUrls: [CK, ENGINE],
    fonts: [
      { family: "Pretendard", url: PRETENDARD },
      { family: "Inter", url: INTER },
    ],
    register: registerWarmup,
    fontCache,
    ...overrides,
  };
}

/** fetch 는 응답을 붙잡아 두고 `release(url)` 로 끝낸다. */
function release(url: string) {
  pending.get(url)?.();
}

const flush = () => new Promise((r) => setTimeout(r, 0));

async function storeFont(family: string, url: string) {
  const db = await fontCache.openFontCacheDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(fontCache.FONT_CACHE_STORE, "readwrite");
    tx.objectStore(fontCache.FONT_CACHE_STORE).put({
      family: fontCache.fontCacheKey(family),
      url,
      buffer: new ArrayBuffer(4),
      timestamp: 0,
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

beforeEach(() => {
  (globalThis as { indexedDB?: IDBFactory }).indexedDB = new IDBFactory();
  requested = [];
  pending = new Map();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requested.push(url);
      await new Promise<void>((resolve) => pending.set(url, resolve));
      return new Response("bytes");
    }),
  );
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>)
    .__composition_CANVAS_WARMUP__;
  vi.unstubAllGlobals();
});

describe("startCanvasWarmup", () => {
  it("wasm 둘을 먼저 받고, 폰트는 wasm 이 끝난 뒤 받는다", async () => {
    startCanvasWarmup(deps());
    await flush();
    expect(requested).toEqual([CK, ENGINE]);

    release(CK);
    await flush();
    expect(requested).toEqual([CK, ENGINE]);

    release(ENGINE);
    await vi.waitFor(() =>
      expect(requested).toEqual([CK, ENGINE, PRETENDARD, INTER]),
    );
  });

  it("IndexedDB 에 같은 URL 로 있는 폰트는 받지 않고, 그 항목은 wasm 을 기다리지 않는다", async () => {
    await storeFont("Pretendard", PRETENDARD);
    startCanvasWarmup(deps());
    // wasm 이 진행 중이어도 폰트 소비자는 바로 진행한다.
    await expect(awaitWarmup(PRETENDARD, 1_000)).resolves.toBeUndefined();
    release(CK);
    release(ENGINE);
    await vi.waitFor(() => expect(requested).toContain(INTER));
    expect(requested).not.toContain(PRETENDARD);
  });

  it("IndexedDB 의 폰트 URL 이 다르면 (빌더가 다시 받는다) 미리 받는다", async () => {
    await storeFont("Pretendard", "/old/PretendardVariable.ttf");
    startCanvasWarmup(deps());
    await flush();
    release(CK);
    release(ENGINE);
    await vi.waitFor(() => expect(requested).toContain(PRETENDARD));
  });

  it("IndexedDB 를 열 수 없으면 폰트를 받지 않는다", async () => {
    startCanvasWarmup(
      deps({
        fontCache: {
          ...fontCache,
          openFontCacheDb: () => Promise.reject(new Error("blocked")),
        },
      }),
    );
    await flush();
    release(CK);
    release(ENGINE);
    await expect(awaitWarmup(PRETENDARD, 1_000)).resolves.toBeUndefined();
    await expect(awaitWarmup(INTER, 1_000)).resolves.toBeUndefined();
    expect(requested).toEqual([CK, ENGINE]);
  });

  it("받기 실패는 조용히 끝나고 소비자의 기다림도 끝난다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network");
      }),
    );
    startCanvasWarmup(deps({ fonts: [] }));
    await expect(awaitWarmup(CK, 1_000)).resolves.toBeUndefined();
    await expect(awaitWarmup(ENGINE, 1_000)).resolves.toBeUndefined();
  });

  it("두 번 불러도 자산마다 한 번만 받는다", async () => {
    startCanvasWarmup(deps({ fonts: [] }));
    startCanvasWarmup(deps({ fonts: [] }));
    await flush();
    expect(requested).toEqual([CK, ENGINE]);
  });
});

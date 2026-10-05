/**
 * ADR-244 A — dashboard 에서 builder 부팅 자산을 미리 받는다 (lazy chunk, `canvasWarmupTrigger.ts` 가 부른다).
 *
 * CanvasKit wasm · engine wasm · 내장 폰트 ttf 를 `fetch` 로 끝까지 흘려 HTTP 캐시에 둔다 (메모리 보관 0).
 * 로더에 미리 컴파일한 모듈을 넘길 수 없어 (CanvasKit glue 에 주입 지점이 없다) 같은 URL 의 캐시를
 * 거치는 것이 유일한 경로다. JS 는 미리 `import()` 하지 않는다 — 실패한 module fetch 는 문서 module map
 * 에 남아 builder 의 같은 chunk 까지 막는다.
 *
 * 런타임 import 가 없다 (`import type` 만 — `canvasWarmup.static.test.ts`). URL · registry · 폰트 캐시
 * 규칙은 initial 에 이미 있는 모듈을 호출자가 넘긴다: 이 chunk 가 그 모듈을 import 하면 번들러가 공유
 * chunk 로 쪼개 initial 요청 · 크기가 늘고, 로더 · builder chunk 를 import 할 여지도 없어진다.
 */
import type * as FontCache from "../builder/workspace/canvas/skia/fontCache";
import type { FontCacheEntry } from "../builder/workspace/canvas/skia/fontCache";
import type { registerWarmup } from "../canvasWarmup/warmupRegistry";

export interface CanvasWarmupDeps {
  /** builder 부팅이 받는 wasm (CanvasKit · engine). */
  readonly wasmUrls: readonly string[];
  /** builder 부팅이 CanvasKit 에 싣는 내장 폰트. */
  readonly fonts: ReadonlyArray<{ family: string; url: string }>;
  readonly register: typeof registerWarmup;
  readonly fontCache: Pick<
    typeof FontCache,
    "FONT_CACHE_STORE" | "fontCacheKey" | "isFontCacheHit" | "openFontCacheDb"
  >;
}

/** 응답 본문을 끝까지 받아 버린다 — HTTP 캐시에 남는 것이 목적. */
async function drain(url: string): Promise<void> {
  // 로더와 같은 요청 모드 (CanvasKit `credentials: "same-origin"`, engine · 폰트 기본값과 같다).
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    return;
  }
  await response.body.pipeTo(new WritableStream());
}

/**
 * 폰트가 IndexedDB 캐시에 있으면 true — builder 가 네트워크를 타지 않으므로 받지 않는다.
 * IDB 를 열 수 없으면 true (받지 않는 안전한 쪽).
 */
async function fontCached(
  cache: CanvasWarmupDeps["fontCache"],
  family: string,
  url: string,
): Promise<boolean> {
  try {
    const db = await cache.openFontCacheDb();
    try {
      const entry = await new Promise<FontCacheEntry | undefined>(
        (resolve, reject) => {
          const request = db
            .transaction(cache.FONT_CACHE_STORE, "readonly")
            .objectStore(cache.FONT_CACHE_STORE)
            .get(cache.fontCacheKey(family));
          request.onsuccess = () =>
            resolve(request.result as FontCacheEntry | undefined);
          request.onerror = () => reject(request.error);
        },
      );
      return cache.isFontCacheHit(entry, url);
    } finally {
      db.close();
    }
  } catch {
    return true;
  }
}

/**
 * 받기를 시작한다 (이미 등록된 자산은 다시 받지 않는다). wasm 을 먼저 받고 폰트는 wasm 이 끝난 뒤 —
 * builder 부팅과 같은 순서라, 받는 중에 들어와도 부팅이 먼저 필요한 자산이 대역폭을 먼저 쓴다.
 * 폰트 항목은 처음부터 등록한다 (그 사이 부팅이 같은 폰트를 따로 받지 않게).
 */
export function startCanvasWarmup(deps: CanvasWarmupDeps): void {
  const wasm = deps.wasmUrls.map((url) => deps.register(url, () => drain(url)));
  for (const { family, url } of deps.fonts) {
    deps.register(url, async () => {
      if (await fontCached(deps.fontCache, family, url)) return;
      await Promise.all(wasm);
      await drain(url);
    });
  }
}

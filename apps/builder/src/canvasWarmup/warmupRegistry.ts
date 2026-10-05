/**
 * ADR-244 A — 미리 받기 진행 상태 (자산별).
 *
 * dashboard 의 미리 받기 (`dashboard/canvasWarmup.ts`, lazy) 가 자산 URL 마다 받기 promise 를 여기에
 * 등록하고, builder 부팅의 소비자 (CanvasKit · engine · 폰트 로더) 는 **자기 URL 의 항목만** 기다린 뒤
 * 같은 URL 을 요청한다 — 받기가 끝난 응답은 HTTP 캐시에서 나오고, 진행 중인 받기와 겹쳐 같은 자산을
 * 두 번 받지 않는다. 다른 자산의 받기는 기다리지 않는다 (리뷰 244 R3 h1). 전체를 묶은 promise 는 없다.
 *
 * 모듈 상태가 아니라 window 전역에 둔다 (`initCanvasKit.ts` 의 전역 키 관례) — HMR 로 모듈이 다시
 * 실행돼도 진행 중인 받기를 잃지 않는다. 이 모듈은 initial 에 있으므로 작게 유지한다.
 */

const WARMUP_KEY = "__composition_CANVAS_WARMUP__";

declare global {
  interface Window {
    [WARMUP_KEY]?: Map<string, Promise<void>>;
  }
}

/** 소비자가 기다리는 상한 — 넘으면 자기 경로로 받는다 (느린 미리 받기가 부팅을 막지 않는다). */
export const WARMUP_WAIT_LIMIT_MS = 10_000;

function entries(): Map<string, Promise<void>> | undefined {
  return typeof window === "undefined" ? undefined : window[WARMUP_KEY];
}

/** 상대 경로 (`/composition/fonts/...`) 와 절대 URL 이 같은 항목을 가리키게 한다. */
export function warmupKey(url: string): string {
  return new URL(url, document.baseURI).href;
}

/**
 * 받기를 등록하고 그 항목을 돌려준다. 이미 있으면 기존 항목을 그대로 돌려준다 (`fetching` 은 부르지
 * 않는다) — 한 자산은 한 번만 받는다. `fetching` 은 실패해도 된다 (항목은 언제나 이행한다).
 */
export function registerWarmup(
  url: string,
  fetching: () => Promise<unknown>,
): Promise<void> {
  const map = (window[WARMUP_KEY] ??= new Map());
  const key = warmupKey(url);
  const existing = map.get(key);
  if (existing) return existing;
  const entry = Promise.resolve()
    .then(fetching)
    .then(
      () => undefined,
      () => undefined,
    );
  map.set(key, entry);
  return entry;
}

/**
 * `url` 의 미리 받기가 진행 중이면 끝날 때까지 (상한 `limitMs`) 기다린다. 항목이 없으면 바로 끝난다.
 * 실패하지 않는다 — 소비자는 이어서 언제나 자기 경로로 요청한다.
 */
export async function awaitWarmup(
  url: string,
  limitMs = WARMUP_WAIT_LIMIT_MS,
): Promise<void> {
  const pending = entries()?.get(warmupKey(url));
  if (!pending) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    pending,
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, limitMs);
    }),
  ]);
  clearTimeout(timer);
}

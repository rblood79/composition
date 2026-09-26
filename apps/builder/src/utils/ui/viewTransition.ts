/**
 * 화면 전환 (로그인 → 프로젝트 목록 → 빌더) 을 View Transition 으로 감싼다.
 *
 * `BrowserRouter` 는 경로 갱신을 `React.startTransition` 으로 돌린다 — 그래서 `flushSync` 로는
 * 새 화면이 전환 콜백 안에 그려지지 않고 옛 화면이 두 번 찍혔다 (2026-09-27 live, Chromium ·
 * WebKit 둘 다). react-router 의 `viewTransition` 옵션도 data router 전용이다. 전환 콜백이
 * 라우트 commit 신호 (`notifyRouteCommitted`, AppLayout 의 layout effect) 를 기다린다.
 *
 * 지원하지 않는 브라우저 · reduced motion 에서는 그냥 갱신한다. 캔버스 편집 중 입력 경로에는
 * 쓰지 않는다 — 전환 동안 페이지 위에 전환 layer 가 덮여 포인터를 받는다.
 */

/** 새 경로 commit 을 이보다 오래 기다리지 않는다 — 넘으면 그 시점 화면으로 전환한다. */
const ROUTE_COMMIT_TIMEOUT_MS = 1500;

let waiters: Array<() => void> = [];

/** 라우트가 새 location 으로 commit 됐다 — AppLayout 의 layout effect 가 부른다. */
export function notifyRouteCommitted(): void {
  const pending = waiters;
  waiters = [];
  for (const resolve of pending) resolve();
}

function waitForRouteCommit(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      waiters = waiters.filter((waiter) => waiter !== done);
      resolve();
    };
    const timer = setTimeout(done, ROUTE_COMMIT_TIMEOUT_MS);
    waiters.push(done);
  });
}

export function navigateWithTransition(update: () => void): void {
  const doc = document as Document & {
    startViewTransition?: (callback: () => Promise<void>) => unknown;
  };
  const reduced =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (typeof doc.startViewTransition !== "function" || reduced) {
    update();
    return;
  }
  doc.startViewTransition(async () => {
    const committed = waitForRouteCommit();
    update();
    await committed;
  });
}

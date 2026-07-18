/**
 * scheduleTask - 우선순위 기반 태스크 스케줄링 유틸리티
 *
 * 🚀 Phase 4.3: Store 업데이트 분할
 * - scheduler.postTask API 우선 사용 (Chromium 기반)
 * - 폴백: requestIdleCallback → setTimeout
 *
 * 우선순위:
 * - 'user-blocking': 사용자 입력 반응 (캔버스 선택)
 * - 'user-visible': 화면 업데이트 (선택 표시)
 * - 'background': 낮은 우선순위 (인스펙터 hydration)
 */

type TaskPriority = "user-blocking" | "user-visible" | "background";

interface SchedulerPostTaskOptions {
  priority?: TaskPriority;
  signal?: AbortSignal;
}

interface Scheduler {
  postTask: <T>(
    callback: () => T,
    options?: SchedulerPostTaskOptions,
  ) => Promise<T>;
  yield: (options?: { priority?: TaskPriority }) => Promise<void>;
}

declare global {
  interface Window {
    scheduler?: Scheduler;
  }
}

/**
 * 낮은 우선순위로 태스크 스케줄링
 * - scheduler.postTask('background') 우선
 * - 폴백: requestIdleCallback → setTimeout
 */
export function scheduleBackgroundTask(
  callback: () => void,
  options?: { timeout?: number },
): number | void {
  const timeout = options?.timeout ?? 100;

  // 1. scheduler.postTask API (Chromium 94+)
  if (typeof window !== "undefined" && window.scheduler?.postTask) {
    window.scheduler.postTask(callback, { priority: "background" });
    return;
  }

  // 2. requestIdleCallback (대부분의 브라우저)
  if (typeof requestIdleCallback !== "undefined") {
    return requestIdleCallback(
      (deadline) => {
        // 최소 시간 보장 또는 timeout 만료 시 실행
        if (deadline.timeRemaining() > 0 || deadline.didTimeout) {
          callback();
        }
      },
      { timeout },
    );
  }

  // 3. setTimeout 폴백
  return window.setTimeout(callback, 0);
}

/**
 * 사용자 가시 우선순위로 태스크 스케줄링
 * - scheduler.postTask('user-visible') 우선
 * - 폴백: queueMicrotask → Promise.resolve
 */
export function scheduleVisibleTask(callback: () => void): void {
  // 1. scheduler.postTask API
  if (typeof window !== "undefined" && window.scheduler?.postTask) {
    window.scheduler.postTask(callback, { priority: "user-visible" });
    return;
  }

  // 2. queueMicrotask (동기 작업 직후)
  if (typeof queueMicrotask !== "undefined") {
    queueMicrotask(callback);
    return;
  }

  // 3. Promise 폴백
  Promise.resolve().then(callback);
}

/**
 * 다음 프레임에 태스크 스케줄링
 * - requestAnimationFrame 래퍼
 */
export function scheduleNextFrame(callback: () => void): number {
  if (typeof requestAnimationFrame !== "undefined") {
    return requestAnimationFrame(callback);
  }
  return window.setTimeout(callback, 16);
}

/**
 * 프레임 정렬 스케줄이되 hidden/background 탭에서도 발화하도록 보강한 스케줄러.
 *
 * - 문서가 visible: `requestAnimationFrame` (프레임 배칭 유지 — focused 탭 hot path 무변경)
 * - 문서가 hidden: `setTimeout` (rAF 는 background 탭에서 발화하지 않아 여기에 예약된 작업이
 *   탭 refocus/reload 전까지 정체됨 — hidden 탭에서 preview 를 읽는 parity 자동화가 그
 *   정체로 stale 을 관측)
 *
 * 스케줄러 종류와 무관하게 취소하는 함수를 반환한다.
 */
export function scheduleFrameOrTimeout(callback: () => void): () => void {
  if (typeof document !== "undefined" && document.hidden) {
    const id = window.setTimeout(callback, 0);
    return () => window.clearTimeout(id);
  }
  if (typeof requestAnimationFrame !== "undefined") {
    const id = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(id);
  }
  const id = window.setTimeout(callback, 16);
  return () => window.clearTimeout(id);
}

/**
 * 브라우저에 제어권 양보 (Long Task 분할용)
 * - scheduler.yield() 우선
 * - 폴백: setTimeout(0)으로 매크로태스크 분리
 */
export async function yieldToMain(): Promise<void> {
  // 1. scheduler.yield API (실험적)
  if (typeof window !== "undefined" && window.scheduler?.yield) {
    return window.scheduler.yield();
  }

  // 2. setTimeout 폴백 (매크로태스크로 분리)
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * 취소 가능한 백그라운드 태스크
 */
export function scheduleCancelableBackgroundTask(
  callback: () => void,
  options?: { timeout?: number },
): () => void {
  let cancelled = false;

  const wrappedCallback = () => {
    if (!cancelled) {
      callback();
    }
  };

  const taskId = scheduleBackgroundTask(wrappedCallback, options);

  return () => {
    cancelled = true;
    if (typeof taskId === "number") {
      if (typeof cancelIdleCallback !== "undefined") {
        cancelIdleCallback(taskId);
      } else {
        clearTimeout(taskId);
      }
    }
  };
}

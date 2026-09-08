/**
 * Global Toast Store
 *
 * Zustand 기반 글로벌 Toast 상태 관리
 * - React 훅 없이 어디서든 호출 가능 (store actions에서도 사용 가능)
 * - Action 버튼 지원 (Undo 등)
 * - 5분 쿨다운으로 중복 알림 방지
 */

import { create } from "zustand";

export type ToastType = "success" | "warning" | "error" | "info";

export interface ToastAction {
  label: string;
  /**
   * 라벨의 카탈로그 키 — 있으면 렌더 시점에 해소한다.
   *
   * store action 처럼 훅을 못 쓰는 자리에서 온 토스트를 위한 채널이다. 문구를
   * 여기서 굳히면 토스트가 떠 있는 동안 언어를 바꿔도 직전 언어가 남는다.
   */
  labelKey?: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  type: ToastType;
  /** 해소된 문구. `messageKey` 가 있으면 렌더는 그쪽을 쓴다. */
  message: string;
  /** 문구의 카탈로그 키 — 훅을 못 쓰는 호출부용 (ToastAction.labelKey 와 같은 이유). */
  messageKey?: string;
  messageParams?: Record<string, string | number | boolean>;
  duration: number;
  action?: ToastAction;
}

interface ToastState {
  toasts: Toast[];
  lastShownMap: Map<string, number>;
}

interface ToastActions {
  /**
   * Toast 표시
   * @param type Toast 타입
   * @param message 메시지
   * @param options 옵션 (duration, action)
   * @returns Toast ID 또는 null (쿨다운 중인 경우)
   */
  showToast: (
    type: ToastType,
    message: string,
    options?: {
      duration?: number;
      action?: ToastAction;
      /** 쿨다운 무시 (Undo 등 중요한 액션용) */
      bypassCooldown?: boolean;
      messageKey?: string;
      messageParams?: Record<string, string | number | boolean>;
    },
  ) => string | null;

  /**
   * Toast 해제
   */
  dismissToast: (id: string) => void;

  /**
   * 자동 해제 타이머 정지 — 포인터가 올라가 있거나 포커스가 안에 있는 동안.
   *
   * Why: 액션이 달린 토스트 (되돌리기) 는 사용자가 문구를 읽고 버튼까지 가야 한다.
   * 읽는 동안 사라지면 회복 수단 자체가 없어진다.
   */
  pauseToast: (id: string) => void;

  /** 정지했던 타이머를 남은 시간으로 다시 건다. */
  resumeToast: (id: string) => void;

  /**
   * 모든 Toast 해제
   */
  dismissAll: () => void;
}

const COOLDOWN_MS = 5 * 60 * 1000; // 5분 쿨다운

/** 자동 해제 타이머 — id 별 상태. 정지 중이면 `handle` 이 없고 `remaining` 만 남는다. */
interface ToastTimer {
  handle?: ReturnType<typeof setTimeout>;
  /** 이번 구간이 시작된 시각. 정지 시 남은 시간 계산에 쓴다. */
  startedAt: number;
  remaining: number;
}

const timers = new Map<string, ToastTimer>();

function clearTimer(id: string): ToastTimer | undefined {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer.handle);
    timers.delete(id);
  }
  return timer;
}

function armTimer(id: string, remaining: number, onExpire: () => void): void {
  if (remaining <= 0) return;
  timers.set(id, {
    handle: setTimeout(() => {
      timers.delete(id);
      onExpire();
    }, remaining),
    startedAt: Date.now(),
    remaining,
  });
}

export const useToastStore = create<ToastState & ToastActions>((set, get) => ({
  toasts: [],
  lastShownMap: new Map(),

  showToast: (type, message, options = {}) => {
    const {
      duration = 5000,
      action,
      bypassCooldown = false,
      messageKey,
      messageParams,
    } = options;
    const state = get();

    // 중복 알림 방지 (동일 메시지 쿨다운)
    if (!bypassCooldown) {
      // 쿨다운은 언어와 무관해야 한다 — 같은 알림을 언어만 바꿔 두 번 띄우지 않는다.
      const key = `${type}:${messageKey ?? message}`;
      const lastShown = state.lastShownMap.get(key);
      const now = Date.now();

      if (lastShown && now - lastShown < COOLDOWN_MS) {
        return null; // 쿨다운 중
      }

      // 쿨다운 맵 업데이트
      const newMap = new Map(state.lastShownMap);
      newMap.set(key, now);
      set({ lastShownMap: newMap });
    }

    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const toast: Toast = {
      id,
      type,
      message,
      messageKey,
      messageParams,
      duration,
      action,
    };

    set((state) => ({
      toasts: [...state.toasts, toast],
    }));

    // 자동 해제 (duration > 0인 경우)
    armTimer(id, duration, () => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    });

    return id;
  },

  dismissToast: (id) => {
    clearTimer(id);
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  pauseToast: (id) => {
    const timer = timers.get(id);
    if (!timer?.handle) return; // 없거나 이미 정지
    clearTimeout(timer.handle);
    // 남은 시간을 보존한다 — 재개 때 처음부터 다시 세면 hover 만으로 수명이 늘어난다.
    const elapsed = Date.now() - timer.startedAt;
    timers.set(id, {
      startedAt: 0,
      remaining: Math.max(0, timer.remaining - elapsed),
    });
  },

  resumeToast: (id) => {
    const paused = timers.get(id);
    if (!paused || paused.handle) return; // 없거나 이미 돌고 있음
    timers.delete(id);
    armTimer(id, paused.remaining, () => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    });
  },

  dismissAll: () => {
    for (const id of [...timers.keys()]) clearTimer(id);
    set({ toasts: [] });
  },
}));

/**
 * 글로벌 toast 헬퍼 함수
 *
 * React 컴포넌트 외부에서 사용 가능
 * 예: Zustand store actions에서 호출
 */
// 반복 표시가 필요한 액션 토스트(undo 등)는 bypassCooldown 을 넘길 수 있어야 한다 —
// showToast 의 5분 동일-메시지 쿨다운은 정보성 알림 스팸 방지용이라, 사용자가 같은
// 실수를 반복할 때마다 떠야 하는 회복 안내에는 오히려 방해가 된다 (toast.ts 쿨다운 주석 참조).
type GlobalToastOptions = {
  duration?: number;
  action?: ToastAction;
  bypassCooldown?: boolean;
  messageKey?: string;
  messageParams?: Record<string, string | number | boolean>;
};

export const globalToast = {
  success: (message: string, options?: GlobalToastOptions) =>
    useToastStore.getState().showToast("success", message, options),

  warning: (message: string, options?: GlobalToastOptions) =>
    useToastStore.getState().showToast("warning", message, options),

  error: (message: string, options?: GlobalToastOptions) =>
    useToastStore
      .getState()
      .showToast("error", message, { bypassCooldown: true, ...options }),

  info: (message: string, options?: GlobalToastOptions) =>
    useToastStore.getState().showToast("info", message, options),
};

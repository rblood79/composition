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
  onClick: () => void;
}

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
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
    },
  ) => string | null;

  /**
   * Toast 해제
   */
  dismissToast: (id: string) => void;

  /**
   * 모든 Toast 해제
   */
  dismissAll: () => void;
}

const COOLDOWN_MS = 5 * 60 * 1000; // 5분 쿨다운

export const useToastStore = create<ToastState & ToastActions>((set, get) => ({
  toasts: [],
  lastShownMap: new Map(),

  showToast: (type, message, options = {}) => {
    const { duration = 5000, action, bypassCooldown = false } = options;
    const state = get();

    // 중복 알림 방지 (동일 메시지 쿨다운)
    if (!bypassCooldown) {
      const key = `${type}:${message}`;
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
    const toast: Toast = { id, type, message, duration, action };

    set((state) => ({
      toasts: [...state.toasts, toast],
    }));

    // 자동 해제 (duration > 0인 경우)
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }

    return id;
  },

  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  dismissAll: () => {
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

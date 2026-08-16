/**
 * useToast Hook
 *
 * Toast 알림 상태 관리
 * - 5분 쿨다운으로 중복 알림 방지
 * - 자동 해제 지원
 */

import { useState, useCallback, useRef } from "react";

// Toast 계약의 정본은 전역 store (`stores/toast.ts`). 두 경로의 토스트는
// `ToastContainer` 가 한 목록으로 병합해 렌더하므로 타입이 갈리면 병합 지점이
// 깨진다 — 형상을 복제하지 않고 파생한다.
export type { ToastType } from "../stores/toast";
import type { Toast as StoreToast, ToastType } from "../stores/toast";

/**
 * 훅 경로 토스트 — store 토스트의 **진부분집합을 타입으로 못 박은 것**.
 *
 * `action?: ToastAction` 이 빠진 것이 차이이자 의도다. Undo 같은 액션 버튼은
 * 전역 store 경로만 지원하고, 이 훅은 로컬 `useState` 기반 legacy 호환
 * 경로다 (`ToastContainer` 가 `source: "hook"` 으로 구분해 action 을 넘기지
 * 않는다).
 *
 * 종전에는 같은 필드를 다시 선언하고 그 관계를 주석으로만 적어 뒀다 —
 * store 쪽에 필드가 늘어도 이쪽이 따라오지 않아 조용히 갈릴 수 있었다.
 * `Omit` 파생으로 바꿔 드리프트를 구조적으로 불가능하게 만든다.
 */
export type Toast = Omit<StoreToast, "action">;

const COOLDOWN_MS = 5 * 60 * 1000; // 5분 쿨다운

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastShownRef = useRef<Map<string, number>>(new Map());

  /**
   * Toast 표시
   * @param type Toast 타입
   * @param message 메시지
   * @param duration 표시 시간 (ms), 0 = 영구
   * @returns Toast ID 또는 null (쿨다운 중인 경우)
   */
  const showToast = useCallback(
    (type: ToastType, message: string, duration = 5000): string | null => {
      // 중복 알림 방지 (동일 메시지 쿨다운)
      const key = `${type}:${message}`;
      const lastShown = lastShownRef.current.get(key);
      const now = Date.now();

      if (lastShown && now - lastShown < COOLDOWN_MS) {
        return null; // 쿨다운 중
      }

      lastShownRef.current.set(key, now);

      const id = `toast-${now}-${Math.random().toString(36).slice(2, 9)}`;
      const toast: Toast = { id, type, message, duration };

      setToasts((prev) => [...prev, toast]);

      // 자동 해제
      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }

      return id;
    },
    [],
  );

  /**
   * Toast 해제
   */
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /**
   * 모든 Toast 해제
   */
  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    showToast,
    dismissToast,
    dismissAll,
  };
}

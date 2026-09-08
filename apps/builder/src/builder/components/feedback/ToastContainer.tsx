/**
 * ToastContainer Component
 *
 * Toast 알림들을 표시하는 컨테이너
 * - 기존 hook 기반 토스트 지원
 * - 글로벌 store 기반 토스트 지원 (Action 버튼 포함)
 */

import { useRef, type CSSProperties } from "react";

import { Toast } from "./Toast";
import { useActionBarClearance } from "./useActionBarClearance";
import { useToastStore } from "../../stores/toast";
import type { Toast as HookToastType } from "@/builder/hooks";
import type { Toast as StoreToastType, ToastAction } from "../../stores/toast";
import { useI18n } from "@/i18n";
import "./Toast.css";

interface ToastContainerProps {
  /** Hook 기반 토스트 (기존 호환성) */
  toasts?: HookToastType[];
  /** Hook 기반 토스트 해제 함수 */
  onDismiss?: (id: string) => void;
}

export function ToastContainer({
  toasts: hookToasts = [],
  onDismiss,
}: ToastContainerProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  // 글로벌 store 토스트
  const storeToasts = useToastStore((state) => state.toasts);
  const dismissStoreToast = useToastStore((state) => state.dismissToast);

  // Hook 기반 토스트와 Store 기반 토스트 병합
  const allToasts = [
    ...hookToasts.map((t) => ({ ...t, source: "hook" as const })),
    ...storeToasts.map((t) => ({ ...t, source: "store" as const })),
  ];

  // 훅은 조기 반환보다 위에 있어야 한다 — 토스트 유무로 호출 순서가 바뀌면 안 된다.
  const hasToasts = allToasts.length > 0;
  const clearance = useActionBarClearance(containerRef, hasToasts);

  if (!hasToasts) {
    return null;
  }

  /** 액션 라벨도 키가 있으면 렌더 시점에 해소한다 (store action 발 토스트). */
  const resolveAction = (action?: ToastAction): ToastAction | undefined =>
    action?.labelKey ? { ...action, label: t(action.labelKey) } : action;

  const handleDismiss = (id: string, source: "hook" | "store") => {
    if (source === "hook" && onDismiss) {
      onDismiss(id);
    } else if (source === "store") {
      dismissStoreToast(id);
    }
  };

  return (
    <div
      ref={containerRef}
      className="toast-container"
      role="region"
      aria-label="Notifications"
      // action bar 가 토스트 자리로 들어왔을 때만 그만큼 더 올린다 (평소 0).
      style={
        clearance > 0
          ? ({
              "--toast-action-bar-clearance": `${clearance}px`,
            } as CSSProperties)
          : undefined
      }
    >
      {allToasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          type={toast.type}
          message={
            toast.source === "store" && (toast as StoreToastType).messageKey
              ? t(
                  (toast as StoreToastType).messageKey!,
                  (toast as StoreToastType).messageParams,
                )
              : toast.message
          }
          onDismiss={(id) => handleDismiss(id, toast.source)}
          action={
            toast.source === "store"
              ? resolveAction((toast as StoreToastType).action)
              : undefined
          }
        />
      ))}
    </div>
  );
}

/**
 * ToastContainer — 빌더 전역 토스트의 유일한 렌더 지점.
 *
 * 토스트는 `stores/toast.ts` 하나로 낸다 (되돌리기 액션 · hover 정지 · 쿨다운 소유).
 * 이 컨테이너는 BuilderCore 가 한 번만 마운트한다 — 패널이 자기 컨테이너를 따로 두면
 * 같은 store 를 두 번 그린다 (2026-09-08 Monitor 패널에서 재현 · 훅 경로 삭제).
 */

import { useRef, type CSSProperties } from "react";

import { Toast } from "./Toast";
import { useActionBarClearance } from "./useActionBarClearance";
import { useToastStore } from "../../stores/toast";
import type { ToastAction } from "../../stores/toast";
import { useI18n } from "@/i18n";
import "./Toast.css";

export function ToastContainer() {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const toasts = useToastStore((state) => state.toasts);
  const dismissToast = useToastStore((state) => state.dismissToast);

  // 훅은 조기 반환보다 위에 있어야 한다.
  const hasToasts = toasts.length > 0;
  const clearance = useActionBarClearance(containerRef, hasToasts);

  if (!hasToasts) {
    return null;
  }

  /** 액션 라벨도 키가 있으면 렌더 시점에 해소한다 (store action 발 토스트). */
  const resolveAction = (action?: ToastAction): ToastAction | undefined =>
    action?.labelKey ? { ...action, label: t(action.labelKey) } : action;

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
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          type={toast.type}
          message={
            toast.messageKey
              ? t(toast.messageKey, toast.messageParams)
              : toast.message
          }
          onDismiss={dismissToast}
          action={resolveAction(toast.action)}
        />
      ))}
    </div>
  );
}

/**
 * ToastContainer — 빌더 전역 토스트의 유일한 렌더 지점.
 *
 * 토스트는 `stores/toast.ts` 하나로 낸다 (되돌리기 액션 · hover 정지 · 쿨다운 소유).
 * 이 컨테이너는 BuilderCore 가 한 번만 마운트한다 — 패널이 자기 컨테이너를 따로 두면
 * 같은 store 를 두 번 그린다 (2026-09-08 Monitor 패널에서 재현 · 훅 경로 삭제).
 *
 * 그리기는 S2 `ToastContainer` 와 같은 구현 (사용자 2026-11-11 「S2 형태의 Toast」) — Preview 의
 * `ToastRegion` 에 빌더 skin (`Toast.tsx`) 을 넘긴다. store 는 그대로 정본이고, 여기서 RAC queue 로
 * 옮긴다: store 에 새로 생긴 토스트 → queue 추가, store 에서 빠진 토스트 → queue 닫기, region 에서
 * 닫힌 토스트 (닫기 버튼 · 「모두 지우기」) → store 해제. 자동 해제 시간은 store 의 것이고, region 이
 * hover · focus 로 멈출 때 (RAC `pauseAll` · `resumeAll`) store 타이머도 같이 멈춘다.
 *
 * 자리는 빌더 설정 (Settings 「Toast placement」 — `uiStore.toastPlacement`, 기본 `bottom` — S2 기본) 이다.
 * 앱 (Preview · Publish) 토스트 자리인 Site 「Toast placement」 와는 다른 값이다 — 빌더 알림은 작업하는
 * 사람의 환경, 앱 토스트는 프로젝트 문서 (사용자 2026-11-12). contextual action bar 위치와 관계없이 그 자리에
 * 고정한다 (사용자 2026-11-13 「바 위치와 관계없이 설정에서 정한 Toast 위치에 고정」).
 */

import { useEffect, useRef, useState } from "react";

import { useI18n } from "@/i18n";
import {
  BUILDER_TOAST_PREFIX,
  BUILDER_TOAST_SKIN,
  BUILDER_TOAST_VARIANT,
} from "./Toast";
import { useToastStore } from "../../stores/toast";
import { useUiStore } from "../../../stores/uiStore";

type RegionModule =
  typeof import("../../../../../../packages/shared/src/components/ToastRegion.lazy");
type RegionQueue = ReturnType<RegionModule["createToastQueue"]>;

export function ToastContainer() {
  const { t } = useI18n();
  const placement = useUiStore((state) => state.toastPlacement);
  const toasts = useToastStore((state) => state.toasts);
  const hasToasts = toasts.length > 0;
  const [region, setRegion] = useState<{
    module: RegionModule;
    queue: RegionQueue;
  } | null>(null);
  /** store id → queue key */
  const keys = useRef(new Map<string, string>());
  /** region 에 한 번이라도 보인 key — 추가 직후 (view transition 전) 의 부재를 닫힘으로 읽지 않는다. */
  const seen = useRef(new Set<string>());

  // region 모듈은 첫 토스트와 함께 읽는다 (빌더 초기 번들에 싣지 않는다 — Preview 의 ToastProvider 와 같다).
  const loading = useRef(false);
  useEffect(() => {
    if (!hasToasts || loading.current) return;
    loading.current = true;
    void import("../../../../../../packages/shared/src/components/ToastRegion.lazy").then(
      (module) => {
        const queue = module.createToastQueue(BUILDER_TOAST_PREFIX);
        // region 의 hover · focus 정지 (RAC `useToastRegion` → `pauseAll`) 를 store 타이머에도 건다 —
        // 되돌리기 문구를 읽는 동안 사라지지 않게 (store `pauseToast` 의 이유).
        const raw = queue.queue;
        const pauseAll = raw.pauseAll.bind(raw);
        const resumeAll = raw.resumeAll.bind(raw);
        raw.pauseAll = () => {
          pauseAll();
          for (const id of keys.current.keys())
            useToastStore.getState().pauseToast(id);
        };
        raw.resumeAll = () => {
          resumeAll();
          for (const id of keys.current.keys())
            useToastStore.getState().resumeToast(id);
        };
        setRegion({ module, queue });
      },
    );
  }, [hasToasts]);

  // region → store: 닫기 버튼 · 「모두 지우기」 로 queue 에서 빠진 토스트를 store 에서도 해제한다.
  useEffect(() => {
    if (!region) return;
    const raw = region.queue.queue;
    return raw.subscribe(() => {
      const visible = new Set(raw.visibleToasts.map((toast) => toast.key));
      for (const [id, key] of keys.current) {
        if (visible.has(key)) {
          seen.current.add(key);
        } else if (seen.current.has(key)) {
          keys.current.delete(id);
          seen.current.delete(key);
          useToastStore.getState().dismissToast(id);
        }
      }
    });
  }, [region]);

  // store → region
  useEffect(() => {
    if (!region) return;
    const ids = new Set(toasts.map((toast) => toast.id));
    for (const [id, key] of keys.current) {
      if (ids.has(id)) continue;
      keys.current.delete(id);
      seen.current.delete(key);
      region.queue.close(key);
    }
    for (const toast of toasts) {
      if (keys.current.has(toast.id)) continue;
      // 문구 · 액션 라벨의 키는 추가 시점에 해소한다 (store action 발 토스트).
      const title = toast.messageKey
        ? t(toast.messageKey, toast.messageParams)
        : toast.message;
      const action = toast.action;
      const key = region.queue.add({
        title,
        variant: BUILDER_TOAST_VARIANT[toast.type],
        ...(action
          ? {
              actionLabel: action.labelKey ? t(action.labelKey) : action.label,
              onAction: action.onClick,
              // 액션 실행 후 자동 닫기 (종전 빌더 동작 · S2 `shouldCloseOnAction`)
              shouldCloseOnAction: true,
            }
          : {}),
      });
      keys.current.set(toast.id, key);
    }
  }, [toasts, region, t]);

  if (!region) return null;
  const Region = region.module.ToastRegion;
  return (
    <Region
      queue={region.queue.queue}
      placement={placement}
      skin={BUILDER_TOAST_SKIN}
    />
  );
}

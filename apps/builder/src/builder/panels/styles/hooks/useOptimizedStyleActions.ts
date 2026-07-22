/**
 * useOptimizedStyleActions - 최적화된 스타일 업데이트 액션 훅
 *
 * Phase 1 최적화:
 * - useTransition으로 캔버스 업데이트 지연
 * - requestAnimationFrame 기반 스로틀 (드래그, 슬라이더)
 * - requestIdleCallback 기반 지연 실행 (타이핑)
 *
 * @example
 * const { updateStyleRAF, updateStyleIdle, isPending } = useOptimizedStyleActions();
 *
 * // 슬라이더 드래그
 * <Slider onChange={(v) => updateStyleRAF('width', v)} />
 *
 * // 텍스트 입력
 * <Input onChange={(v) => updateStyleIdle('fontSize', v)} />
 *
 * @since 2025-12-20 Phase 1 - Quick Wins
 */

import { useCallback, useTransition, useRef, useEffect } from "react";
import { useStore } from "../../../stores";
import {
  isFillDerivedStyleProp,
  sanitizeFillDerivedStylePatch,
} from "../utils/fillDerivedStyleProps";

// ============================================
// Types
// ============================================

interface OptimizedStyleActionsResult {
  /** useTransition 대기 중 여부 */
  isPending: boolean;

  /** 즉시 스타일 업데이트 (blur, enter) */
  updateStyleImmediate: (property: string, value: string) => void;

  /** RAF 기반 스로틀 업데이트 (드래그, 슬라이더) */
  updateStyleRAF: (property: string, value: string) => void;

  /** Idle 기반 지연 업데이트 (타이핑) */
  updateStyleIdle: (property: string, value: string) => void;

  /** RAF 기반 연속 입력 프리뷰 (히스토리/DB 없이 캔버스만 업데이트) */
  updateStylePreview: (property: string, value: string) => void;

  /** 여러 스타일 즉시 업데이트 */
  updateStylesImmediate: (styles: Record<string, string>) => void;

  /** 여러 스타일 Transition 적용 업데이트 */
  updateStylesTransition: (styles: Record<string, string>) => void;

  /** 보류 중인 업데이트 취소 */
  cancelPendingUpdates: () => void;
}

// ============================================
// requestIdleCallback Polyfill
// ============================================

const requestIdleCallbackPolyfill =
  typeof requestIdleCallback !== "undefined"
    ? requestIdleCallback
    : (cb: IdleRequestCallback, options?: IdleRequestOptions): number => {
        const start = Date.now();
        return window.setTimeout(() => {
          cb({
            didTimeout: false,
            timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
          });
        }, options?.timeout ?? 1) as unknown as number;
      };

const cancelIdleCallbackPolyfill =
  typeof cancelIdleCallback !== "undefined"
    ? cancelIdleCallback
    : (id: number): void => {
        clearTimeout(id);
      };

// ============================================
// Hook Implementation
// ============================================

export function useOptimizedStyleActions(): OptimizedStyleActionsResult {
  const [isPending, startTransition] = useTransition();

  // RAF/Idle 참조
  const rafIdRef = useRef<number | null>(null);
  const previewRafIdRef = useRef<number | null>(null);
  const idleIdRef = useRef<number | null>(null);
  const pendingUpdateRef = useRef<{ property: string; value: string } | null>(
    null,
  );
  const pendingPreviewRef = useRef<{ property: string; value: string } | null>(
    null,
  );

  // 정리
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (previewRafIdRef.current !== null) {
        cancelAnimationFrame(previewRafIdRef.current);
      }
      if (idleIdRef.current !== null) {
        cancelIdleCallbackPolyfill(idleIdRef.current);
      }
    };
  }, []);

  /**
   * 보류 중인 업데이트 취소
   */
  const cancelPendingUpdates = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (previewRafIdRef.current !== null) {
      cancelAnimationFrame(previewRafIdRef.current);
      previewRafIdRef.current = null;
    }
    if (idleIdRef.current !== null) {
      cancelIdleCallbackPolyfill(idleIdRef.current);
      idleIdRef.current = null;
    }
    pendingUpdateRef.current = null;
    pendingPreviewRef.current = null;
  }, []);

  /**
   * 즉시 스타일 업데이트 (blur, enter)
   * - 보류 중인 업데이트 취소
   * - 즉시 스토어 업데이트
   */
  const updateStyleImmediate = useCallback(
    (property: string, value: string) => {
      if (isFillDerivedStyleProp(property)) {
        return;
      }
      cancelPendingUpdates();
      useStore.getState().updateSelectedStyle(property, value);
    },
    [cancelPendingUpdates],
  );

  /**
   * RAF 기반 스로틀 업데이트 (드래그, 슬라이더)
   * - 프레임당 1회만 실행
   * - 연속 입력 시 마지막 값만 적용
   */
  const updateStyleRAF = useCallback((property: string, value: string) => {
    if (isFillDerivedStyleProp(property)) {
      return;
    }
    pendingUpdateRef.current = { property, value };

    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        const pending = pendingUpdateRef.current;
        if (pending) {
          useStore
            .getState()
            .updateSelectedStyle(pending.property, pending.value);
        }
        rafIdRef.current = null;
        pendingUpdateRef.current = null;
      });
    }
  }, []);

  /**
   * RAF 기반 연속 입력 프리뷰 (화살표/드래그 중 캔버스 반영)
   * - 히스토리/DB 저장 없이 캔버스만 업데이트
   * - 프레임당 1회만 실행
   * - 최종 커밋은 blur/Enter 시 updateStyleImmediate로 수행
   */
  const updateStylePreview = useCallback((property: string, value: string) => {
    if (isFillDerivedStyleProp(property)) {
      return;
    }
    pendingPreviewRef.current = { property, value };

    if (previewRafIdRef.current === null) {
      previewRafIdRef.current = requestAnimationFrame(() => {
        const pending = pendingPreviewRef.current;
        if (pending) {
          useStore
            .getState()
            .updateSelectedStylePreview(pending.property, pending.value);
        }
        previewRafIdRef.current = null;
        pendingPreviewRef.current = null;
      });
    }
  }, []);

  /**
   * Idle 기반 지연 업데이트 (타이핑)
   * - 메인 스레드 유휴 시 실행
   * - 연속 입력 시 마지막 값만 적용
   */
  const updateStyleIdle = useCallback((property: string, value: string) => {
    if (isFillDerivedStyleProp(property)) {
      return;
    }
    pendingUpdateRef.current = { property, value };

    // 기존 예약 취소
    if (idleIdRef.current !== null) {
      cancelIdleCallbackPolyfill(idleIdRef.current);
    }

    idleIdRef.current = requestIdleCallbackPolyfill(
      () => {
        const pending = pendingUpdateRef.current;
        if (pending) {
          useStore
            .getState()
            .updateSelectedStyle(pending.property, pending.value);
        }
        idleIdRef.current = null;
        pendingUpdateRef.current = null;
      },
      { timeout: 100 },
    );
  }, []);

  /**
   * 여러 스타일 즉시 업데이트
   */
  const updateStylesImmediate = useCallback(
    (styles: Record<string, string>) => {
      cancelPendingUpdates();
      useStore
        .getState()
        .updateSelectedStyles(sanitizeFillDerivedStylePatch(styles, true));
    },
    [cancelPendingUpdates],
  );

  /**
   * 여러 스타일 Transition 적용 업데이트
   * - useTransition으로 낮은 우선순위 처리
   * - UI 반응성 유지
   */
  const updateStylesTransition = useCallback(
    (styles: Record<string, string>) => {
      const sanitized = sanitizeFillDerivedStylePatch(styles, true);
      startTransition(() => {
        useStore.getState().updateSelectedStyles(sanitized);
      });
    },
    [startTransition],
  );

  return {
    isPending,
    updateStyleImmediate,
    updateStyleRAF,
    updateStylePreview,
    updateStyleIdle,
    updateStylesImmediate,
    updateStylesTransition,
    cancelPendingUpdates,
  };
}

// ============================================
// Convenience Hook for Input Components
// ============================================

/**
 * 입력 컴포넌트용 최적화된 스타일 업데이트 훅
 *
 * @param property - 스타일 속성명
 * @returns onChange 핸들러들과 상태
 */
export function useOptimizedStyleInput(property: string) {
  const {
    isPending,
    updateStyleImmediate,
    updateStyleRAF,
    updateStyleIdle,
    cancelPendingUpdates,
  } = useOptimizedStyleActions();

  const handleChange = useCallback(
    (value: string) => {
      updateStyleIdle(property, value);
    },
    [property, updateStyleIdle],
  );

  const handleDrag = useCallback(
    (value: string) => {
      updateStyleRAF(property, value);
    },
    [property, updateStyleRAF],
  );

  const handleBlur = useCallback(
    (value: string) => {
      updateStyleImmediate(property, value);
    },
    [property, updateStyleImmediate],
  );

  return {
    isPending,
    handleChange,
    handleDrag,
    handleBlur,
    cancel: cancelPendingUpdates,
  };
}

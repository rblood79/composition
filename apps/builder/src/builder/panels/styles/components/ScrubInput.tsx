/**
 * ScrubInput - 드래그로 숫자 값 조정하는 입력 컴포넌트
 *
 * Pencil 앱의 iVt 컴포넌트 패턴:
 * - 라벨 드래그 → requestPointerLock() + movementX 누적
 * - Shift 키 → stepMultiplier (정밀 모드)
 * - 클릭 → 일반 텍스트 입력 전환
 * - blur/Enter → onCommit
 *
 * @since 2026-02-11 Color Picker Phase 3
 * @see docs/COLOR_PICKER.md Section 5.2
 */

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { useStore } from "../../../stores";

import "./ScrubInput.css";

export interface ScrubInputProps {
  value: number;
  onCommit: (value: number) => void;
  /** 드래그 중 실시간 미리보기 (optional) */
  onScrub?: (value: number) => void;
  step?: number;
  /** Shift 키 배수 (기본 10) */
  stepMultiplier?: number;
  min?: number;
  max?: number;
  suffix?: string;
  /** aria-label */
  label?: string;
  className?: string;
}

/** 드래그 시작 판정 거리 (px) */
const DRAG_THRESHOLD = 3;

export const ScrubInput = memo(function ScrubInput({
  value,
  onCommit,
  onScrub,
  step = 1,
  stepMultiplier = 10,
  min,
  max,
  suffix,
  label,
  className,
}: ScrubInputProps) {
  const selectedElementId = useStore((state) => state.selectedElementId);
  const [editing, setEditing] = useState(false);
  const [displayValue, setDisplayValue] = useState(String(Math.round(value)));
  const [isDraggingState, setIsDraggingState] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrubRef = useRef<HTMLDivElement>(null);

  // 드래그 상태 refs (리렌더 방지)
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartValue = useRef(value);
  const accumulator = useRef(0);
  const currentValue = useRef(value);
  const hasMoved = useRef(false);
  const focusedElementIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!editing) {
      queueMicrotask(() => setDisplayValue(String(Math.round(value))));
    }
  }, [value, editing]);

  useEffect(() => {
    if (!isDragging.current) {
      currentValue.current = value;
    }
  }, [value]);

  useEffect(() => {
    queueMicrotask(() => {
      setEditing(false);
      setIsDraggingState(false);
    });
    isDragging.current = false;
    hasMoved.current = false;
    focusedElementIdRef.current = null;
    currentValue.current = value;
    queueMicrotask(() => setDisplayValue(String(Math.round(value))));
  }, [selectedElementId, value]);

  const clamp = useCallback(
    (v: number) => {
      let clamped = v;
      if (min !== undefined) clamped = Math.max(min, clamped);
      if (max !== undefined) clamped = Math.min(max, clamped);
      return Math.round(clamped);
    },
    [min, max],
  );

  // ---- 텍스트 입력 모드 ----

  const commitInputValue = useCallback(() => {
    const parsed = Number(displayValue);
    if (!Number.isNaN(parsed)) {
      const clamped = clamp(parsed);
      onCommit(clamped);
      setDisplayValue(String(clamped));
    } else {
      setDisplayValue(String(Math.round(value)));
    }
    setEditing(false);
  }, [displayValue, clamp, onCommit, value]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDisplayValue(e.target.value);
    },
    [],
  );

  const handleInputBlur = useCallback(() => {
    const currentElementId = useStore.getState().selectedElementId ?? null;
    if (
      focusedElementIdRef.current !== null &&
      currentElementId !== focusedElementIdRef.current
    ) {
      setEditing(false);
      setDisplayValue(String(Math.round(value)));
      return;
    }
    commitInputValue();
  }, [commitInputValue, value]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        (e.target as HTMLInputElement).blur();
      } else if (e.key === "Escape") {
        setDisplayValue(String(Math.round(value)));
        setEditing(false);
      }
    },
    [value],
  );

  // ---- 드래그 (Scrub) 모드 ----
  // React Compiler 호환: useEffect 내에서만 ref.current를 변경
  const editingRef = useRef(editing);
  const stepRef = useRef(step);
  const stepMultiplierRef = useRef(stepMultiplier);
  const clampRef = useRef(clamp);
  const onScrubRef = useRef(onScrub);
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    editingRef.current = editing;
    stepRef.current = step;
    stepMultiplierRef.current = stepMultiplier;
    clampRef.current = clamp;
    onScrubRef.current = onScrub;
    onCommitRef.current = onCommit;
  });

  useEffect(() => {
    const el = scrubRef.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      // 이미 편집 중이면 드래그 시작하지 않음
      if (editingRef.current) return;
      // 왼쪽 클릭만
      if (e.button !== 0) return;

      isDragging.current = true;
      setIsDraggingState(true);
      hasMoved.current = false;
      dragStartX.current = e.clientX;
      dragStartValue.current = currentValue.current;
      accumulator.current = 0;

      const onPointerMove = (ev: PointerEvent) => {
        if (!isDragging.current) return;

        const dx = ev.clientX - dragStartX.current;

        // 아직 threshold 미달이면 pointerLock 시도 안 함
        if (!hasMoved.current) {
          if (Math.abs(dx) < DRAG_THRESHOLD) return;
          hasMoved.current = true;
          // pointerLock 시도 (지원 시)
          try {
            void Promise.resolve(
              scrubRef.current?.requestPointerLock?.(),
            ).catch(() => undefined);
          } catch {
            // pointer lock을 사용할 수 없는 문서/iframe에서는 dx 경로를 유지한다.
          }
        }

        const effectiveStep = ev.shiftKey
          ? stepRef.current / stepMultiplierRef.current
          : stepRef.current;

        // movementX 기반이면 직접 누적
        if (document.pointerLockElement) {
          accumulator.current += ev.movementX;
        } else {
          accumulator.current = dx;
        }

        const delta = accumulator.current * effectiveStep;
        const newVal = clampRef.current(dragStartValue.current + delta);

        if (newVal !== currentValue.current) {
          currentValue.current = newVal;
          setDisplayValue(String(newVal));
          onScrubRef.current?.(newVal);
        }
      };

      const removeListeners = () => {
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
      };

      const onPointerUp = () => {
        const wasDragging = hasMoved.current;
        isDragging.current = false;
        setIsDraggingState(false);

        // pointerLock 해제
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }

        removeListeners();

        if (wasDragging) {
          // 드래그 완료 → 값 커밋
          onCommitRef.current(currentValue.current);
        } else {
          // 클릭 → 편집 모드 전환
          setEditing(true);
          // 다음 프레임에서 input에 포커스 + 전체 선택
          requestAnimationFrame(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
          });
        }
      };

      // 전역 이벤트 등록 (pointer capture 대신 — pointerLock과 호환)
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);

      e.preventDefault();
    };

    el.addEventListener("pointerdown", onPointerDown);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  if (editing) {
    return (
      <div className={`scrub-input ${className ?? ""}`}>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          className="scrub-input__field scrub-input__field--editing"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={() => {
            focusedElementIdRef.current = selectedElementId ?? null;
          }}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          aria-label={label}
        />
        {suffix && <span className="scrub-input__suffix">{suffix}</span>}
      </div>
    );
  }

  return (
    <div
      ref={scrubRef}
      className={`scrub-input ${className ?? ""}`}
      data-dragging={isDraggingState || undefined}
    >
      <span className="scrub-input__display" aria-label={label}>
        {displayValue}
      </span>
      {suffix && <span className="scrub-input__suffix">{suffix}</span>}
    </div>
  );
});

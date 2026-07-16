import { useCallback, useRef } from "react";

/**
 * RAC Select popover 닫힘 시 트리거 focus 즉시 복원 훅.
 *
 * popover 가 닫힐 때 (값 선택 / 트리거 재클릭 / 빈 영역 클릭) focus 가
 * ListBox(portal) → body 로 낙하했다가 RAC FocusScope 복원까지 수십~수백 ms
 * gap 이 생겨, 부모 Group 의 :focus-within focus ring 이 깜빡인다
 * (ComboBox 는 input 에 focus 가 유지되어 이 gap 이 없음).
 *
 * 닫힘 시 다음 frame(paint 직전)에 focus 가 아직 popover 내부/body 에 미아
 * 상태면 트리거로 복원해 ring 연속성을 보장한다. 사용자가 다른 컨트롤을 직접
 * 클릭한 경우는 mousedown 기본 동작으로 그 대상이 이미 focus 를 가진 뒤라
 * 자동 skip — RAC 기본 동작 보존 (동기 무조건 복원 시 focus 강탈 회귀 실측).
 * flag/pointerdown 리스너 방식은 RAC dismiss 가 document capture 단계라
 * 항상 늦어 실패 (실측) — activeElement 재판정 방식만 모든 닫힘 경로를 커버.
 *
 * 사용법: Select 하나당 훅 1회 호출.
 * ```tsx
 * const { triggerRef, restoreFocusOnClose } = useSelectTriggerFocusRestore();
 * <AriaSelect onOpenChange={restoreFocusOnClose}>
 *   <Button ref={triggerRef}>...
 * ```
 * controlled isOpen 과 조합 시 onOpenChange 안에서 setIsOpen 후 호출.
 */
export function useSelectTriggerFocusRestore() {
  const triggerRef = useRef<HTMLButtonElement>(null);

  const restoreFocusOnClose = useCallback((open: boolean) => {
    if (open) return;
    requestAnimationFrame(() => {
      const ae = document.activeElement;
      if (ae === document.body || ae?.closest(".react-aria-Popover")) {
        triggerRef.current?.focus();
      }
    });
  }, []);

  return { triggerRef, restoreFocusOnClose };
}

/**
 * Focus-Visible Modality Hook — ADR-150 A1 (S4, focusVisible 축)
 *
 * RAC `data-focus-visible` 은 "요소가 focus 됨 + 현재 입력 modality 가 keyboard" 일 때만 링을
 * 표시한다(pointer 클릭 focus 는 링 숨김). 이 훅은 그 **입력 modality** 를 추적한다 — RAC
 * `useFocusVisible` 의 축소판.
 *
 * - keydown(순수 키, modifier 조합 제외) → keyboard modality
 * - pointerdown → pointer modality
 * - modality 전환 시 `overlayVersionRef` ++ 로 focus ring 표시/해제를 Skia 에 반영.
 *
 * focus 대상(어느 요소가 focus 인가)은 빌더 캔버스에 요소별 keyboard focus 개념이 없어
 * **선택 요소(selectedElementIds[0])** 로 본다 — SkiaCanvas 가 modality 가 keyboard 일 때만
 * 그 요소에 `racStateInput.isFocusVisible` 를 부여한다(selection≠focusVisible: 링은 keyboard
 * modality 에서만 발생).
 *
 * @see useElementPressInteraction.ts — 동일 overlayVersion 채널 재사용
 */

import { useEffect } from "react";
import type { MutableRefObject } from "react";

interface UseFocusVisibleModalityOptions {
  /** 현재 입력 modality 가 keyboard 인가 (true=keyboard, false=pointer) */
  keyboardModalityRef: MutableRefObject<boolean>;
  /** overlayVersion ref (modality 전환 시 focus ring 재렌더 트리거) */
  overlayVersionRef: MutableRefObject<number>;
}

export function useFocusVisibleModality({
  keyboardModalityRef,
  overlayVersionRef,
}: UseFocusVisibleModalityOptions): void {
  useEffect(() => {
    const setModality = (keyboard: boolean): void => {
      if (keyboardModalityRef.current === keyboard) return;
      keyboardModalityRef.current = keyboard;
      overlayVersionRef.current++;
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      // modifier 조합(Cmd+C 등)은 modality 전환 안 함 — RAC useFocusVisible 동형.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      setModality(true);
    };
    const onPointerDown = (): void => setModality(false);

    // capture 단계 등록 — 다른 핸들러의 stopPropagation 에 가리지 않게.
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [keyboardModalityRef, overlayVersionRef]);
}

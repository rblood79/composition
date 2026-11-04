import React from "react";
import {
  Modal as RACModal,
  ModalOverlay,
  ModalOverlayProps,
} from "react-aria-components/Modal";
import { composeRenderProps } from "react-aria-components/composeRenderProps";
import { ContentFocusScope } from "./ContentFocusScope";
import { DialogTriggerScope } from "./DialogTrigger";
import type { ComponentSize } from "../types";

export interface ModalProps extends ModalOverlayProps {
  /**
   * Size variant
   * @default 'M'
   */
  size?: ComponentSize;
  /**
   * 포커스 트랩 활성화
   * 모달 내부에서만 포커스 이동 가능
   * @default true
   */
  trapFocus?: boolean;
  /**
   * 자동 포커스
   * 모달이 열릴 때 첫 번째 포커스 가능한 요소로 자동 이동
   * @default true
   */
  autoFocus?: boolean;
  /**
   * 포커스 복원
   * 모달이 닫힐 때 이전 포커스 위치로 복원
   * @default true
   */
  restoreFocus?: boolean;
  /**
   * The scrim under the modal (a CSS color) — the catalog Modal rule's underlay, given by the
   * catalog DOM binding. Absent = the overlay sheet's (`overlays.css`).
   */
  underlay?: string;
}

/**
 * Modal — RAC `ModalOverlay > Modal` (S2 `Modal.tsx` renders the overlay itself the same way: the
 * overlay paints the underlay, the Modal is the box). A standalone RAC Modal makes the same
 * overlay but takes no style for it, so the overlay is explicit here.
 *
 * Features: focus trap · auto focus · focus restoration (`ContentFocusScope`), keyboard dismissal
 * and ARIA from RAC.
 */
export function Modal({
  size = "M",
  trapFocus = true,
  autoFocus = true,
  restoreFocus = true,
  underlay,
  children,
  // RAC `ModalOverlayProps` — the overlay's (RAC's standalone Modal splits the same set).
  isDismissable,
  isKeyboardDismissDisabled,
  isOpen,
  defaultOpen,
  onOpenChange,
  isEntering,
  isExiting,
  UNSTABLE_portalContainer,
  shouldCloseOnInteractOutside,
  ...props
}: ModalProps) {
  const modalClassName = composeRenderProps(props.className, (className) =>
    className ? `react-aria-Modal ${className}` : "react-aria-Modal",
  );

  return (
    <ModalOverlay
      isDismissable={isDismissable}
      isKeyboardDismissDisabled={isKeyboardDismissDisabled}
      isOpen={isOpen}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      isEntering={isEntering}
      isExiting={isExiting}
      UNSTABLE_portalContainer={UNSTABLE_portalContainer}
      shouldCloseOnInteractOutside={shouldCloseOnInteractOutside}
      style={underlay ? { backgroundColor: underlay } : undefined}
    >
      <RACModal {...props} className={modalClassName} data-size={size}>
        <ContentFocusScope
          contain={trapFocus}
          autoFocus={autoFocus}
          restoreFocus={restoreFocus}
        >
          {/* (A Dialog in the Modal opens in it — it makes no overlay of its own, ADR-256 Phase 8b.) */}
          <DialogTriggerScope.Provider value={false}>
            {children as React.ReactNode}
          </DialogTriggerScope.Provider>
        </ContentFocusScope>
      </RACModal>
    </ModalOverlay>
  );
}

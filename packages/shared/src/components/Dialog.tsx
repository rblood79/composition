import { useContext, type ReactNode } from "react";
import { Modal, ModalOverlay } from "react-aria-components/Modal";
import { Button as RACButton } from "react-aria-components/Button";
import { useLocale } from "react-aria-components/I18nProvider";
import { composeRenderProps } from "react-aria-components/composeRenderProps";
import { getIconData } from "@composition/rendering";
import {
  CATALOG_DIALOG_CLOSE_ICON,
  CATALOG_DIALOG_CLOSE_LABELS,
} from "../catalog/document/dialogChrome";
import { DialogTriggerScope } from "./DialogTrigger";
import { Dialog as RACDialog, DialogProps } from "react-aria-components/Dialog";
import type { ComponentSize } from "../types";

/**
 * Dialog 본문. Modal · Popover 안에서는 그 overlay 에서 열린다 (catalog Dialog origin 은 레퍼런스
 * `DialogTrigger > Button + Modal > Dialog` — ADR-256 Phase 8b). overlay 없이 DialogTrigger 바로
 * 아래 놓인 Dialog 만 RAC ModalOverlay/Modal 로 감싸 열고, 단독 사용 시에는 RAC Dialog 콘텐츠
 * 계약을 유지한다.
 *
 * 접근성 이름은 RAC 가 정한다 — `Heading slot="title"` 이 있으면 `aria-labelledby` (ADR-254).
 * 이름 폴백 (`aria-label`) 은 제목 유무를 아는 쪽 (catalog binding) 이 넘긴다: 여기서 기본값을
 * 넣으면 RAC `useDialog` 가 제목 연결을 버린다.
 */

export interface DialogExtendedProps extends DialogProps {
  size?: ComponentSize;
  isDismissable?: boolean;
  /**
   * S2 `isDismissible` (2026-11-18): draws S2's CloseButton at the header's end (RAC Button
   * `slot="close"` — the Dialog's close) and, opening its own modal, closes on an outside press.
   * Its ButtonGroup gives way (the catalog's `catalogDismissibleDialogOf`).
   */
  isDismissible?: boolean;
  /**
   * The scrim under the modal this Dialog opens (a CSS color — the catalog Modal rule's underlay,
   * given by the catalog DOM binding). Only read when it opens its own modal.
   */
  underlay?: string;
}

/** S2 `CloseButton` of a dismissible Dialog (its name in the locale — en · ko). */
function DialogCloseButton(): ReactNode {
  const { locale } = useLocale();
  const glyph = getIconData(CATALOG_DIALOG_CLOSE_ICON);
  return (
    <RACButton
      slot="close"
      className="dialog-close-button"
      aria-label={
        CATALOG_DIALOG_CLOSE_LABELS[locale.split("-")[0] ?? "en"] ??
        CATALOG_DIALOG_CLOSE_LABELS.en
      }
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {(glyph?.paths ?? []).map((d, i) => (
          <path key={i} d={d} />
        ))}
      </svg>
    </RACButton>
  );
}

export function Dialog({
  size = "M",
  isDismissable,
  isDismissible,
  underlay,
  ...props
}: DialogExtendedProps) {
  const hasTrigger = useContext(DialogTriggerScope);
  // 🚀 ClassNameOrFunction 타입 지원 - 문자열로 단순화
  const baseClassName =
    typeof props.className === "string" ? props.className : undefined;
  const dialogClassName = baseClassName
    ? `react-aria-Dialog ${baseClassName}`
    : "react-aria-Dialog";

  const children = isDismissible
    ? composeRenderProps(props.children, (inner) => (
        <>
          {inner}
          <DialogCloseButton />
        </>
      ))
    : props.children;
  const content = (
    <RACDialog
      {...props}
      className={dialogClassName}
      data-size={size}
      data-dismissible={isDismissable || isDismissible || undefined}
    >
      {children}
    </RACDialog>
  );
  if (!hasTrigger) return content;
  return (
    <ModalOverlay
      className="react-aria-ModalOverlay"
      isDismissable={isDismissable || isDismissible}
      style={underlay ? { backgroundColor: underlay } : undefined}
    >
      <Modal
        className="react-aria-Modal"
        data-size={size}
        data-dialog-trigger=""
      >
        <DialogTriggerScope.Provider value={false}>
          {content}
        </DialogTriggerScope.Provider>
      </Modal>
    </ModalOverlay>
  );
}

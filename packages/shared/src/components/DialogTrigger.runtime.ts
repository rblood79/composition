import { createContext, type ReactNode } from "react";

/** Dialog 본문은 이 경계 안에서만 모달로 열린다. 단독 본문 사용은 보존한다. */
export const DialogTriggerScope = createContext(false);

/**
 * RAC DialogTrigger has no element (ADR-256 G5 — the reference's trigger is the Button itself):
 * the node's own attributes (`data-catalog-id` · class · style) have no element to sit on.
 */
export interface DialogTriggerProps {
  children?: ReactNode;
  isOpen?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

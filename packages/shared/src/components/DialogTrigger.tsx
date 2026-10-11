import { createContext, useEffect, useState, type ReactNode } from "react";
import { DialogTrigger as RACDialogTrigger } from "react-aria-components/Dialog";

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

export function DialogTrigger({
  isOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: DialogTriggerProps) {
  // 문서의 열림 값을 런타임에 반영하되 버튼/닫기 동작은 문서를 수정하지 않는다.
  const [open, setOpen] = useState(isOpen ?? defaultOpen);
  useEffect(() => {
    if (isOpen !== undefined) setOpen(isOpen);
  }, [isOpen]);
  return (
    <RACDialogTrigger
      isOpen={open}
      onOpenChange={(value) => {
        setOpen(value);
        onOpenChange?.(value);
      }}
    >
      <DialogTriggerScope.Provider value={true}>
        {children}
      </DialogTriggerScope.Provider>
    </RACDialogTrigger>
  );
}

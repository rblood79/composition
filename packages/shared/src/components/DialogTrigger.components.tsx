import { useState } from "react";

import { DialogTrigger as RACDialogTrigger } from "react-aria-components/Dialog";
import {
  DialogTriggerProps,
  DialogTriggerScope,
} from "./DialogTrigger.runtime";

export function DialogTrigger({
  isOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: DialogTriggerProps) {
  // 문서의 열림 값을 런타임에 반영하되 버튼/닫기 동작은 문서를 수정하지 않는다.
  const [open, setOpen] = useState(isOpen ?? defaultOpen);
  const [previousOpen, setPreviousOpen] = useState(isOpen);
  if (previousOpen !== isOpen) {
    setPreviousOpen(isOpen);
    if (isOpen !== undefined) setOpen(isOpen);
  }
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

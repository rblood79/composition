import {
  MenuTrigger as RACMenuTrigger,
  type MenuTriggerProps as RACMenuTriggerProps,
} from "react-aria-components/Menu";
import type { HTMLAttributes, ReactNode } from "react";

export interface MenuTriggerProps
  extends Omit<RACMenuTriggerProps, "children">,
    Omit<HTMLAttributes<HTMLDivElement>, keyof RACMenuTriggerProps> {
  children?: ReactNode;
}

/**
 * ADR-256 후속 4 — RAC MenuTrigger with the layout box DialogTrigger · TooltipTrigger have
 * (`div.react-aria-MenuTrigger`, no role): RAC gives the trigger Button its press through context
 * (`PressResponder`) and the Popover · Menu theirs (`PopoverContext` · `MenuContext`), so the box
 * between them changes nothing — the Canvas and the DOM lay out the same box.
 */
export function MenuTrigger({
  isOpen,
  defaultOpen,
  onOpenChange,
  trigger,
  children,
  className,
  ...props
}: MenuTriggerProps) {
  return (
    <RACMenuTrigger
      isOpen={isOpen}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      trigger={trigger}
    >
      <div
        {...props}
        className={["react-aria-MenuTrigger", className]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </div>
    </RACMenuTrigger>
  );
}

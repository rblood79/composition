import {
  TooltipTrigger as RACTooltipTrigger,
  type TooltipTriggerComponentProps,
} from "react-aria-components/Tooltip";
import type { HTMLAttributes } from "react";

export interface TooltipTriggerProps
  extends Omit<TooltipTriggerComponentProps, "children">,
    Omit<HTMLAttributes<HTMLDivElement>, keyof TooltipTriggerComponentProps> {
  children?: TooltipTriggerComponentProps["children"];
}

/**
 * ADR-255 — RAC TooltipTrigger with the layout box DialogTrigger has (`div.react-aria-
 * TooltipTrigger`, no role): RAC gives the trigger its hover / focus through context
 * (`FocusableProvider`), so the box between them changes nothing — the Canvas and the DOM lay out
 * the same box.
 */
export function TooltipTrigger({
  isOpen,
  defaultOpen,
  onOpenChange,
  isDisabled,
  delay,
  closeDelay,
  trigger,
  children,
  className,
  ...props
}: TooltipTriggerProps) {
  return (
    <RACTooltipTrigger
      isOpen={isOpen}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      isDisabled={isDisabled}
      delay={delay}
      closeDelay={closeDelay}
      trigger={trigger}
    >
      <div
        {...props}
        className={["react-aria-TooltipTrigger", className]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </div>
    </RACTooltipTrigger>
  );
}

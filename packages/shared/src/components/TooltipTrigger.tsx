import {
  TooltipTrigger as RACTooltipTrigger,
  type TooltipTriggerComponentProps,
} from "react-aria-components/Tooltip";

export interface TooltipTriggerProps
  extends Omit<TooltipTriggerComponentProps, "children"> {
  children?: TooltipTriggerComponentProps["children"];
}

/**
 * RAC TooltipTrigger — no element of its own (ADR-256 G5 · the reference): RAC gives the trigger
 * its hover / focus through context (`FocusableProvider`). The Canvas lays the node out as
 * `display: contents` (its rule).
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
      {children}
    </RACTooltipTrigger>
  );
}

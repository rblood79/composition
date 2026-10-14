import {
  TooltipTrigger as RACTooltipTrigger,
  type TooltipProps as RACTooltipProps,
  type TooltipTriggerComponentProps,
} from "react-aria-components/Tooltip";
import { TooltipPlacementContext } from "./Tooltip";

/** The tooltip's placement props S2 `TooltipTrigger` takes (RAC `Tooltip`'s — handed on by context). */
export type TooltipPlacementProps = Pick<
  RACTooltipProps,
  "placement" | "offset" | "crossOffset" | "shouldFlip" | "containerPadding"
>;

export interface TooltipTriggerProps
  extends
    Omit<TooltipTriggerComponentProps, "children" | "closeDelay">,
    TooltipPlacementProps {
  children?: TooltipTriggerComponentProps["children"];
}

/**
 * RAC TooltipTrigger — no element of its own (ADR-256 G5 · the reference): RAC gives the trigger
 * its hover / focus through context (`FocusableProvider`). The Canvas lays the node out as
 * `display: contents` (its rule).
 *
 * S2 1.8 `TooltipTrigger` (2026-10-14 D2 정렬): the tooltip's placement (`placement` · `offset` ·
 * `crossOffset` · `shouldFlip` · `containerPadding`) is the trigger's prop and reaches the Tooltip by
 * context, as S2 does; RAC `closeDelay` is not taken (S2 omits it).
 */
export function TooltipTrigger({
  isOpen,
  defaultOpen,
  onOpenChange,
  isDisabled,
  delay,
  trigger,
  placement,
  offset,
  crossOffset,
  shouldFlip,
  containerPadding,
  children,
}: TooltipTriggerProps) {
  return (
    <RACTooltipTrigger
      isOpen={isOpen}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      isDisabled={isDisabled}
      delay={delay}
      trigger={trigger}
    >
      <TooltipPlacementContext.Provider
        value={{ placement, offset, crossOffset, shouldFlip, containerPadding }}
      >
        {children}
      </TooltipPlacementContext.Provider>
    </RACTooltipTrigger>
  );
}

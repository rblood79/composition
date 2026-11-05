import {
  ActionButton as SharedActionButton,
  ActionButtonGroup as SharedActionButtonGroup,
  type ActionButtonProps as SharedActionButtonProps,
  type ActionButtonGroupProps,
} from "@composition/shared/components";
import type { ShortcutId } from "../../config/keyboardShortcuts";
import { ActionTooltipTrigger } from "./ActionTooltip";
import "./ActionButton.css";

export interface ActionButtonProps extends Omit<
  SharedActionButtonProps,
  "className"
> {
  tooltip?: string;
  shortcutId?: ShortcutId;
  tooltipPlacement?: "top" | "bottom" | "left" | "right";
  className?: string;
}

/** Builder의 작업 명령. tooltip/shortcut과 chrome 크기를 공통으로 유지한다. */
export function ActionButton({
  tooltip,
  shortcutId,
  tooltipPlacement = "bottom",
  className,
  ...props
}: ActionButtonProps) {
  return (
    <ActionTooltipTrigger
      tooltip={tooltip}
      shortcutId={shortcutId}
      tooltipPlacement={tooltipPlacement}
    >
      <SharedActionButton
        isQuiet
        {...props}
        className={`builder-action-button${className ? ` ${className}` : ""}`}
      />
    </ActionTooltipTrigger>
  );
}

export function ActionButtonGroup({
  className,
  ...props
}: ActionButtonGroupProps) {
  return (
    <SharedActionButtonGroup
      isQuiet
      {...props}
      className={`builder-action-button-group${className ? ` ${className}` : ""}`}
    />
  );
}

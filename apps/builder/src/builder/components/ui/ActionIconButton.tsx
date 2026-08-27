import {
  Button as RACButton,
  type ButtonProps as RACButtonProps,
  ToggleButton as RACToggleButton,
  type ToggleButtonProps as RACToggleButtonProps,
} from "react-aria-components";
import type { ShortcutId } from "../../config/keyboardShortcuts";
import { withActionTooltip } from "./ActionTooltip";
import "./ActionIconButton.css";

// ---------------------------------------------------------------------------
// ActionIconButton (press action)
// ---------------------------------------------------------------------------

export interface ActionIconButtonProps extends Omit<
  RACButtonProps,
  "className"
> {
  /** Plain tooltip text (no shortcut) */
  tooltip?: string;
  /** Shortcut ID — shows description + key combo in tooltip */
  shortcutId?: ShortcutId;
  /** Tooltip placement */
  tooltipPlacement?: "top" | "bottom" | "left" | "right";
  /** Additional CSS class */
  className?: string;
}

export function ActionIconButton({
  tooltip,
  shortcutId,
  tooltipPlacement = "bottom",
  className,
  children,
  ...props
}: ActionIconButtonProps) {
  const button = (
    <RACButton
      {...props}
      className={
        className ? `action-icon-button ${className}` : "action-icon-button"
      }
    >
      {children}
    </RACButton>
  );

  return withActionTooltip(button, { tooltip, shortcutId, tooltipPlacement });
}

// ---------------------------------------------------------------------------
// ActionIconToggleButton (toggle state)
// ---------------------------------------------------------------------------

export interface ActionIconToggleButtonProps extends Omit<
  RACToggleButtonProps,
  "className"
> {
  /** Plain tooltip text (no shortcut) */
  tooltip?: string;
  /** Shortcut ID — shows description + key combo in tooltip */
  shortcutId?: ShortcutId;
  /** Tooltip placement */
  tooltipPlacement?: "top" | "bottom" | "left" | "right";
  /** Additional CSS class */
  className?: string;
}

export function ActionIconToggleButton({
  tooltip,
  shortcutId,
  tooltipPlacement = "bottom",
  className,
  children,
  ...props
}: ActionIconToggleButtonProps) {
  const button = (
    <RACToggleButton
      {...props}
      className={
        className ? `action-icon-button ${className}` : "action-icon-button"
      }
    >
      {children}
    </RACToggleButton>
  );

  return withActionTooltip(button, { tooltip, shortcutId, tooltipPlacement });
}

import type { ReactElement } from "react";
import { SubmenuTrigger } from "react-aria-components/Menu";

export interface UnavailableMenuItemTriggerProps {
  /** The MenuItem, then the Popover holding the help (S2 `ContextualHelpPopover`). */
  children: ReactElement[];
  /** Whether the menu item is currently unavailable (S2 default false). */
  isUnavailable?: boolean;
}

/**
 * S2 `UnavailableMenuItemTrigger` (S2 체크리스트 §9.3 — `Menu.tsx:1074-1091`): unavailable, the item
 * opens its help Popover in place of its action (RAC `SubmenuTrigger`); available, the item alone.
 * The catalog draws the same through its node tree (`domBinding.runtime.ts`
 * `unavailablemenuitemtrigger`) — this is the name the code view writes.
 */
export function UnavailableMenuItemTrigger({
  children,
  isUnavailable = false,
}: UnavailableMenuItemTriggerProps): ReactElement {
  if (!isUnavailable) return children[0]!;
  return <SubmenuTrigger>{children}</SubmenuTrigger>;
}

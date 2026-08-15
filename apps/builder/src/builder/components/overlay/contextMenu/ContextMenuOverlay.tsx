import { useRef } from "react";
import {
  Menu,
  MenuItem,
  Popover,
  Separator,
  SubmenuTrigger,
  Text,
} from "react-aria-components";
import { SHORTCUT_DEFINITIONS } from "../../../config/keyboardShortcuts";
import { formatShortcut } from "../../../hooks";
import type { ContextMenuItem, ContextMenuRequest } from "./types";

export interface ContextMenuOverlayProps {
  isOpen: boolean;
  request: ContextMenuRequest | null;
  items: readonly ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenuOverlay({
  isOpen,
  request,
  items,
  onClose,
}: ContextMenuOverlayProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);

  if (!request) {
    return null;
  }

  return (
    <>
      <span
        ref={anchorRef}
        aria-hidden="true"
        className="context-menu-anchor"
        style={{
          left: request.clientX,
          position: "fixed",
          top: request.clientY,
          width: 0,
          height: 0,
          pointerEvents: "none",
        }}
        tabIndex={-1}
      />
      <Popover
        className="context-menu-popover"
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        placement="bottom start"
        triggerRef={anchorRef}
      >
        <Menu
          aria-label="Context menu"
          className="context-menu"
          onAction={() => undefined}
        >
          {renderContextMenuItems(items, onClose)}
        </Menu>
      </Popover>
    </>
  );
}

function renderContextMenuItems(
  items: readonly ContextMenuItem[],
  onClose: () => void,
) {
  return items.map((item) => {
    if (item.kind === "separator") {
      return <Separator key={item.id} className="context-menu-separator" />;
    }

    if (item.kind === "submenu") {
      return (
        <SubmenuTrigger key={item.id}>
          <MenuItem id={item.id} className="context-menu-item">
            <Text slot="label">{item.label}</Text>
          </MenuItem>
          <Popover className="context-menu-popover" placement="right top">
            <Menu aria-label={item.label} className="context-menu">
              {renderContextMenuItems(item.items, onClose)}
            </Menu>
          </Popover>
        </SubmenuTrigger>
      );
    }

    const shortcut = item.shortcutId
      ? SHORTCUT_DEFINITIONS[item.shortcutId]
      : undefined;
    const shortcutLabel = shortcut
      ? formatShortcut({ key: shortcut.key, modifier: shortcut.modifier })
      : null;

    return (
      <MenuItem
        key={item.id}
        id={item.id}
        className="context-menu-item"
        data-destructive={
          item.kind === "action" && item.destructive ? true : undefined
        }
        onAction={() => {
          void item.run();
          onClose();
        }}
      >
        <Text slot="label">{item.label}</Text>
        {item.kind === "toggle" && item.checked && (
          <span aria-hidden="true" className="context-menu-check">
            ✓
          </span>
        )}
        {shortcutLabel && <kbd>{shortcutLabel}</kbd>}
      </MenuItem>
    );
  });
}

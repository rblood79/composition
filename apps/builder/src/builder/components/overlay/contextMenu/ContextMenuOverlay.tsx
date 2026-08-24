import { useEffect, useRef } from "react";
import { Check, ChevronRight } from "lucide-react";
import {
  Keyboard,
  Menu,
  MenuItem,
  Popover,
  Separator,
  SubmenuTrigger,
  Text,
} from "react-aria-components";
import { SHORTCUT_DEFINITIONS } from "../../../config/keyboardShortcuts";
import { formatShortcut } from "../../../hooks";
import type {
  ContextMenuIcon,
  ContextMenuItem,
  ContextMenuRequest,
} from "./types";
import "./contextMenu.css";

/** header 메뉴 항목 아이콘(BuilderHeader `size={14}`)과 같은 치수. */
const MENU_ICON_SIZE = 14;

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
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !request) return;

    const focusTimer = window.setTimeout(() => {
      menuRef.current?.focus();
    });

    return () => window.clearTimeout(focusTimer);
  }, [isOpen, request]);

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
        isNonModal
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
          ref={menuRef}
        >
          {renderContextMenuItems(items, onClose)}
        </Menu>
      </Popover>
    </>
  );
}

/**
 * 아이콘 열은 **메뉴 단위로** 예약한다 — 한 항목이라도 아이콘이 있으면 나머지는
 * 빈 자리를 받아 라벨 시작선이 맞고, 아무도 없으면 열 자체가 없어 header 이전의
 * 납작한 메뉴 그대로다. 항목마다 조건부로 렌더하면 섞인 메뉴에서 라벨이 어긋난다.
 */
function renderContextMenuItems(
  items: readonly ContextMenuItem[],
  onClose: () => void,
) {
  const reservesIconColumn = items.some(
    (item) => item.kind !== "separator" && item.icon !== undefined,
  );

  return items.map((item) => {
    if (item.kind === "separator") {
      return <Separator key={item.id} className="context-menu-separator" />;
    }

    const icon = reservesIconColumn ? (
      <ContextMenuItemIcon icon={item.icon} />
    ) : null;

    if (item.kind === "submenu") {
      return (
        <SubmenuTrigger key={item.id}>
          <MenuItem id={item.id} className="context-menu-item">
            {icon}
            <Text className="context-menu-item-label" slot="label">
              {item.label}
            </Text>
            <ChevronRight
              aria-hidden="true"
              className="context-menu-chevron"
              size={MENU_ICON_SIZE}
            />
          </MenuItem>
          <Popover
            className="context-menu-popover"
            isNonModal
            placement="right top"
          >
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
        {icon}
        <Text className="context-menu-item-label" slot="label">
          {item.label}
        </Text>
        {item.kind === "toggle" && item.checked && (
          <Check
            aria-hidden="true"
            className="context-menu-check"
            size={MENU_ICON_SIZE}
          />
        )}
        {shortcutLabel && <Keyboard>{shortcutLabel}</Keyboard>}
      </MenuItem>
    );
  });
}

/** 아이콘 자리 — 아이콘이 없는 항목도 같은 폭을 차지해 라벨 시작선을 맞춘다. */
function ContextMenuItemIcon({ icon: Icon }: { icon?: ContextMenuIcon }) {
  return (
    <span aria-hidden="true" className="context-menu-item-icon">
      {Icon ? <Icon size={MENU_ICON_SIZE} /> : null}
    </span>
  );
}

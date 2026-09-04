import {
  SHORTCUT_DEFINITIONS,
  type ShortcutId,
} from "../../config/keyboardShortcuts";
import { formatShortcut } from "@/builder/hooks";

/** 정의에서 파생한 단축키 표기 — 정의가 없으면 undefined. */
export function shortcutDisplayFor(
  shortcutId: ShortcutId | undefined,
): string | undefined {
  const def = shortcutId ? SHORTCUT_DEFINITIONS[shortcutId] : undefined;
  return def
    ? formatShortcut({ key: def.key, modifier: def.modifier })
    : undefined;
}

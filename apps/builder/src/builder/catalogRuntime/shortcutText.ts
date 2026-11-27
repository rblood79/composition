/**
 * A MenuItem's shortcut text (its RAC `Keyboard` child's `children` — S2 `<Keyboard>⌘C</Keyboard>`)
 * as modifiers + a key, for the Design panel's shortcut field (사용자 결정 2026-11-28: 「토글 버튼
 * 그룹 (⌘ · ⌥ · ⇧) + 키 입력」, 「cmd 가 아닌 ⌘, 운영체제에 따라서 토글 버튼이 다르게」).
 *
 * The document keeps the text only (D2 — RAC `Keyboard` takes text): the field writes the Builder
 * platform's own way of writing a shortcut — macOS glyphs in Apple's order with no separator
 * (`⌃⌥⇧⌘K`), elsewhere names joined by `+` (`Ctrl+Alt+Shift+K`). A text the field cannot read back
 * (free words, the other platform's way) stays a free text.
 */
import { MAC_MODIFIER_GLYPHS } from "../hooks/useKeyboardShortcutsRegistry";

export type ShortcutPlatform = "mac" | "other";
export type ShortcutModifier = "ctrl" | "alt" | "shift" | "meta";

export interface ShortcutModifierSpec {
  readonly modifier: ShortcutModifier;
  /** What the toggle shows and the text carries. */
  readonly label: string;
  /** The toggle's accessible name. */
  readonly name: string;
}

/** Each platform's modifiers in the order its shortcuts are written (Apple HIG: ⌃ ⌥ ⇧ ⌘). */
export const SHORTCUT_MODIFIERS: Readonly<
  Record<ShortcutPlatform, readonly ShortcutModifierSpec[]>
> = {
  mac: [
    { modifier: "ctrl", label: MAC_MODIFIER_GLYPHS.ctrl, name: "Control" },
    { modifier: "alt", label: MAC_MODIFIER_GLYPHS.alt, name: "Option" },
    { modifier: "shift", label: MAC_MODIFIER_GLYPHS.shift, name: "Shift" },
    { modifier: "meta", label: MAC_MODIFIER_GLYPHS.meta, name: "Command" },
  ],
  other: [
    { modifier: "ctrl", label: "Ctrl", name: "Ctrl" },
    { modifier: "alt", label: "Alt", name: "Alt" },
    { modifier: "shift", label: "Shift", name: "Shift" },
  ],
};

export interface ShortcutParts {
  readonly modifiers: ReadonlySet<ShortcutModifier>;
  readonly key: string;
}

/** The Builder's platform (the one whose way of writing the field uses). */
export function shortcutPlatform(
  platform: string | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator.platform,
): ShortcutPlatform {
  return platform?.includes("Mac") ? "mac" : "other";
}

/** An unfilled template text (`{shortcut}`) or nothing — no shortcut yet. */
const EMPTY = /^\s*(\{\w+\})?\s*$/;

/**
 * Read a text back as modifiers + key in the platform's way; `null` = not this platform's way
 * (the field shows it as a free text).
 */
export function parseShortcutText(
  text: string,
  platform: ShortcutPlatform,
): ShortcutParts | null {
  if (EMPTY.test(text)) return { modifiers: new Set(), key: "" };
  const specs = SHORTCUT_MODIFIERS[platform];
  const modifiers = new Set<ShortcutModifier>();
  if (platform === "mac") {
    let rest = [...text.trim()];
    for (;;) {
      const spec = specs.find((item) => item.label === rest[0]);
      if (!spec || modifiers.has(spec.modifier)) break;
      modifiers.add(spec.modifier);
      rest = rest.slice(1);
    }
    const key = rest.join("");
    // (A glyph after the key, or a `+`-joined name, is not a macOS shortcut.)
    if (specs.some((item) => key.includes(item.label)) || key.includes("+"))
      return null;
    return { modifiers, key };
  }
  // (macOS glyphs are the other platform's way.)
  if (SHORTCUT_MODIFIERS.mac.some((item) => text.includes(item.label)))
    return null;
  const tokens = text.split("+").map((token) => token.trim());
  const key = tokens.pop() ?? "";
  for (const token of tokens) {
    const spec = specs.find(
      (item) => item.label.toLowerCase() === token.toLowerCase(),
    );
    if (!spec || modifiers.has(spec.modifier)) return null;
    modifiers.add(spec.modifier);
  }
  return { modifiers, key };
}

/** A single letter key is written in capitals (`⌘K`, `Ctrl+K`). */
function keyText(key: string): string {
  const trimmed = key.trim();
  return [...trimmed].length === 1 ? trimmed.toUpperCase() : trimmed;
}

/** Write modifiers + key in the platform's way; `""` = no shortcut. */
export function formatShortcutText(
  parts: ShortcutParts,
  platform: ShortcutPlatform,
): string {
  const key = keyText(parts.key);
  const labels = SHORTCUT_MODIFIERS[platform]
    .filter((spec) => parts.modifiers.has(spec.modifier))
    .map((spec) => spec.label);
  if (!labels.length) return key;
  return platform === "mac"
    ? `${labels.join("")}${key}`
    : [...labels, ...(key ? [key] : [])].join("+");
}

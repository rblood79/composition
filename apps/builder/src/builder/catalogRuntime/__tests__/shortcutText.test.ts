import { describe, expect, it } from "vitest";
import {
  formatShortcutText,
  parseShortcutText,
  shortcutPlatform,
  type ShortcutModifier,
} from "../shortcutText";

/**
 * A MenuItem's shortcut text ↔ modifier toggles + a key (사용자 결정 2026-11-28 — 「cmd 가 아닌 ⌘,
 * 운영체제에 따라서 토글 버튼이 다르게」): macOS writes glyphs in Apple's order with no separator,
 * elsewhere names joined by `+`; a text not in the platform's way stays free text.
 */
const parts = (modifiers: ShortcutModifier[], key: string) => ({
  modifiers: new Set(modifiers),
  key,
});

describe("shortcut text", () => {
  it("the platform is the Builder's", () => {
    expect(shortcutPlatform("MacIntel")).toBe("mac");
    expect(shortcutPlatform("Win32")).toBe("other");
  });

  it("macOS: glyphs in ⌃ ⌥ ⇧ ⌘ order, no separator, a letter in capitals", () => {
    expect(formatShortcutText(parts(["meta", "shift"], "k"), "mac")).toBe(
      "⇧⌘K",
    );
    expect(
      formatShortcutText(parts(["meta", "alt", "ctrl", "shift"], "F2"), "mac"),
    ).toBe("⌃⌥⇧⌘F2");
    expect(formatShortcutText(parts([], "Enter"), "mac")).toBe("Enter");
    expect(formatShortcutText(parts(["meta"], ""), "mac")).toBe("⌘");
  });

  it("elsewhere: names joined by +", () => {
    expect(formatShortcutText(parts(["shift", "ctrl"], "k"), "other")).toBe(
      "Ctrl+Shift+K",
    );
    expect(formatShortcutText(parts(["alt"], ""), "other")).toBe("Alt");
  });

  it("reads its own text back", () => {
    for (const [platform, modifiers, key] of [
      ["mac", ["ctrl", "meta"], "C"],
      ["mac", [], "Delete"],
      ["other", ["ctrl", "alt", "shift"], "F5"],
    ] as const) {
      const text = formatShortcutText(parts([...modifiers], key), platform);
      const back = parseShortcutText(text, platform)!;
      expect([...back.modifiers].sort()).toEqual([...modifiers].sort());
      expect(back.key).toBe(key);
    }
  });

  it("no shortcut yet: the template's unfilled `{shortcut}` · nothing", () => {
    for (const text of ["{shortcut}", "", "  "])
      expect(parseShortcutText(text, "mac")).toEqual(parts([], ""));
  });

  it("another platform's way or free words stay free text", () => {
    expect(parseShortcutText("Ctrl+K", "mac")).toBeNull();
    expect(parseShortcutText("⌘K", "other")).toBeNull();
    expect(parseShortcutText("Hyper+K", "other")).toBeNull();
    expect(parseShortcutText("K⌘", "mac")).toBeNull();
  });
});

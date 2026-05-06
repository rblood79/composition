import { describe, expect, it } from "vitest";
import { SHORTCUT_DEFINITIONS } from "./keyboardShortcuts";

describe("keyboardShortcuts ADR-112 editing semantics", () => {
  it("registers Pencil-compatible component shortcuts", () => {
    expect(SHORTCUT_DEFINITIONS.toggleComponentOrigin).toMatchObject({
      key: "k",
      modifier: "cmdAlt",
      scope: ["canvas-focused", "panel:properties"],
    });
    expect(SHORTCUT_DEFINITIONS.detachInstance).toMatchObject({
      key: "x",
      modifier: "cmdAlt",
      scope: ["canvas-focused", "panel:properties"],
      capture: true,
    });
  });
});

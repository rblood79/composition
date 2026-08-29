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

  it("registers the global Workflow overlay shortcut without conflicting with Alt+W", () => {
    expect(SHORTCUT_DEFINITIONS.toggleWorkflowOverlay).toMatchObject({
      key: "w",
      code: "KeyW",
      modifier: "ctrlAlt",
      scope: "global",
      allowInInput: true,
    });
  });

  it("uses the canonical Navigator command id and label", () => {
    expect(SHORTCUT_DEFINITIONS.toggleNavigator).toMatchObject({
      description: "Toggle Navigator Panel",
      i18n: { ko: "탐색기 패널 토글" },
    });
  });
});

import { describe, expect, it } from "vitest";
import { localizedStrings } from "@/i18n/translations";
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
    });
    // 라벨의 언어는 정의가 아니라 카탈로그가 고른다 (ADR-200) — 정의에는
    // i18n 필드가 없고, 두 locale 이 각각 command.toggleNavigator 를 갖는다.
    expect(localizedStrings["ko-KR"]["command.toggleNavigator"]).toBe(
      "탐색기 패널 토글",
    );
    expect(localizedStrings["en-US"]["command.toggleNavigator"]).toBe(
      "Toggle Navigator Panel",
    );
  });
});

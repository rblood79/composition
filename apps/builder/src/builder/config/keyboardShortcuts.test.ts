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

// 2026-10-05 감사 L5 — macOS 에서 ⌥ 는 event.key 를 옵션 문자 ("˚" · "≈") 로 바꾼다. ⌥ 가 들어간
// 정의는 물리 키 `code` 로 비교해야 한다 (없으면 ⌘⌥K · ⌘⌥X 가 키보드로 실행되지 않았다).
describe("⌥ 조합은 code 로 매칭한다", () => {
  it("modifier 에 alt 가 있는 정의는 전부 code 를 가진다", () => {
    const missing = Object.entries(SHORTCUT_DEFINITIONS)
      .filter(([, def]) => /alt/i.test(String(def.modifier)))
      .filter(([, def]) => !("code" in def) || !def.code)
      .map(([id]) => id);
    expect(missing).toEqual([]);
  });
});

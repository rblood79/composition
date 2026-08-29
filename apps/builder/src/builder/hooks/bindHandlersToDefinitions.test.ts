import { describe, expect, it } from "vitest";
import { SHORTCUT_DEFINITIONS } from "../config/keyboardShortcuts";
import { bindHandlersToDefinitions } from "./useKeyboardShortcutsRegistry";

/**
 * 2026-08-27 code-review #13 후속 — 등록이 key/modifier/scope 를 손으로 적으면
 * 정의와 갈린다 (⌘D 는 scope 누락으로 global, 나머지 15건도 같은 상태였다).
 * 등록 표면(useGlobalKeyboardShortcuts · CanvasSelectionShortcuts)은 이 함수를
 * 거쳐 정의에서 전부 읽는다.
 */
describe("bindHandlersToDefinitions", () => {
  it("scope·priority·capture 를 정의에서 읽고, 핸들러 없는 id 는 등록하지 않는다", () => {
    const noop = () => {};
    const bound = bindHandlersToDefinitions(
      ["duplicate", "selectAll", "detachInstance", "copyStyles", "undo"],
      {
        duplicate: noop,
        selectAll: noop,
        detachInstance: noop,
        copyStyles: noop,
        // undo: 핸들러 없음 → 제외
      },
    );

    expect(bound.map((s) => s.description)).toEqual([
      SHORTCUT_DEFINITIONS.duplicate.description,
      SHORTCUT_DEFINITIONS.selectAll.description,
      SHORTCUT_DEFINITIONS.detachInstance.description,
      SHORTCUT_DEFINITIONS.copyStyles.description,
    ]);

    const [duplicate, selectAll, detach, copyStyles] = bound;
    expect(duplicate.scope).toEqual(["canvas-focused", "panel:navigator"]);
    expect(selectAll.scope).toBe("canvas-focused");
    expect(copyStyles.scope).toBe("panel:styles");
    expect(detach.stopPropagation).toBe(true); // capture: true
    expect(duplicate.priority).toBe(SHORTCUT_DEFINITIONS.duplicate.priority);
    expect(duplicate.key).toBe("d");
    expect(duplicate.modifier).toBe("cmd");
    expect(bound.every((s) => s.preventDefault === true)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { SHORTCUT_DEFINITIONS } from "../../config/keyboardShortcuts";
import { matchesScope } from "../../hooks/useActiveScope";

/**
 * 2026-08-27 code-review #13 — ⌘D 등록에 scope 가 없어 registry 가 global 로
 * 간주했다 (`if (!shortcutScope) return true`). 열린 모달의 버튼에 포커스가
 * 있어도 뒤의 캔버스 선택이 복제됐다. Figma/Pen 처럼 "선택을 만든 자리"
 * (캔버스 · 레이어 트리) 에서만 발동한다. 실제 등록(`CanvasSelectionShortcuts`)
 * 은 `bindHandlersToDefinitions` 로 정의를 통째로 읽으므로 두 곳이 갈릴 수 없다
 * (매핑 자체는 `hooks/bindHandlersToDefinitions.test.ts`).
 */
describe("⌘D duplicate scope (code-review #13)", () => {
  it("모달·텍스트 편집에서는 매칭되지 않고 캔버스·레이어 트리에서만 매칭된다", () => {
    const scope = SHORTCUT_DEFINITIONS.duplicate.scope;
    expect(scope).toEqual(["canvas-focused", "panel:nodes"]);

    expect(matchesScope(scope, "canvas-focused")).toBe(true);
    expect(matchesScope(scope, "panel:nodes")).toBe(true);

    expect(matchesScope(scope, "modal")).toBe(false);
    expect(matchesScope(scope, "text-editing")).toBe(false);
    expect(matchesScope(scope, "global")).toBe(false);
    expect(matchesScope(scope, "panel:properties")).toBe(false);
  });
});

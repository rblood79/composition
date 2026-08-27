import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SHORTCUT_DEFINITIONS } from "../../config/keyboardShortcuts";
import { matchesScope } from "../../hooks/useActiveScope";

/**
 * 2026-08-27 code-review #13 — ⌘D 등록에 scope 가 없어 registry 가 global 로
 * 간주했다 (`if (!shortcutScope) return true`). 열린 모달의 버튼에 포커스가
 * 있어도 뒤의 캔버스 선택이 복제됐다. Figma/Pen 처럼 "선택을 만든 자리"
 * (캔버스 · 레이어 트리) 에서만 발동한다.
 */
describe("⌘D duplicate scope (code-review #13)", () => {
  it("모달·텍스트 편집에서는 매칭되지 않고 캔버스·레이어 트리에서만 매칭된다", () => {
    const scope = SHORTCUT_DEFINITIONS.duplicate.scope;

    expect(matchesScope(scope, "canvas-focused")).toBe(true);
    expect(matchesScope(scope, "panel:nodes")).toBe(true);

    expect(matchesScope(scope, "modal")).toBe(false);
    expect(matchesScope(scope, "text-editing")).toBe(false);
    expect(matchesScope(scope, "global")).toBe(false);
    expect(matchesScope(scope, "panel:properties")).toBe(false);
  });

  it("실제 핸들러 등록이 선언 계약과 같은 scope 를 쓴다", async () => {
    // 등록이 scope 를 생략하면 registry 가 global 로 간주해 선언은 치트시트
    // 표기용으로만 남는다 — 두 곳이 갈리지 않도록 소스로 고정한다.
    const source = await readFile(
      resolve(__dirname, "CanvasSelectionShortcuts.tsx"),
      "utf8",
    );

    expect(source).toContain(
      'scope: ["canvas-focused", "panel:nodes"] as const,',
    );
    expect(SHORTCUT_DEFINITIONS.duplicate.scope).toEqual([
      "canvas-focused",
      "panel:nodes",
    ]);
  });
});

/**
 * 2026-10-05 감사 M3 — Interactions 패널 (`panel:events`) 에 포커스가 있을 때 키보드
 * Backspace · Delete · ⌘C · ⌘V 가 캔버스 선택 요소를 지우거나 붙여 넣지 않는다.
 * 옛 `createScopedHandler` 규칙: 키보드는 activeScope 로, 메뉴는 넘긴 scope 로 가른다.
 */
import { describe, expect, it, vi } from "vitest";

import { catalogDocumentShortcutHandler } from "../useCatalogGlobalShortcuts";

describe("catalogDocumentShortcutHandler", () => {
  it.each(["delete", "deleteAlt", "copy", "paste"] as const)(
    "%s — panel:events 키보드 입력은 실행하지 않는다",
    (id) => {
      const run = vi.fn();
      catalogDocumentShortcutHandler(id, "panel:events", run)();
      expect(run).not.toHaveBeenCalled();
    },
  );

  it("메뉴가 canvas scope 를 넘기면 panel:events 포커스여도 실행한다", () => {
    const run = vi.fn();
    catalogDocumentShortcutHandler(
      "delete",
      "panel:events",
      run,
    )({
      scope: "canvas-focused",
    });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("canvas 포커스 · 다른 명령은 그대로 실행한다", () => {
    const run = vi.fn();
    catalogDocumentShortcutHandler("delete", "canvas-focused", run)();
    catalogDocumentShortcutHandler("undo", "panel:events", run)();
    expect(run).toHaveBeenCalledTimes(2);
  });
});

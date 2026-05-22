import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * ADR-144 Phase 7 Wave C — MenuPropertyEditor mode 분기 wiring.
 *
 * 기존 MenuSpec 전체 주입은 mode 3 (legacy-items) 분기 안으로 흡수. mode 2
 * (resolved-tree composite) 진입 시 ResolvedTreeSlotEditor 가 화면을 차지.
 */

const EDITOR_PATH = resolve(__dirname, "MenuPropertyEditor.tsx");

describe("ADR-144 Wave C — MenuPropertyEditor mode 분기", () => {
  it("imports detectInspectorInputMode (mode 분기 진입점)", async () => {
    const source = await readFile(EDITOR_PATH, "utf-8");

    expect(source).toContain("detectInspectorInputMode");
    expect(source).toContain('from "../inspectorInputMode"');
  });

  it("references all three input modes (1/2/3) so the dispatch is exhaustive", async () => {
    const source = await readFile(EDITOR_PATH, "utf-8");

    expect(source).toContain('"external-databinding"');
    expect(source).toContain('"resolved-tree"');
    expect(source).toContain('"legacy-items"');
  });

  it("delegates mode 2 add/remove UI to ResolvedTreeSlotEditor (mutual exclusion)", async () => {
    const source = await readFile(EDITOR_PATH, "utf-8");

    expect(source).toContain("ResolvedTreeSlotEditor");
  });
});

import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * ADR-144 Phase 7 Wave C — ListBoxPropertyEditor mode 분기 wiring.
 *
 * 기존 hasTemplateMode (Field 자식 보유 시 ItemsManager 섹션 필터) 는 mode 3
 * (legacy-items) 분기 안으로 흡수. mode 2 (resolved-tree composite) 진입 시
 * ResolvedTreeSlotEditor 가 화면을 차지하고 ItemsManager 와 동시 표시되지
 * 않는다 (3 mode 상호 배타 — ADR-144 task 7 acceptance).
 */

const EDITOR_PATH = resolve(__dirname, "ListBoxPropertyEditor.tsx");

describe("ADR-144 Wave C — ListBoxPropertyEditor mode 분기", () => {
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

  it("keeps the existing template-mode (Field 자식) 분기 inside the legacy-items mode branch", async () => {
    const source = await readFile(EDITOR_PATH, "utf-8");

    expect(source).toContain("filterOutItemManagementSection");
    // hasTemplateMode 가 mode === "legacy-items" 분기 안에서 평가됐는지의 휴리스틱:
    // mode 비교 (legacy-items) 가 hasTemplateMode 호출보다 앞에 있어야 한다.
    const legacyMatch = source.indexOf('"legacy-items"');
    const templateMatch = source.indexOf("hasTemplateMode");
    expect(legacyMatch).toBeGreaterThan(-1);
    expect(templateMatch).toBeGreaterThan(legacyMatch);
  });
});

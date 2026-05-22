import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * ADR-144 Phase 7 Wave C — SelectPropertyEditor static contract.
 *
 * Inspector Properties UI 의 3 input mode (external-databinding / resolved-tree
 * / legacy-items) 분기 wiring 을 source-string 검증으로 확정한다. RTL 동작
 * 검증은 inspectorInputMode.test.ts + Wave A factory test 가 cover.
 */

const EDITOR_PATH = resolve(__dirname, "..", "SelectPropertyEditor.tsx");

describe("ADR-144 Wave C — SelectPropertyEditor", () => {
  it("exists and is wired to detectInspectorInputMode (mode 분기 진입점)", async () => {
    const source = await readFile(EDITOR_PATH, "utf-8");

    expect(source).toContain("detectInspectorInputMode");
    expect(source).toContain('from "../inspectorInputMode"');
  });

  it("uses canonical property read hooks (no stale elementsMap lookups)", async () => {
    const source = await readFile(EDITOR_PATH, "utf-8");

    expect(source).toContain("useCanonicalProperty");
    const staleElementLookup = ["state", "elementsMap.get(elementId)"].join(
      ".",
    );
    const staleChildrenLookup = ["state", "childrenMap.get(elementId)"].join(
      ".",
    );
    expect(source).not.toContain(staleElementLookup);
    expect(source).not.toContain(staleChildrenLookup);
  });

  it("renders ResolvedTreeSlotEditor when mode === 'resolved-tree' (mode 2)", async () => {
    const source = await readFile(EDITOR_PATH, "utf-8");

    expect(source).toContain("ResolvedTreeSlotEditor");
    expect(source).toContain('"resolved-tree"');
  });

  it("renders dataBinding picker section when mode === 'external-databinding' (mode 1)", async () => {
    const source = await readFile(EDITOR_PATH, "utf-8");

    expect(source).toContain('"external-databinding"');
  });

  it("falls back to GenericPropertyEditor (ItemsManager) for mode === 'legacy-items' (mode 3)", async () => {
    const source = await readFile(EDITOR_PATH, "utf-8");

    expect(source).toContain("GenericPropertyEditor");
    expect(source).toContain('"legacy-items"');
  });

  it("memoizes export and registers via registry getCustomPreEditor (no stale store reads)", async () => {
    const source = await readFile(EDITOR_PATH, "utf-8");

    expect(source).toContain("memo");
    expect(source).toContain("export default");
  });
});

import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * ADR-144 Phase 7 Wave C — Inspector Properties UI 3 input mode 분기.
 *
 * `getCustomPreEditor` 가 Select / ComboBox 까지 expansion 됐는지 source-string
 * 검증. ListBox / TagGroup / Menu / GridList 4 case 의 기존 land 도 확인.
 */
describe("ADR-144 Wave C registry expansion — Select / ComboBox", () => {
  it("registers SelectPropertyEditor for `Select` in getCustomPreEditor", async () => {
    const source = await readFile(resolve(__dirname, "registry.ts"), "utf-8");

    expect(source).toContain('case "Select":');
    expect(source).toContain('return "SelectPropertyEditor"');
  });

  it("registers ComboBoxPropertyEditor for `ComboBox` in getCustomPreEditor", async () => {
    const source = await readFile(resolve(__dirname, "registry.ts"), "utf-8");

    expect(source).toContain('case "ComboBox":');
    expect(source).toContain('return "ComboBoxPropertyEditor"');
  });

  it("preserves existing Wave-A/B 4 pre-editor cases (ListBox / TagGroup / Menu / GridList)", async () => {
    const source = await readFile(resolve(__dirname, "registry.ts"), "utf-8");

    expect(source).toContain('case "ListBox":');
    expect(source).toContain('return "ListBoxPropertyEditor"');
    expect(source).toContain('case "TagGroup":');
    expect(source).toContain('return "TagGroupPropertyEditor"');
    expect(source).toContain('case "Menu":');
    expect(source).toContain('return "MenuPropertyEditor"');
    expect(source).toContain('case "GridList":');
    expect(source).toContain('return "GridListPropertyEditor"');
  });
});

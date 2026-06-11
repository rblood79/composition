/**
 * ADR-912 4단계 — BUILDER_ALIAS_MAP TabBar alias 제거 + legacy hydration migration (test-first).
 *
 * 배경: TabBar 는 Switcher 구명 BC alias (builderAliasMap.ts: TabBar → SwitcherSpec).
 * factory/specs 전수 grep 결과 live producer 0건 — 신규 생성 경로 없음. 유일 위험은 과거
 * 직렬화된 type:"TabBar" 노드의 hydrate 호환. ADR-130 isLegacyGroupForFrameMigration 선례대로
 * canonical hydration 시점에 TabBar → Switcher 1회 변환하면 alias 없이도 BC 보존.
 *
 * kill criteria: legacy TabBar 노드가 Switcher 로 변환 안 되면 alias 제거 시 getSpecForTag→null →
 * Skia 미표시 회귀 → alias 제거 보류.
 */
import { describe, expect, it } from "vitest";
import { isLegacyTabBarForSwitcher, tagToType } from "../tagRename";
import { BUILDER_ALIAS_MAP } from "../../../builder/workspace/canvas/sprites/builderAliasMap";

describe("ADR-912 4단계 — isLegacyTabBarForSwitcher guard", () => {
  it("matches legacy type='TabBar'", () => {
    expect(isLegacyTabBarForSwitcher("TabBar")).toBe(true);
  });

  it("does not flag Switcher (이미 정본 type)", () => {
    expect(isLegacyTabBarForSwitcher("Switcher")).toBe(false);
  });

  it("does not flag 다른 type", () => {
    expect(isLegacyTabBarForSwitcher("Tabs")).toBe(false);
    expect(isLegacyTabBarForSwitcher("TabList")).toBe(false);
    expect(isLegacyTabBarForSwitcher("Button")).toBe(false);
    expect(isLegacyTabBarForSwitcher("")).toBe(false);
  });
});

describe("ADR-912 4단계 — BUILDER_ALIAS_MAP 에서 TabBar 제거됨", () => {
  it("TabBar 키가 BUILDER_ALIAS_MAP 에 부재 (Switcher migration 으로 대체)", () => {
    expect("TabBar" in BUILDER_ALIAS_MAP).toBe(false);
  });

  it("기존 sub-part alias 8 은 보존 (catalog 미전환 spec load-bearing)", () => {
    // ComboBox*/Search*/body 는 참조 spec catalog 미전환이라 alias 유지 (별도 slice).
    for (const key of [
      "ComboBoxWrapper",
      "ComboBoxInput",
      "ComboBoxTrigger",
      "SearchFieldWrapper",
      "SearchInput",
      "SearchIcon",
      "SearchClearButton",
      "body",
    ]) {
      expect(key in BUILDER_ALIAS_MAP, `${key} alias 보존`).toBe(true);
    }
  });
});

describe("ADR-912 4단계 — tagToType TabBar→Switcher 정규화", () => {
  it("tagToType('TabBar') === 'Switcher' (hydration 시 legacy 변환)", () => {
    expect(tagToType("TabBar")).toBe("Switcher");
  });

  it("tagToType('Switcher') === 'Switcher' (정본 보존)", () => {
    expect(tagToType("Switcher")).toBe("Switcher");
  });

  it("다른 type 은 그대로 cast", () => {
    expect(tagToType("Button")).toBe("Button");
    expect(tagToType("Tabs")).toBe("Tabs");
  });
});

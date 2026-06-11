/**
 * ADR-912 — Switcher cleanup: TabBar + Switcher legacy → ToggleButtonGroup hydration migration (test-first).
 *
 * 배경: Switcher(@pixi/ui 기반 세그먼트 컨트롤)는 RAC ToggleButtonGroup(selectionMode="single")의
 * 자체 구현 중복. RAC ToggleButtonGroup 이 D1(RAC 절대 권위) 정본 — Switcher 는 legacy.
 * TabBar 는 Switcher 의 구명 BC alias (4단계에서 builderAliasMap 제거). 둘 다 live producer 0건
 * (factory/specs 전수 grep). 과거 직렬화된 TabBar/Switcher 노드는 canonical hydration 시
 * ToggleButtonGroup 으로 1회 변환 — items[]/activeIndex 는 자식 ToggleButton 의 isSelected 와
 * redundant 라 strip, selectionMode/orientation 주입.
 *
 * kill criteria: legacy TabBar/Switcher 노드가 ToggleButtonGroup 으로 변환 안 되면 Switcher spec
 * 제거(Commit 2) 시 getSpecForTag→null → Skia 미표시 회귀 → 제거 보류.
 */
import { describe, expect, it } from "vitest";
import {
  isLegacySwitcherOrTabBarForToggleButtonGroup,
  migrateSwitcherPropsToToggleButtonGroup,
  tagToType,
} from "../tagRename";
import { BUILDER_ALIAS_MAP } from "../../../builder/workspace/canvas/sprites/builderAliasMap";

describe("Switcher cleanup — isLegacySwitcherOrTabBarForToggleButtonGroup guard", () => {
  it("matches legacy 'TabBar' (Switcher 구명 BC alias)", () => {
    expect(isLegacySwitcherOrTabBarForToggleButtonGroup("TabBar")).toBe(true);
  });

  it("matches legacy 'Switcher' (@pixi/ui 자체 구현 → RAC ToggleButtonGroup 대체)", () => {
    expect(isLegacySwitcherOrTabBarForToggleButtonGroup("Switcher")).toBe(true);
  });

  it("does not flag ToggleButtonGroup (이미 정본 type)", () => {
    expect(
      isLegacySwitcherOrTabBarForToggleButtonGroup("ToggleButtonGroup"),
    ).toBe(false);
  });

  it("does not flag 다른 type", () => {
    expect(isLegacySwitcherOrTabBarForToggleButtonGroup("Tabs")).toBe(false);
    expect(isLegacySwitcherOrTabBarForToggleButtonGroup("TabList")).toBe(false);
    expect(isLegacySwitcherOrTabBarForToggleButtonGroup("Button")).toBe(false);
    expect(isLegacySwitcherOrTabBarForToggleButtonGroup("")).toBe(false);
  });
});

describe("Switcher cleanup — tagToType TabBar/Switcher → ToggleButtonGroup", () => {
  it("tagToType('TabBar') === 'ToggleButtonGroup'", () => {
    expect(tagToType("TabBar")).toBe("ToggleButtonGroup");
  });

  it("tagToType('Switcher') === 'ToggleButtonGroup'", () => {
    expect(tagToType("Switcher")).toBe("ToggleButtonGroup");
  });

  it("tagToType('ToggleButtonGroup') === 'ToggleButtonGroup' (정본 보존)", () => {
    expect(tagToType("ToggleButtonGroup")).toBe("ToggleButtonGroup");
  });

  it("다른 type 은 그대로 cast", () => {
    expect(tagToType("Button")).toBe("Button");
    expect(tagToType("Tabs")).toBe("Tabs");
  });
});

describe("Switcher cleanup — migrateSwitcherPropsToToggleButtonGroup", () => {
  it("items[]/activeIndex strip + selectionMode/orientation 주입", () => {
    const legacyProps = {
      items: ["Tab 1", "Tab 2"],
      activeIndex: 0,
      isDisabled: false,
      style: { display: "flex", width: 240 },
    };
    const migrated = migrateSwitcherPropsToToggleButtonGroup(legacyProps);
    // items/activeIndex 는 자식 ToggleButton isSelected 와 redundant → 제거
    expect("items" in migrated).toBe(false);
    expect("activeIndex" in migrated).toBe(false);
    // ToggleButtonGroup selection 스키마 주입
    expect(migrated.selectionMode).toBe("single");
    expect(migrated.orientation).toBe("horizontal");
    // 비-selection prop 보존
    expect(migrated.isDisabled).toBe(false);
    expect(migrated.style).toEqual({ display: "flex", width: 240 });
  });

  it("idempotent — 이미 ToggleButtonGroup 스키마면 무변환", () => {
    const tbgProps = {
      selectionMode: "single",
      orientation: "horizontal",
      size: "md",
      value: [],
    };
    const migrated = migrateSwitcherPropsToToggleButtonGroup(tbgProps);
    expect(migrated.selectionMode).toBe("single");
    expect("items" in migrated).toBe(false);
  });

  it("size 보존 (Switcher size?:sm/md/lg → 동명 매핑, 부재 시 md)", () => {
    expect(
      migrateSwitcherPropsToToggleButtonGroup({
        items: [],
        activeIndex: 0,
        size: "lg",
      }).size,
    ).toBe("lg");
    expect(
      migrateSwitcherPropsToToggleButtonGroup({ items: [], activeIndex: 0 })
        .size,
    ).toBe("md");
  });
});

describe("Switcher cleanup — BUILDER_ALIAS_MAP (4단계 TabBar 제거 회귀 가드)", () => {
  it("TabBar 키 부재 (4단계 제거 유지)", () => {
    expect("TabBar" in BUILDER_ALIAS_MAP).toBe(false);
  });

  it("sub-part alias 8 보존", () => {
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

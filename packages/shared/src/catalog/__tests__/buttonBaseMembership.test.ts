import { describe, expect, it } from "vitest";
import {
  getComponentRulesTable,
  usesButtonBaseUtility,
} from "../resolvers/resolveComponentRule";

/**
 * `.button-base` utility membership 계약 (2026-08-14) — 구 3벌 손 미러
 * (preview `BUTTON_BASE_TYPES` / Skia `BUTTON_BASE_PARENT_TAGS`) 를 catalog 파생
 * `usesButtonBaseUtility` 로 단일화하면서, 이관 시점의 membership 이 그대로임을 잠근다.
 * 신규 button-base 컴포넌트는 `componentRulesTable.ts` 의 `structure.cssEmitMode:
 * "button-base"` 또는 `structure.buttonBase: true` 선언으로 추가하고 본 기대값을 갱신한다.
 */
describe("usesButtonBaseUtility — catalog 파생 membership", () => {
  it("Button/ToggleButton(cssEmitMode) + ToggleButtonGroup(buttonBase) 3개가 전부다", () => {
    const members = Object.keys(getComponentRulesTable()).filter((type) =>
      usesButtonBaseUtility(type),
    );
    expect(members.sort()).toEqual([
      "Button",
      "ToggleButton",
      "ToggleButtonGroup",
    ]);
  });

  it("미등록 type 은 false", () => {
    expect(usesButtonBaseUtility("Text")).toBe(false);
    expect(usesButtonBaseUtility("ButtonGroup")).toBe(false);
    expect(usesButtonBaseUtility("NotARealComponent")).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import type { StoredComboBoxItem } from "../types/combobox-items";

/**
 * ADR-158 Phase 4 후속 (2026-08-17): `onActionId` / `RuntimeComboBoxItem` /
 * `toRuntimeComboBoxItem` 케이스는 채널 제거와 함께 삭제 — ComboBox item action
 * 은 RAC 특수 케이스("Create" 류)뿐 정규 어휘가 아니고, 렌더러는 Stored 모델을
 * 직접 소비한다.
 */
describe("StoredComboBoxItem", () => {
  it("required fields: id + label", () => {
    const minimal: StoredComboBoxItem = { id: "a", label: "A" };
    expect(minimal.id).toBe("a");
    expect(minimal.label).toBe("A");
  });

  it("optional fields compile", () => {
    const full: StoredComboBoxItem = {
      id: "a",
      label: "A",
      value: "value-a",
      textValue: "TEXT A",
      isDisabled: true,
      icon: "star",
      description: "desc",
    };
    expect(full.value).toBe("value-a");
    expect(full.textValue).toBe("TEXT A");
  });

  it("id !== value — 둘 다 독립 보존", () => {
    const stored: StoredComboBoxItem = {
      id: "opt-a",
      label: "Apple",
      value: "APPLE_VAL",
    };
    expect(stored.id).toBe("opt-a");
    expect(stored.value).toBe("APPLE_VAL");
  });
});

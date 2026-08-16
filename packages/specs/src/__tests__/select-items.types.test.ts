import { describe, it, expect } from "vitest";
import type { StoredSelectItem } from "../types/select-items";

/**
 * ADR-158 Phase 4 후속 (2026-08-17): `onActionId` / `RuntimeSelectItem` /
 * `toRuntimeSelectItem` 케이스는 채널 제거와 함께 삭제 — Select 는 RAC/RSP
 * 어휘상 per-item action 이 없고, 렌더러는 Stored 모델을 직접 소비한다.
 */
describe("StoredSelectItem", () => {
  it("required fields: id + label", () => {
    const minimal: StoredSelectItem = { id: "a", label: "A" };
    expect(minimal.id).toBe("a");
    expect(minimal.label).toBe("A");
  });

  it("optional fields compile", () => {
    const full: StoredSelectItem = {
      id: "a",
      label: "A",
      value: "value-a",
      textValue: "TEXT A",
      isDisabled: true,
      icon: "star",
      description: "desc",
    };
    expect(full.value).toBe("value-a");
    expect(full.description).toBe("desc");
  });

  it("id !== value — 둘 다 독립 보존", () => {
    const stored: StoredSelectItem = {
      id: "opt-a",
      label: "Apple",
      value: "APPLE_VAL",
    };
    expect(stored.id).toBe("opt-a");
    expect(stored.value).toBe("APPLE_VAL");
  });
});

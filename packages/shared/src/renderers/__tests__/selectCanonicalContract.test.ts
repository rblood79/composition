import { describe, it, expect } from "vitest";
import type { StoredSelectItem } from "@composition/specs";

describe("Select canonical contract", () => {
  const items: StoredSelectItem[] = [
    { id: "item-a", label: "Apple", value: "APPLE_VAL" },
    { id: "item-b", label: "Banana", value: "BANANA_VAL" },
    { id: "item-c", label: "Cherry" },
  ];

  it("selectedKey -> items[].id lookup (id !== value)", () => {
    const selectedKey = "item-a";
    const matched = items.find((it) => it.id === selectedKey);
    expect(matched?.value).toBe("APPLE_VAL");
    expect(matched?.label).toBe("Apple");
  });

  it("selectedKey 없을 때 lookup 결과 undefined", () => {
    const matched = items.find((it) => it.id === undefined);
    expect(matched).toBeUndefined();
  });

  it("id 있고 value 없는 item 은 selectedValue undefined", () => {
    const matched = items.find((it) => it.id === "item-c");
    expect(matched?.value).toBeUndefined();
    expect(matched?.label).toBe("Cherry");
  });
});

describe("ComboBox onInputChange reconcile", () => {
  const items: StoredSelectItem[] = [
    { id: "a", label: "Apple", value: "APPLE" },
    { id: "b", label: "Banana", value: "BANANA" },
  ];

  function reconcile(inputValue: string, items: StoredSelectItem[]) {
    const matched = items.find((it) => it.label === inputValue);
    return {
      selectedKey: matched?.id,
      selectedValue: matched?.value,
      inputValue,
    };
  }

  it("label 정확 일치 → selectedKey/Value 동기화", () => {
    expect(reconcile("Apple", items)).toEqual({
      selectedKey: "a",
      selectedValue: "APPLE",
      inputValue: "Apple",
    });
  });

  it("label 불일치 (custom value) → selectedKey/Value undefined", () => {
    expect(reconcile("custom", items)).toEqual({
      selectedKey: undefined,
      selectedValue: undefined,
      inputValue: "custom",
    });
  });

  it("빈 문자열 → selectedKey/Value undefined", () => {
    expect(reconcile("", items)).toEqual({
      selectedKey: undefined,
      selectedValue: undefined,
      inputValue: "",
    });
  });
});

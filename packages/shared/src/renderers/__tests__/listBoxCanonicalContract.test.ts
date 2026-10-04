import { describe, it, expect } from "vitest";
import type { StoredListBoxItem } from "@composition/rendering";
import { toRuntimeListBoxItem } from "@composition/rendering";

/**
 * ADR-076 Phase 3 — ListBox canonical contract
 *
 * selectedKey = item.id (canonical). legacy selectedIndex 는 items[idx].id 로 자동 변환.
 * 부모 단위 원자성 — hasValidTemplate + hasItemsArray 공존은 경고.
 */
describe("ListBox canonical contract (ADR-076)", () => {
  const items: StoredListBoxItem[] = [
    { id: "opt-a", label: "Apple", value: "APPLE_VAL" },
    {
      id: "opt-b",
      label: "Banana",
      value: "BANANA_VAL",
      description: "노란 과일",
    },
    { id: "opt-c", label: "Cherry", isDisabled: true },
  ];

  it("selectedKey → items[].id lookup (id !== value)", () => {
    const selectedKey = "opt-a";
    const matched = items.find((it) => it.id === selectedKey);
    expect(matched?.value).toBe("APPLE_VAL");
    expect(matched?.label).toBe("Apple");
  });

  it("selectedKey 없을 때 lookup 결과 undefined", () => {
    const matched = items.find((it) => it.id === undefined);
    expect(matched).toBeUndefined();
  });

  it("description 있는 item 은 Text slot 렌더 가능", () => {
    const matched = items.find((it) => it.id === "opt-b");
    expect(matched?.description).toBe("노란 과일");
  });

  it("isDisabled item 은 RAC ListBoxItem isDisabled 전달 대상", () => {
    const matched = items.find((it) => it.id === "opt-c");
    expect(matched?.isDisabled).toBe(true);
  });

  it("toRuntimeListBoxItem index 주입", () => {
    const runtime = toRuntimeListBoxItem(items[1], 1);
    expect(runtime.index).toBe(1);
    expect(runtime.id).toBe("opt-b");
    expect(runtime.label).toBe("Banana");
  });
});

/**
 * legacy selectedIndex/selectedIndices → selectedKey/selectedKeys 변환 contract.
 * SelectionRenderers.renderListBox 의 computeDefaultSelectedKeys 와 동일 로직.
 */
describe("ListBox legacy selectedIndex migration (ADR-076)", () => {
  const items: StoredListBoxItem[] = [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
    { id: "c", label: "C" },
  ];

  function migrate(props: {
    selectedKeys?: unknown;
    selectedKey?: unknown;
    selectedIndices?: unknown;
    selectedIndex?: unknown;
  }): string[] {
    if (Array.isArray(props.selectedKeys) && props.selectedKeys.length > 0) {
      return props.selectedKeys.map(String);
    }
    if (typeof props.selectedKey === "string" && props.selectedKey.length > 0) {
      return [props.selectedKey];
    }
    if (
      Array.isArray(props.selectedIndices) &&
      props.selectedIndices.length > 0
    ) {
      return (props.selectedIndices as unknown[])
        .map((idx) => (typeof idx === "number" ? items[idx]?.id : undefined))
        .filter((key): key is string => typeof key === "string");
    }
    if (typeof props.selectedIndex === "number") {
      const key = items[props.selectedIndex]?.id;
      return key ? [key] : [];
    }
    return [];
  }

  it("selectedKeys canonical 우선", () => {
    expect(migrate({ selectedKeys: ["b"], selectedIndex: 0 })).toEqual(["b"]);
  });

  it("selectedKey canonical 우선 (single)", () => {
    expect(migrate({ selectedKey: "c", selectedIndex: 0 })).toEqual(["c"]);
  });

  it("selectedIndices → items[idx].id 변환", () => {
    expect(migrate({ selectedIndices: [0, 2] })).toEqual(["a", "c"]);
  });

  it("selectedIndex → items[idx].id 변환", () => {
    expect(migrate({ selectedIndex: 1 })).toEqual(["b"]);
  });

  it("out-of-range index 는 필터링", () => {
    expect(migrate({ selectedIndices: [0, 99] })).toEqual(["a"]);
    expect(migrate({ selectedIndex: 99 })).toEqual([]);
  });

  it("아무것도 없으면 빈 배열", () => {
    expect(migrate({})).toEqual([]);
  });
});

/**
 * 부모 단위 원자성 — 혼합 상태 감지.
 * SelectionRenderers 에서 `hasValidTemplate && hasItemsArray` 시 경고 + Path 1 우선.
 */
describe("ListBox 혼합 모드 감지 (ADR-076 Hard Constraint #3)", () => {
  it("columnMapping + items 공존 감지", () => {
    const columnMapping = { columns: ["col1"] };
    const listBoxChildren = [{ id: "tpl", type: "ListBoxItem" }];
    const items: StoredListBoxItem[] = [{ id: "x", label: "X" }];

    const hasValidTemplate =
      (columnMapping || false) && listBoxChildren.length > 0;
    const hasItemsArray = Array.isArray(items) && items.length > 0;

    expect(hasValidTemplate).toBe(true);
    expect(hasItemsArray).toBe(true);
    // 렌더 로직: Path 1 우선 (items 무시 + console.warn)
    const chosenPath = hasValidTemplate
      ? "template"
      : hasItemsArray
        ? "items"
        : "legacy";
    expect(chosenPath).toBe("template");
  });

  it("items 만 있을 때는 Path 2 선택", () => {
    const columnMapping = undefined;
    const listBoxChildren: Array<{ id: string; type: string }> = [];
    const items: StoredListBoxItem[] = [{ id: "x", label: "X" }];

    const hasValidTemplate =
      (columnMapping || false) && listBoxChildren.length > 0;
    const hasItemsArray = Array.isArray(items) && items.length > 0;
    const chosenPath = hasValidTemplate
      ? "template"
      : hasItemsArray
        ? "items"
        : "legacy";
    expect(chosenPath).toBe("items");
  });

  it("legacy ListBoxItem 자식만 있을 때는 Path 3 fallback", () => {
    const columnMapping = undefined;
    const listBoxChildren = [{ id: "child1", type: "ListBoxItem" }];
    const items: StoredListBoxItem[] | undefined = undefined;

    const hasValidTemplate =
      (columnMapping || false) && listBoxChildren.length > 0;
    const hasItemsArray =
      Array.isArray(items) && (items as StoredListBoxItem[]).length > 0;
    const chosenPath = hasValidTemplate
      ? "template"
      : hasItemsArray
        ? "items"
        : "legacy";
    expect(chosenPath).toBe("legacy");
  });
});
